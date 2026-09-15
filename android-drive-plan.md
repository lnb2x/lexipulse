# Kế hoạch LexiPulse Android và đồng bộ Google Drive

Ngày: 13/09/2026. Phạm vi đã xác nhận: đồng bộ hai chiều web ↔ Android. Đây là kế hoạch, chưa triển khai ứng dụng.

**Hướng đề xuất:** React + TypeScript hiện có, đóng gói Android bằng Capacitor với tài nguyên nằm trong APK. Giữ năm chế độ ôn tập, FSRS, tra cứu, bộ từ, Quizlet và nhập/xuất. Ưu tiên điện thoại, học offline và APK thử nghiệm trước; phát hành Google Play là bước tiếp theo.

**Cơ sở:** Web dùng Dexie với bốn bảng; backup v1 thiếu `quizletSets`; lượt ôn chưa có ID độc lập; xóa từ đang xóa hẳn. `server/` xử lý Quizlet URL không chạy trong APK. Vì vậy cần nâng cấp dữ liệu trước khi bật đồng bộ.

**Kiến trúc:** UI và logic học dùng chung → lớp truy cập dữ liệu → IndexedDB trên web / SQLite trên Android → bộ đồng bộ dùng chung → Drive API. SQLite là đề xuất để dữ liệu Android không phụ thuộc bộ nhớ WebView; phải chuyển cả các hook đang gọi Dexie trực tiếp sang lớp truy cập chung. [Capacitor hỗ trợ ghép vào web hiện có](https://capacitorjs.com/docs/getting-started); [hướng dẫn lưu trữ](https://capacitorjs.com/docs/guides/storage).

**Quy ước đồng bộ:**

- Lưu dữ liệu LexiPulse trong `appDataFolder`, quyền `drive.appdata`; thư mục ẩn trong giao diện Drive. Giữ xuất JSON riêng để người dùng tải xuống. [Tài liệu Google](https://developers.google.com/workspace/drive/api/guides/appdata).
- Web và Android dùng các OAuth client trong cùng Google Cloud project, cùng tài khoản. Web dùng Google Identity Services; Android dùng cầu nối native tới AuthorizationClient. Không đăng nhập Google trong WebView; không đóng gói client secret. Token web giữ trong bộ nhớ, cần thao tác kết nối lại khi hết phiên. [Web](https://developers.google.com/identity/oauth2/web/guides/use-token-model), [Android](https://developer.android.com/identity/authorization).
- Đồng bộ từ, bộ Quizlet, ghi chú, tag, sự kiện ôn và cài đặt học theo danh sách cho phép; API key, token, cache và endpoint riêng của thiết bị không lên Drive. Tách dữ liệu theo tài khoản; đổi tài khoản không tự mang dữ liệu tài khoản cũ sang.
- Ghi thay đổi và hàng đợi trong cùng giao dịch cục bộ. Mỗi thay đổi có ID, thiết bị, phiên bản và quan hệ với bản trước; tải các gói thay đổi bất biến riêng biệt, gộp theo ID để retry không nhân đôi. Không ghi đè một file backup chung. Phân trang, kiểm tra phiên bản/checksum; chỉ đánh dấu đã gửi khi Drive xác nhận. Snapshot dùng phục hồi; chưa xóa nhật ký ở bản đầu.
- Sửa đồng thời cùng trường: giữ cả hai bản để chọn; xóa có dấu vết, xóa thắng sửa đồng thời và cho phép khôi phục. Không quyết định chỉ bằng giờ trên điện thoại. Từ trùng khác ID được đề nghị gộp, không tự gộp khác nghĩa.
- Lượt ôn có `eventId`; gộp rồi dựng lại FSRS theo thứ tự xác định, cùng phiên bản/tham số và quy tắc ngẫu nhiên. Lượt học thêm chỉ tính hoạt động. Thống kê mới tính từ sự kiện, giữ ngày học/múi giờ; dữ liệu lịch sử thiếu thông tin giữ mốc gốc, không cộng hai bản tổng hoặc tạo lượt ôn giả. Migration và liên kết dữ liệu cũ phải cho kết quả ổn định khi lặp lại.
- Chạy khi mở/quay lại app, có mạng, sau thay đổi và khi bấm “Đồng bộ ngay”; kiểm tra định kỳ lúc ứng dụng đang mở. Hiển thị thời điểm thành công, số thay đổi chờ và lỗi kết nối. Bản đầu không cam kết đồng bộ khi app bị đóng; dữ liệu chờ vẫn được giữ.

| Bước | Công việc và nơi thay đổi | Điều kiện hoàn thành |
| --- | --- | --- |
| 1 | Thử Capacitor, SQLite và OAuth web/Android; thêm `android/`, `capacitor.config.ts`. | APK mở offline; hai nền tảng đọc được cùng dữ liệu thử trong Drive. |
| 2 | Tách truy cập DB trong repositories, hooks và Quizlet; nâng `schema.ts`, `types/vocab.ts`, backup v2. | Chuyển dữ liệu cũ không mất từ/lịch ôn/bộ Quizlet; đọc được backup v1. |
| 3 | Thêm `src/services/sync/`: sự kiện, hàng đợi, xóa mềm, quy tắc gộp và tính FSRS/thống kê. | Gộp cùng dữ liệu theo thứ tự khác nhau vẫn hội tụ; retry không đếm trùng. |
| 4 | Làm adapter Drive và xác thực theo nền tảng, cô lập tài khoản. | Thêm/sửa/xóa và ôn tập truyền cả hai chiều; phục hồi sau lỗi mạng/token. |
| 5 | Thêm màn hình kết nối, đồng bộ lần đầu, trạng thái, xử lý xung đột và khôi phục. | Xem trước khi gộp dữ liệu sẵn có; có bản sao trước migration/gộp; ngắt kết nối vẫn học được. |
| 6 | Tối ưu thao tác Android; thêm đọc tiếng Anh native, chọn/chia sẻ file; cấu hình backend HTTPS cho Quizlet URL/dịch. | Nút Back, bàn phím, vùng chạm, phát âm và nhập/xuất hoạt động; ôn từ đã lưu khi mất mạng. |
| 7 | Kiểm chứng cuối và tạo APK ký để thử nghiệm. | Kiểm tra hiện có đạt; kiểm tra máy thật + web: học offline đồng thời, lệch giờ, sửa/xóa xung đột, tắt app giữa đồng bộ, hết dung lượng, đổi tài khoản, cài lại và dữ liệu hỏng. |

**Nghiệm thu:** Học trên web, tiếp tục trên Android và ngược lại; sau đồng bộ, hai bên cùng bộ từ, lịch ôn và thống kê, không mất thay đổi hay hồi sinh từ đã xóa. Thử tối thiểu hai thiết bị và bộ dữ liệu 10.000 từ. Ước lượng ban đầu: 4–6 tuần cho một người phát triển quen React/Android; điều chỉnh sau bước 1, chưa gồm thời gian xét duyệt cửa hàng/OAuth. Cần chuẩn bị Google Cloud project, tên miền web, package ID và chứng thư ký Android khi triển khai.
