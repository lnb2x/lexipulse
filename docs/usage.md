# Hướng dẫn sử dụng

[← README](../README.md)

## Phiên học ngắn và điểm yếu

Trong **Ôn tập**, **Học thông minh** là chế độ mặc định. Chọn **10**, **20** hoặc **Tất cả**, rồi **Bắt đầu học**. Từ chưa quen bắt đầu bằng chọn nghĩa, sau đó chuyển sang tự viết từ tiếng Anh. Câu sai hoặc dùng gợi ý quay lại sau tối đa ba câu khác; chỉ câu viết đúng không dùng trợ giúp mới được tính là đã tự nhớ. **Không biết** mở đáp án; **Để ôn lại sau** kết thúc luyện từ đó và đưa vào danh sách cần ôn, không tính là đã nhớ.

Một từ chỉ cập nhật FSRS một lần trong lượt, ở lần kiểm tra viết đầu tiên hoặc khi bạn chọn để ôn sau. Lỗi ở phần chọn nghĩa vẫn ảnh hưởng kết quả này; trả lời đúng ở lượt sửa sai không xóa lỗi ban đầu. Các lượt thử được lưu riêng, còn thống kê đúng ngay lần đầu không cộng lượt luyện lặp. Luyện thêm và luyện lại cuối lượt giữ nguyên lịch FSRS và số từ ôn chính thức trong ngày.

Các chế độ **Thẻ ghi nhớ**, **Điền từ**, **Nghe chép**, **Trắc nghiệm** và **Nối từ** vẫn có trên thanh chọn chế độ. Thẻ đến hạn được chọn theo thứ tự lịch ôn; phần còn lại chờ lượt sau. Với các chế độ này, cuối phiên có thể chọn **Luyện lại … từ chưa nhớ** để luyện riêng các thẻ Quên/Khó.

Phiên đang dở được lưu trong trình duyệt. Sau khi tải lại trang, vào **Ôn tập → Tiếp tục phiên học**. Học thông minh giữ thứ tự câu hỏi, các từ đang chờ thử lại và tiến độ nhận diện/tự viết; từ đã xóa hoặc chưa có nghĩa được loại khỏi lượt. Các chế độ khác chỉ tiếp tục với thẻ chưa chấm. Câu trả lời và phản hồi chưa bấm **Tiếp tục** cần thực hiện lại. Bắt đầu phiên khác thay thế phiên từ vựng đang dở. Đổi chế độ trong lượt giữ các điểm đã ghi chính thức; khi quay về Học thông minh, ứng dụng giữ cả giai đoạn học và lỗi/gợi ý đã ghi của các từ chưa được chấm.

“Bạn cần luyện gì?” thống kê các lượt mới theo kỹ năng, tỷ lệ đúng ngay lần đầu không dùng gợi ý/đáp án kèm số mẫu và số lượt cần luyện. Phần nghe chép còn ghi số lần nhập sai và dùng gợi ý. Nghe lại không làm giảm điểm. Lịch sử cũ chưa có thông tin kỹ năng không được suy đoán thêm.

## Luyện TOEIC Part 5

Vào **Ôn tập → TOEIC Part 5**, chọn chủ đề rồi **Bắt đầu Part 5**. Bộ khởi đầu có 16 câu tự biên soạn về từ loại, thì động từ, giới từ và liên từ; không phải bộ đề chính thức. Sau mỗi lựa chọn, ứng dụng giải thích cả bốn đáp án bằng ngôn ngữ giao diện. Có thể tạm dừng, tiếp tục sau tải lại trang, luyện lại câu sai cuối lượt hoặc các câu từng sai theo chủ đề. Kết quả Part 5 được lưu riêng với lịch FSRS từ vựng.

## Nhắc sao lưu

Ở cuối màn hình ôn từ, chọn **Tải backup đầy đủ** để xuất JSON v2. Ứng dụng ghi thời điểm yêu cầu tải file và nhắc lưu một bản mỗi tuần; trình duyệt không xác nhận file đã được giữ ở đâu. Backup chứa bộ Quizlet và lịch sử luyện theo kỹ năng trong cài đặt; loại bỏ API key, phiên đang dở và mốc tải file. Xuất CSV/Excel hoặc một phần bộ từ không được tính là backup đầy đủ.

## Tra cứu và lưu từ

Nhập từ hoặc cụm từ tiếng Anh ở màn hình tra cứu. Kết quả có thể gồm nghĩa, IPA, ví dụ, collocations và họ từ, tùy nguồn khả dụng. Nhãn nguồn giúp phân biệt từ điển, AI và dữ liệu nhập.

Kiểm tra từ nguyên mẫu khi tra biến thể như `running`. Có thể mở từ liên quan hoặc sửa kết quả trước khi lưu. Cập nhật từ đã có cần giữ tiến độ ôn và ghi chú hiện có.

## AI và âm thanh

Mở **Cài đặt** để chọn provider, base URL, model, key rồi kiểm tra kết nối. AI là tùy chọn. Endpoint cục bộ cần có mô hình đang chạy và cho phép origin của ứng dụng truy cập. Provider từ xa có thể từ chối do CORS hoặc quyền của key.

Âm thanh gồm giọng ưu tiên, tốc độ, cao độ và khoảng nghe lặp. Giọng/phát âm phụ thuộc nguồn audio hoặc giọng tổng hợp có trên thiết bị.

## Nhập Quizlet

### URL

1. Chạy `npm run dev`. Trên Windows/macOS, ứng dụng ưu tiên Chrome/Edge đã cài; nếu chưa có trình duyệt phù hợp, cài Chromium bằng `npx playwright install chromium`.
2. Mở nhập Quizlet từ màn hình bộ từ.
3. Dán URL vào ô đường dẫn: nội dung tự tải và hiện trong bảng xem trước. Nếu gõ URL, bấm Enter hoặc **Tải bộ từ**.
4. Kiểm tra chiều Anh–Việt, nội dung chuẩn hóa và từ trùng trước khi nhập.

Dạng URL: `https://quizlet.com/123456789/example-flash-cards/` (ví dụ định dạng, không phải bộ mẫu). Có hỗ trợ mã vùng như `/vn/` và loại bỏ tham số theo dõi.

Khi chạy trên máy cá nhân ở localhost, không cần cài tiện ích. Ứng dụng mở Chrome/Edge như trình duyệt thông thường, bằng hồ sơ riêng để đọc bộ từ; nếu Quizlet yêu cầu đăng nhập/xác minh, cửa sổ hiện lên để bạn hoàn tất và ứng dụng tự tiếp tục. **Hủy tải**, đổi URL hoặc đóng hộp thoại sẽ hủy phiên. Bộ đã tải thành công được giữ tạm 15 phút để tải lại nhanh. Hồ sơ riêng nằm tại `%LOCALAPPDATA%/LexiPulse/quizlet-native-browser` trên Windows, không dùng hồ sơ Chrome/Edge thường ngày. Cổng đọc thẻ CDP chỉ mở trên loopback trong thời gian tải và đóng cùng cửa sổ.

Máy chủ không có màn hình vẫn dùng trình duyệt nền và có thể bị Quizlet chặn. Khi cần, mở **Nhập văn bản thủ công (tùy chọn)** để dán export của bộ bạn được phép truy cập.

### Tiện ích trình duyệt (tùy chọn)

Nếu muốn đọc bộ từ bằng hồ sơ trình duyệt hiện tại, mở **Kết nối tiện ích (tùy chọn)** và làm theo hướng dẫn cài tiện ích trên Chrome/Edge một lần. Tải lại LexiPulse trong cùng trình duyệt/hồ sơ; khi thấy **Đã kết nối trình duyệt**, dán link. Ứng dụng ưu tiên tiện ích nếu đã kết nối và tự đưa thẻ vào bảng đối chiếu hiện có, không lưu từ trước khi bạn xác nhận nhập.

Tiện ích mở một tab Quizlet riêng và chỉ đọc bộ từ được yêu cầu. Khi cần đăng nhập/xác minh, tab được đưa lên trước để bạn thực hiện; ứng dụng chờ tối đa 3 phút và tự tiếp tục. **Hủy tải**, đổi URL hoặc đóng hộp thoại sẽ ngừng yêu cầu. Tab đã cần bạn thao tác được giữ lại; tab nền do tiện ích mở sẽ được đóng khi hoàn tất. Nếu đọc từ giao diện trang, hãy kiểm tra số lượng thẻ trước khi nhập.

Bản kết nối hiện hỗ trợ `http://localhost:5173`, `http://127.0.0.1:5173` và cổng preview `4173`. Chưa hỗ trợ website triển khai ở tên miền khác. Tiện ích không đọc cookie/mật khẩu và không tự giải CAPTCHA. Mã nguồn ở `public/quizlet-bridge/`; đóng gói lại ZIP sau khi sửa bằng `node scripts/package-quizlet-bridge.mjs`.

### Văn bản export

Mỗi dòng một thẻ, ưu tiên tab giữa từ và nghĩa. Ví dụ dùng tab thật:

```text
negotiate	đàm phán
feasible	khả thi
collaborate	hợp tác
```

Parser còn hỗ trợ ` - `, ` : ` và dấu phẩy. Chúng có thể xuất hiện trong nghĩa nên luôn kiểm tra xem trước. Dùng đảo chiều nếu tiếng Anh ở cột thứ hai.

Nếu mặt từ vựng của một thẻ có nhiều từ cách nhau bằng dấu phẩy, ứng dụng tách từng từ thành một mục riêng trước khi kiểm tra trùng và nhập. Ví dụ `go down, decrease, drop off (phr.v)` tạo ba mục, cùng dùng nghĩa của thẻ gốc. Dấu phẩy trong ngoặc như `(n, v)` không tách từ. Với văn bản export, dùng tab giữa cột từ và cột nghĩa để tránh nhầm dấu phẩy trong từ với dấu phân cách hai cột.

Nhập liệu có đối chiếu từ trùng và liên kết bộ Quizlet. Xóa bản ghi bộ sẽ gỡ liên kết, không xóa các từ đã lưu.

## Ôn tập

Chọn **Học thông minh** để luyện nhận diện rồi tự viết, hoặc chọn riêng thẻ ghi nhớ, điền từ, nghe chép chính tả, trắc nghiệm và nối từ. Trong Học thông minh, dùng phím **1–4** để chọn nghĩa, **Enter** để kiểm tra câu viết và **Enter** trên nút Tiếp tục để sang câu sau. Trên flashcard, lật thẻ và đánh giá từ **Học lại** đến **Dễ** để tính lịch tiếp theo. Khoảng ôn là kết quả scheduler, không phải cam kết ghi nhớ.

Mở bảng phím tắt trong ứng dụng để xem phím theo màn hình. Khi đang gõ hoặc mở modal, một số phím học tập tạm ngưng để tránh thao tác nhầm.

Thống kê dùng dữ liệu trình duyệt và ngày cục bộ. Thay đổi múi giờ/ngày hệ thống hoặc khôi phục dữ liệu có thể ảnh hưởng hiển thị theo ngày.

## Sao lưu và chuyển máy

- JSON giữ từ, lịch ôn trong từng từ, cài đặt đã bỏ key và thống kê ngày.
- CSV/Excel phù hợp đọc/sửa bảng từ; không thay thế JSON để giữ trạng thái ứng dụng.
- Backup v1 giữ liên kết và văn bản nguồn Quizlet trong từng từ khi khôi phục. Bảng `quizletSets` chưa có trong v1, nên danh sách quản lý bộ có thể cần nhập lại.
- Giữ bản sao trước khi khôi phục. Parser hỗ trợ JSON cũ dạng mảng từ và backup envelope; chỉ nhập tệp đáng tin cậy.
- Cấu hình lại key sau khi chuyển máy. Không gửi backup cá nhân vào issue.

IndexedDB tách biệt theo origin: `localhost:5173`, `127.0.0.1:5173` và website triển khai có kho khác nhau. Xóa dữ liệu trang hoặc dùng hồ sơ trình duyệt khác sẽ không thấy bộ từ cũ.

## Xử lý lỗi

| Hiện tượng | Kiểm tra |
| --- | --- |
| Không thấy dữ liệu đã lưu | Đúng trình duyệt, hồ sơ, hostname/cổng; dữ liệu trang có bị xóa không. |
| Quizlet báo backend offline | Chạy Vite dev/preview hoặc cấu hình proxy `/api/` cho server riêng. |
| Không mở được Chromium | Cài Playwright; trên Linux thêm `--with-deps`, hoặc đặt `CHROME_PATH`. |
| Quizlet chặn/yêu cầu đăng nhập | Hoàn tất trong cửa sổ Quizlet vừa mở; khi cần, dùng nhập văn bản thủ công. |
| AI không phản hồi | Key, model, endpoint, mạng, quyền truy cập và CORS. |
| Không có âm thanh | Âm lượng, quyền phát âm thanh, nguồn audio và giọng thiết bị. |
| Offline không mở được màn hình | Tải màn hình khi có mạng trước; tính năng gọi mạng vẫn cần kết nối. |

### Khôi phục có xem trước

Chọn Gộp hoặc Thay thế và các bảng cần nhập, rồi Xem trước thay đổi. Tải file
khôi phục, xác nhận đã lưu, rồi mới ghi. Thay thế chỉ nhận v2 đầy đủ và ghép
Từ vựng/Bộ Quizlet để giữ liên kết; file hỏng phải dùng Gộp hoặc sửa nguồn.
Nếu dữ liệu thay đổi ở tab khác, cần xem trước lại. Khôi phục cài đặt xóa API key.
