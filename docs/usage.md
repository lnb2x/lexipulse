# Hướng dẫn sử dụng

[← README](../README.md)

## Tra cứu và lưu từ

Nhập từ hoặc cụm từ tiếng Anh ở màn hình tra cứu. Kết quả có thể gồm nghĩa, IPA, ví dụ, collocations và họ từ, tùy nguồn khả dụng. Nhãn nguồn giúp phân biệt từ điển, AI và dữ liệu nhập.

Kiểm tra từ nguyên mẫu khi tra biến thể như `running`. Có thể mở từ liên quan hoặc sửa kết quả trước khi lưu. Cập nhật từ đã có cần giữ tiến độ ôn và ghi chú hiện có.

## AI và âm thanh

Mở **Cài đặt** để chọn provider, base URL, model, key rồi kiểm tra kết nối. AI là tùy chọn. Endpoint cục bộ cần có mô hình đang chạy và cho phép origin của ứng dụng truy cập. Provider từ xa có thể từ chối do CORS hoặc quyền của key.

Âm thanh gồm giọng ưu tiên, tốc độ, cao độ và khoảng nghe lặp. Giọng/phát âm phụ thuộc nguồn audio hoặc giọng tổng hợp có trên thiết bị.

## Nhập Quizlet

### URL

1. Cài Chromium bằng `npx playwright install chromium`, rồi chạy `npm run dev`.
2. Mở nhập Quizlet từ màn hình bộ từ.
3. Dán URL, tải nội dung và xem trước.
4. Kiểm tra chiều Anh–Việt, nội dung chuẩn hóa và từ trùng trước khi nhập.

Dạng URL: `https://quizlet.com/123456789/example-flash-cards/` (ví dụ định dạng, không phải bộ mẫu). Có hỗ trợ mã vùng như `/vn/` và loại bỏ tham số theo dõi.

Bộ riêng tư, yêu cầu đăng nhập, giới hạn truy cập hoặc thử thách bảo mật có thể làm tải thất bại. Dùng văn bản export của bộ mà bạn có quyền truy cập khi đó.

### Văn bản export

Mỗi dòng một thẻ, ưu tiên tab giữa từ và nghĩa. Ví dụ dùng tab thật:

```text
negotiate	đàm phán
feasible	khả thi
collaborate	hợp tác
```

Parser còn hỗ trợ ` - `, ` : ` và dấu phẩy. Chúng có thể xuất hiện trong nghĩa nên luôn kiểm tra xem trước. Dùng đảo chiều nếu tiếng Anh ở cột thứ hai.

Nhập liệu có đối chiếu từ trùng và liên kết bộ Quizlet. Xóa bản ghi bộ sẽ gỡ liên kết, không xóa các từ đã lưu.

## Ôn tập

Chọn flashcard, điền từ, nghe chép chính tả, trắc nghiệm hoặc nối từ. Trên flashcard, lật thẻ và đánh giá từ **Học lại** đến **Dễ** để tính lịch tiếp theo. Khoảng ôn là kết quả scheduler, không phải cam kết ghi nhớ.

Mở bảng phím tắt trong ứng dụng để xem phím theo màn hình. Khi đang gõ hoặc mở modal, một số phím học tập tạm ngưng để tránh thao tác nhầm.

Thống kê dùng dữ liệu trình duyệt và ngày cục bộ. Thay đổi múi giờ/ngày hệ thống hoặc khôi phục dữ liệu có thể ảnh hưởng hiển thị theo ngày.

## Sao lưu và chuyển máy

- JSON giữ từ, lịch ôn trong từng từ, cài đặt đã bỏ key và thống kê ngày.
- CSV/Excel phù hợp đọc/sửa bảng từ; không thay thế JSON để giữ trạng thái ứng dụng.
- Bảng `quizletSets` chưa có trong backup. Liên kết Quizlet trong từng từ đi cùng từ đó, nhưng danh sách quản lý bộ có thể cần nhập lại.
- Giữ bản sao trước khi khôi phục. Parser hỗ trợ JSON cũ dạng mảng từ và backup envelope; chỉ nhập tệp đáng tin cậy.
- Cấu hình lại key sau khi chuyển máy. Không gửi backup cá nhân vào issue.

IndexedDB tách biệt theo origin: `localhost:5173`, `127.0.0.1:5173` và website triển khai có kho khác nhau. Xóa dữ liệu trang hoặc dùng hồ sơ trình duyệt khác sẽ không thấy bộ từ cũ.

## Xử lý lỗi

| Hiện tượng | Kiểm tra |
| --- | --- |
| Không thấy dữ liệu đã lưu | Đúng trình duyệt, hồ sơ, hostname/cổng; dữ liệu trang có bị xóa không. |
| Quizlet báo backend offline | Chạy Vite dev/preview hoặc cấu hình proxy `/api/` cho server riêng. |
| Không mở được Chromium | Cài Playwright; trên Linux thêm `--with-deps`, hoặc đặt `CHROME_PATH`. |
| Quizlet chặn/yêu cầu đăng nhập | Dùng văn bản export mà bạn có quyền truy cập. |
| AI không phản hồi | Key, model, endpoint, mạng, quyền truy cập và CORS. |
| Không có âm thanh | Âm lượng, quyền phát âm thanh, nguồn audio và giọng thiết bị. |
| Offline không mở được màn hình | Tải màn hình khi có mạng trước; tính năng gọi mạng vẫn cần kết nối. |
