# Chạy và triển khai

[← README](../README.md)

## Cục bộ

```sh
npm ci
npx playwright install chromium
npm run dev
```

Mặc định `http://localhost:5173`. Vite gắn sẵn `/api/translate` và `/api/quizlet/fetch`. Chromium cần cho nhập URL và E2E.

```sh
npm run build
npm run preview
```

Preview mặc định `http://localhost:4173`, cũng có middleware. Đây là công cụ kiểm tra cục bộ, không phải cấu hình production có sẵn.

## Frontend tĩnh

Upload nội dung `dist/` sau khi build. Dùng HTTPS và phục vụ từ gốc domain; manifest/service worker dùng đường dẫn bắt đầu bằng `/`. Subpath cần sửa Vite base cùng các đường dẫn này và kiểm tra lại.

Frontend tĩnh có giao diện, lưu trữ, ôn tập và nhập văn bản/tệp, nhưng không tự có middleware. Nhập URL cần `/api/quizlet/fetch`; dịch cùng origin cần `/api/translate`. AI trực tiếp/từ điển ngoài phụ thuộc mạng và CORS.

## Backend riêng

```sh
npm ci
npx playwright install chromium
npm run server
```

Script dùng Node chạy TypeScript trực tiếp; yêu cầu phiên bản trong `package.json`. Server mặc định ở `127.0.0.1:3001`. Dừng bằng `Ctrl+C`.

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `PORT` | `3001` | Cổng backend riêng. |
| `HOST` | `127.0.0.1` | Địa chỉ bind; chỉ đổi khi đã kiểm soát truy cập. |
| `CHROME_PATH` | Tự tìm | Đường dẫn Chrome/Chromium/Edge; fallback sang browser Playwright. |
| `NODE_ENV` | Không đặt | `test` ngăn tự listen khi import server vào test. |

Biến được đọc từ môi trường tiến trình; server không tự nạp `.env`. Ví dụ PowerShell:

```powershell
$env:PORT = '3001'
npm run server
```

Backend import Playwright từ `@playwright/test` trong devDependencies. Cài đầy đủ bằng `npm ci`; `npm ci --omit=dev` sẽ thiếu gói này.

### API cùng origin

Frontend gọi đường dẫn tương đối `/api/...`. Đặt reverse proxy cùng origin, chuyển tiếp `/api/` về `http://127.0.0.1:3001` và giữ nguyên đường dẫn. Chạy backend ở cổng khác chưa đủ để frontend tự tìm thấy.

| Endpoint | Request | Kết quả |
| --- | --- | --- |
| `GET /api/health` | Không body | `{ "status": "ok", "service": "lexipulse-backend" }`; chỉ ở server riêng. |
| `POST /api/translate` | `{ "text": "hello" }` | `{ "text": "..." }`; có thể rỗng nếu nguồn không trả kết quả. |
| `GET /api/translate?q=hello` | Query `q` | Cùng cấu trúc bản dịch. |
| `POST /api/quizlet/fetch` | `{ "url": "https://quizlet.com/123456789/example-flash-cards/" }` | `success`, thông tin bộ và `terms`, hoặc `code`/`error`. |

URL trên chỉ là ví dụ định dạng. Nhập có thể lỗi vì URL không hợp lệ, bộ không tồn tại, đăng nhập, giới hạn, thử thách bảo mật hoặc không thấy thẻ.

### Truy cập từ xa

Backend chưa có xác thực, rate limit hay hàng đợi giới hạn Chromium đồng thời. Dùng proxy kiểm soát truy cập, giới hạn body/request, timeout và tài nguyên; chạy với quyền thấp và giới hạn mạng đi ra. Tiện ích cục bộ này chưa phải dịch vụ đa người dùng được gia cố đầy đủ.

Dữ liệu học tập vẫn ở trình duyệt từng người, không được server sao lưu. Xuất JSON trước khi đổi origin.
