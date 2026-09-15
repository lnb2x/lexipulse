# Hướng Dẫn Tích Hợp Groq API Đa Model (Multi-Model Pool & 429 Failover)

LexiPulse tích hợp cơ chế **Groq Multi-Model Pool** cho phép phân phối đồng thời các request học từ vựng, phân tích ngữ pháp / lemma và bổ sung bản dịch qua nhiều model khác nhau theo vòng tròn (Round-Robin). Khi bất kỳ model nào gặp giới hạn tốc độ (HTTP 429), hệ thống tự động đưa model vào thời gian chờ (cooldown) và chuyển tiếp (failover) sang model tiếp theo mà không làm gián đoạn trải nghiệm người dùng.

---

## 1. Cấu Hình Model Pool

Hệ thống chỉ sử dụng các model chính thức từ Groq đã được kiểm chứng về năng lực (tuyệt đối không đoán mò tên model):

| Model ID | Tên hiển thị | Context Window | JSON Mode | Tool Calling | Vision | Tier |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| `llama-3.3-70b-versatile` | Llama 3.3 70B Versatile | 128k tokens | Có | Có | Không | Production |
| `llama-3.1-8b-instant` | Llama 3.1 8B Instant | 128k tokens | Có | Có | Không | Production |
| `mixtral-8x7b-32768` | Mixtral 8x7B (MoE 32k) | 32k tokens | Có | Hạn chế | Không | Production |
| `llama-3.2-11b-vision-preview` | Llama 3.2 11B Vision | 128k tokens | Có | Có | Có | Preview |
| `llama-3.2-90b-vision-preview` | Llama 3.2 90B Vision | 128k tokens | Có | Có | Có | Preview |
| `llama-3.2-3b-preview` | Llama 3.2 3B | 8k tokens | Có | Có | Không | Preview |
| `llama-3.2-1b-preview` | Llama 3.2 1B | 8k tokens | Có | Không | Không | Preview |

### Cách cấu hình:
1. **Qua biến môi trường (`.env` hoặc `.env.local`)**:
   ```env
   VITE_GROQ_MODELS=llama-3.3-70b-versatile,llama-3.1-8b-instant,mixtral-8x7b-32768
   ```
2. **Qua giao diện ứng dụng (Settings Modal)**:
   - Mở modal **Cài đặt** (biểu tượng bánh răng trên Header).
   - Chọn nhà cung cấp: **Groq (Ultra-Fast)**.
   - Nhập Groq API Key (`gsk_...`).
   - Trong mục **Groq Multi-Model Pool**, nhấp chọn các model bạn muốn bật/tắt trong pool.

---

## 2. Cơ Chế Hoạt Động

### A. Phân Phối Round-Robin & Concurrency
- Mỗi request mới sẽ chọn một model khả dụng kế tiếp trong pool theo chỉ số vòng tròn (`roundRobinCounter % pool.length`).
- Hỗ trợ nhiều request chạy song song (tối đa 4 request Groq đồng thời trên toàn app; tối đa 2 request đồng thời trên 1 model).
- Mỗi request chỉ gửi tới **một model duy nhất** tại một thời điểm (không phát song song đầu cơ gây lãng phí quota).

### B. Xử Lý Khi Gặp HTTP 429 Rate Limit
Khi một model phản hồi HTTP 429:
1. **Phân tích Headers & Body**:
   - Ưu tiên đọc `Retry-After` (giây hoặc timestamp).
   - Đọc headers reset: `x-ratelimit-reset-requests`, `x-ratelimit-reset-tokens`.
   - Quét nội dung thông báo lỗi (ví dụ: `"Please try again in 1.25s"`).
   - Nếu không có thông số, tự động áp dụng **Exponential Backoff kèm Random Jitter** (2s, 4s, 8s,... + 0-800ms) để tránh các request thử lại cùng nhịp.
2. **Phân biệt phạm vi giới hạn**:
   - **Model Rate Limit (RPM/TPM)**: Đưa model cụ thể đó vào trạng thái `cooldown`. Ngay lập tức failover request sang model khác tương thích trong pool.
   - **Organization Rate Limit (RPD/TPD/Quota)**: Tạm dừng toàn bộ pool và chờ theo thời gian reset của Organization; tuyệt đối không luân chuyển sang model khác vì giới hạn này áp dụng cho toàn bộ tài khoản.
3. **Chống dồn tải khi phục hồi (Anti-stampede Ramp-up)**:
   - Khi hết hạn cooldown, model chuyển sang trạng thái `recovering`.
   - Trong trạng thái `recovering`, chỉ duy nhất **1 request probe** được gửi tới model. Nếu request probe thành công, model quay lại `available`. Nếu có các request khác đến cùng lúc, chúng sẽ chuyển sang các model khả dụng khác thay vì cùng ùa vào làm model vừa phục hồi bị 429 ngay lập tức.

### C. Tương Thích & Bảo Toàn Dữ Liệu
- Hệ thống tự động kiểm tra tính tương thích trước khi chọn model:
  - Nếu request yêu cầu JSON Structured Output (`response_format: { type: 'json_object' }`), chỉ chọn model hỗ trợ JSON.
  - Nếu request chứa ảnh (Vision), chỉ chọn model có năng lực Vision.
  - Nếu độ dài prompt vượt quá context window của model (ví dụ >32k với `mixtral-8x7b-32768`), model đó sẽ tự động bị bỏ qua để chọn model context 128k.
- **Bảo toàn 100% nội dung**: Tuyệt đối không cắt ngắn prompt, không âm thầm gỡ bỏ công cụ hay định dạng để ép model chạy.

### D. An Toàn Cho Streaming
- Nếu lỗi 429 xảy ra **trước khi** bất kỳ chunk văn bản nào được phát ra (emitted), request có thể chuyển model an toàn.
- Nếu lỗi 429 xảy ra **sau khi** đã phát một phần nội dung ra giao diện, hệ thống dừng lại và ném lỗi `GroqStreamInterruptedError` (kèm nội dung đã nhận và nguyên nhân gián đoạn); tuyệt đối không tự ý phát lại từ đầu gây trùng lặp hoặc mâu thuẫn câu chữ.

### E. Fast-Fail Cho Lỗi Không Thể Retry
- Các lỗi mã 401 (Unauthorized / Sai API Key), 403 (Forbidden), 400 (Invalid Request): dừng ngay lập tức và báo lỗi rõ ràng, không retry hay đổi model vòng quanh.
- Logging chuẩn hóa: ghi rõ model được chọn, số lần thử, lý do failover và thời gian cooldown; **tuyệt đối không ghi API key hoặc token nhạy cảm** ra log.
