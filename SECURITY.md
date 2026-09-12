# Bảo mật

## Phạm vi hỗ trợ

Báo cáo được xem xét trên phiên bản hiện tại của nhánh `main`. Dự án chưa có cam kết hỗ trợ dài hạn hoặc thời hạn phản hồi cố định.

## Báo cáo riêng tư

Dùng **Security → Report a vulnerability** trên [trang báo cáo riêng tư](https://github.com/lnb2x/lexipulse/security/advisories/new). Repo đã bật tính năng này. Không đưa payload khai thác, API key hoặc dữ liệu cá nhân vào issue công khai.

Trong báo cáo riêng tư, nêu commit bị ảnh hưởng, điều kiện tái hiện, tác động và cách giảm thiểu nếu có. Dùng dữ liệu thử nghiệm đã khử thông tin nhận dạng.

## Dữ liệu và thông tin xác thực

- Từ vựng, lịch ôn và thống kê nằm trong IndexedDB của origin đang dùng.
- Key mặc định ở `sessionStorage`; tùy chọn ghi nhớ lưu key trong IndexedDB. Cả hai có thể được JavaScript cùng origin đọc, không phải kho bí mật được mã hóa.
- AI gửi key và nội dung đến endpoint do người dùng chọn. Chỉ cấu hình endpoint đáng tin cậy.
- JSON export loại API key của settings nhưng vẫn chứa nội dung học tập và ghi chú cá nhân.
- Tra cứu/dịch trực tuyến gửi truy vấn ra bên ngoài. Backend Quizlet mở trang bộ thẻ bằng trình duyệt tự động.

Backend riêng là tiện ích cho môi trường cục bộ, chưa có xác thực người dùng, rate limit hoặc hàng đợi tác vụ trình duyệt. Khi triển khai từ xa, cần kiểm soát truy cập, tài nguyên và origin ở máy chủ/proxy. Xem [hướng dẫn triển khai](docs/deployment.md).
