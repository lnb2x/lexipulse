# Tối ưu LexiPulse — 2026-09-15

## Phạm vi

Tối ưu trên trạng thái làm việc hiện tại, giữ các thay đổi đang có về AI, Quizlet và giao diện.

### Tải giao diện theo nhu cầu

- `DeckView` và `ReviewView` được tải khi mở tab tương ứng.
- Giữ màn hình tra cứu trong lần tải đầu tiên; thêm thông báo tải bằng tiếng Việt/Anh.
- Giữ trạng thái truy vấn, câu ngữ cảnh và phiên ôn tập ở `App` khi chuyển tab.
- Gói JavaScript chính giảm từ **641,86 kB xuống 411,98 kB** (khoảng **35,8%**); gzip từ **188,32 xuống 122,76 kB**.
- Đây là kích thước gói chính, không phải tổng JavaScript tải ban đầu. Các gói dùng chung vẫn được tải; tổng dung lượng ứng dụng không giảm tương ứng.

### Tránh đọc bộ từ hai lần

- `useSpacedRepetition` dùng bộ từ được truyền vào thay vì mở thêm một truy vấn đọc toàn bộ bảng từ vựng.
- Mảng rỗng được hiểu đúng là bộ từ rỗng; không quay lại lấy dữ liệu khác từ cơ sở dữ liệu.
- Khi được dùng độc lập, hook vẫn đăng ký cập nhật cơ sở dữ liệu bình thường.
- `useVocabulary` dùng mảng rỗng ổn định trong lúc chờ và trả đúng trạng thái đang tải.

### Tìm kiếm gần đúng

- Tính khoảng cách một lần cho mỗi ứng viên rồi dùng lại để tính điểm tương đồng.
- Dùng ba hàng luân phiên thay cho toàn bộ ma trận, giảm bộ nhớ tạm từ O(m × n) xuống O(min(m, n)).
- Sửa xử lý đảo hai chữ liền nhau, kể cả cuối từ: `fundign` → `funding`, `teh` → `the`.
- Giữ quy tắc lọc, loại trùng và sắp xếp; kết quả có lỗi đảo chữ được xếp hạng chính xác hơn.

## Đo lường

Chạy lại bằng:

```sh
node scripts/benchmark-fuzzy-search.mjs
```

Bộ đo gồm 10.000 chuỗi có độ dài gần nhau, 10 lượt làm nóng và 40 lượt đo. Chọn độ dài này để thực sự chạy thuật toán khoảng cách, tránh chỉ đo bước loại ứng viên quá ngắn/dài.

| Chỉ số | Trước sửa | Sau sửa, lần đo đầu |
| --- | ---: | ---: |
| Trung vị mỗi lượt | 14,39 ms | 9,82 ms |
| Phân vị 95% | 16,24 ms | 10,99 ms |

Đây là phép đo tổng hợp bằng Node trên máy hiện tại, không phải tốc độ trang web thực tế. Kết quả dao động theo tải máy; lần đo lại cho trung vị 9,55 ms và phân vị 95% 12,57 ms.

## Kiểm tra

- Kết quả sau sửa: `npm run check` thành công, **319/319 kiểm thử** trong 38 tệp đạt; **7/7 luồng Chromium** đạt.
- Kiểm thử mới bao phủ lỗi đảo chữ, chuẩn hóa, xếp hạng gợi ý, dữ liệu truyền vào rỗng và chuyển đổi nguồn dữ liệu ôn tập.
- Kiểm thử chuyển tab chờ đúng màn hình và flashcard hiển thị thay vì chờ một khoảng thời gian cố định.
- Chạy `npm run check` để kiểm tra lint, kiểu dữ liệu, toàn bộ unit/regression test và build.
- Chạy `npm run test:e2e` để kiểm tra thêm/sửa từ, nhập hàng loạt, ôn tập, sao lưu/khôi phục, offline và phím tắt trên Chromium.
- Lint vẫn có các cảnh báo từ mã hiện có; đợt này tập trung vào các điểm tối ưu nêu trên.
