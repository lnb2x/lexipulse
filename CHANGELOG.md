# Changelog

Thay đổi đáng chú ý của LexiPulse. Lịch sử đầy đủ: [Git commits](https://github.com/lnb2x/lexipulse/commits/main).

## Unreleased

## 0.1.0 — 2026-09-13

Mốc phiên bản đầu tiên ghi trong changelog; dự án đã có lịch sử phát triển trước mốc này.

### Added

- Nhập Quizlet từ URL hoặc văn bản export, xem trước, chuẩn hóa, xử lý từ trùng và lưu liên kết bộ.
- Backend đọc Quizlet bằng Playwright và dịch văn bản; script chạy server riêng.
- Nghe lặp trên flashcard, cấu hình khoảng lặp và điều khiển phát âm/phím tắt bổ sung.
- Kiểm thử Quizlet, bảo toàn tiến độ FSRS và lưu bản dịch AI.
- Tài liệu sử dụng, kiến trúc, triển khai, đóng góp và bảo mật; mẫu issue/PR.

### Changed

- Cải thiện tra cứu, chi tiết từ, họ từ, giao diện bộ từ và focus của modal.
- Cập nhật pipeline làm giàu và repository để giữ thông tin dịch cùng nguồn dữ liệu.
- Đồng bộ yêu cầu Node, metadata dự án, lệnh kiểm tra và CI.

### Fixed

- Siết xác thực URL Quizlet ở trình duyệt và backend trước khi mở trang bên ngoài.
