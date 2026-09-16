# Changelog

Thay đổi đáng chú ý của LexiPulse. Lịch sử đầy đủ: [Git commits](https://github.com/lnb2x/lexipulse/commits/main).

## Unreleased

- Forward bulk enrichment cancellation to dictionary requests and reject late results.

- Đếm đúng các ID khác nhau bởi chữ hoa/thường trong preview thay thế backup.

- Backup v2 giữ riêng các thẻ cùng cách viết, lịch sử và timestamp khi khôi phục.
- Khôi phục settings v2 trực tiếp từ bảng gốc; loại API key trong các dòng cài đặt mở rộng.
- Xóa cache tra cứu sau khôi phục để tránh hiển thị lại thẻ đã bị thay thế.

- Stop today's-word normalization when its recovery backup cannot be stored or verified.

- Preview restore differences, select tables and download a recovery file before confirming writes (vi/en).

- Add read-only restore previews, table selection and replacement guarded by a current recovery snapshot.

- Restore backups atomically and clear credentials when restoring provider settings.

- Export all database tables in backup v2 with schema version and checksum; retain v1 import.

- Validate backup records independently and report rejected rows without blocking valid words.

- Preserve active local daily statistics during default backup merge.

- Restore Quizlet word links, raw source text and the FSRS estimated flag from v1 backups.

- Allocate new word IDs on collisions instead of overwriting another card.

- Preserve reviews and later edits during concurrent content updates and Quizlet normalization.

- Keep local scratch experiments out of the test gate and run timing budgets separately.

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
