# Cải thiện luồng luyện tập

- [x] Phân biệt bộ từ trống với bộ lọc không có kết quả; xóa điều kiện lọc nhưng giữ sắp xếp.
- [x] Chọn luyện thêm bằng lịch sử: kết hợp từ khó và từ lâu chưa luyện, không sửa hàng đợi đến hạn.
- [x] Thêm nút luyện theo kỹ năng bằng các từ còn cần củng cố, luôn dùng phiên cram.
- [x] Kiểm tra lựa chọn từ, thao tác giao diện và bảo toàn FSRS bằng test; chạy lint, typecheck, build và Playwright desktop/mobile.

Kiểm chứng: 628 Vitest tests qua (maxWorkers=4); 11 Playwright checks qua trên Chromium, gồm viewport 1280px và 390px. Typecheck và build qua; lint không có lỗi, còn warning trong mã hiện có. Đã kiểm tra ảnh giao diện desktop/mobile. Chưa kiểm tra thiết bị vật lý hoặc Safari/Firefox.
