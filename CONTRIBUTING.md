# Đóng góp cho LexiPulse

Với thay đổi lớn về dữ liệu, thuật toán ôn tập hoặc giao diện, mở issue mô tả vấn đề và phương án trước để thống nhất phạm vi.

## Chuẩn bị

1. Fork repo và clone về máy.
2. Dùng Node theo `.nvmrc` (phiên bản tối thiểu trong `package.json`).
3. Chạy `npm ci`, sau đó `npm run dev`.
4. Tạo nhánh mô tả thay đổi, ví dụ `fix/quizlet-import-preview`.

Không cần API key thật để chạy unit test. Không commit khóa, tệp môi trường, backup cá nhân, build hoặc báo cáo kiểm thử.

## Nguyên tắc

- Giữ mỗi PR tập trung vào một vấn đề; mô tả hành vi trước và sau.
- Cập nhật cả tiếng Việt và tiếng Anh trong `src/i18n/translations.ts` khi thêm nội dung UI.
- Dùng repository/service sẵn có; giữ lịch ôn, ghi chú và dữ liệu người dùng khi cập nhật từ.
- Khi đổi IndexedDB, thêm migration và kiểm thử dữ liệu cũ. Không xóa database để né lỗi nâng cấp.
- Giữ điều khiển bàn phím, focus modal và giảm chuyển động hoạt động.
- Xử lý trường hợp thiếu key, timeout và nguồn dữ liệu lỗi.
- Thêm regression test cho lỗi hành vi; kiểm tra kết quả người dùng nhận được.
- Cập nhật tài liệu và mục `Unreleased` khi thay đổi ảnh hưởng cách sử dụng.

## Kiểm tra trước PR

```sh
npm run check
npx playwright install chromium
npm run test:e2e
```

Trên Linux thiếu thư viện hệ thống, dùng `npx playwright install --with-deps chromium`. E2E dùng bản build trong `dist/` và tự mở preview server tại cổng `4173`.

Oxlint hiện còn cảnh báo trong mã hiện có. Không tắt quy tắc để làm kiểm tra vượt qua; ghi rõ cảnh báo liên quan chưa xử lý trong PR. CI phải không có lỗi.

## Gửi thay đổi

Dùng mẫu PR để nêu vấn đề, thay đổi, cách xác minh và giới hạn. Với UI, đính kèm ảnh trước/sau đã loại thông tin cá nhân. Với dữ liệu, mô tả tác động tới backup và migration.

Tiêu đề commit nên cụ thể, ví dụ `fix: preserve review history when updating definitions` hoặc `docs: clarify backend setup`.

Trao đổi lịch sự, tập trung vào mã và hành vi có thể tái hiện. Báo lỗ hổng theo [SECURITY.md](SECURITY.md), không đăng chi tiết khai thác trong issue công khai.
