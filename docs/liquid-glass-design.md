# Thiết kế Liquid Glass cho LexiPulse

## Tinh chỉnh vật liệu — 04/10/2026

- Bảng màu hiện tại: nền sáng `#eef3f9`, nền tối `#101923`, nội dung sáng `#f8fafc`, nội dung tối `#17252e`, chữ `#1d1d1f` và accent `#007aff`. Font hệ thống hỗ trợ tiếng Việt. Giữ nội dung căn trái và hệ bố cục hiện có; lớp chức năng nổi truyền màu xanh biển/xanh ngọc của môi trường.
- Navigation và search thêm dải lens 4 px, highlight bất đối xứng và bóng sát mép. SVG displacement chỉ lấy mẫu nền ở dải viền được mask; foreground không dùng filter. Đây là mô phỏng web, mức hỗ trợ SVG backdrop tùy engine. Blur/tint/highlight vẫn hoạt động độc lập.
- Phản chiếu gồm một dải sáng xiên và ánh sáng mềm theo con trỏ. Nút trong navigation không có viền riêng; capsule đang chọn thể hiện trạng thái. Bóng navigation tăng nhẹ theo cuộn; tọa độ phản chiếu được cập nhật khi control di chuyển dưới con trỏ.
- Chuyển tab dùng 420 ms với spring `cubic-bezier(.22,1.12,.36,1)`. Giữ press, hover, focus, reduced motion/transparency, contrast và forced colors. Không thêm animation nền liên tục hay thư viện.
- Các ghi chép ngày 02/10 bên dưới là lịch sử; trạng thái tắt refraction và token cũ trong đó đã được thay thế ở lượt này.

Xác minh lượt 04/10: production build đạt; lint các file sửa không có cảnh báo; 41 unit test giao diện và 20 kịch bản Playwright Chromium đạt. Kiểm tra pixel xác nhận SVG đổi ảnh ở mép, giữ nguyên vùng giữa; các test hover kiểm tra cả opacity thực tế để tránh lỗi CSS ghi đè phản chiếu. Ảnh sáng/tối và mobile nằm tại `docs/screenshots/liquid-glass-2026-10-04/`. Chưa kiểm tra Safari/Firefox hoặc thiết bị vật lý.

## Phân cấp hiện tại của trang tra cứu — 02/10/2026

Trang tra cứu dùng nền navy `#0d1922`, chiều sâu teal rất nhẹ và chữ màu sáng. Bản thiết kế theo [hướng dẫn vật liệu của Apple](https://developer.apple.com/design/human-interface-guidelines/materials): nội dung ở lớp đọc, kính ở lớp chức năng nổi phía trên. Các ghi chép phía dưới là lịch sử của các lượt thiết kế trước.

- Không còn khung kính lớn bao quanh toàn bộ từ vựng. Định nghĩa, ví dụ, collocation, word family và biến thể ngữ pháp dùng `content-surface` với vật liệu `#17252e`, viền phân cách nhẹ, không backdrop blur hay phản chiếu theo con trỏ.
- Navigation, search, phát âm, speaker, nút và nhãn tương tác dùng `.liquid-glass`, `.glass-control`, `.glass-button`, `.glass-pill`, `.glass-nav`. Các capsule nổi lấy mẫu nội dung cuộn bên dưới; khoảng trống giữa capsule không chạy blur toàn chiều rộng.
- Kính dùng base bán trong suốt, blur 22–32 px, saturation 165%, brightness 1.04, viền trắng 1 px, specular highlight ở mép trên, inner shadow và bóng khuếch tán nhẹ. Search/navigation dùng 28 px. Một capsule chỉ có một lớp backdrop filter; nút bên trong search/phát âm/navigation không tạo thêm blur. SVG refraction cũ được tắt.
- `GlassLighting` cập nhật `--mouse-x`, `--mouse-y` theo phần trăm trên control gần nhất. Listener pointer được ủy quyền, tối đa một frame đang chờ cho mỗi đợt di chuyển, không vòng animation liên tục. Rời control, cuộn control khỏi con trỏ, blur cửa sổ, ẩn tab hoặc đổi tùy chọn accessibility sẽ xóa ánh sáng. Chỉ con trỏ chính xác có hover mới bật hiệu ứng.
- Hover scale 1.025, active khoảng 0.972–0.98, easing `cubic-bezier(.2,.8,.2,1)`. Reduced motion tắt scale/ánh sáng; reduced transparency và contrast more dùng vật liệu đặc; forced colors giữ màu hệ thống. Focus bàn phím rõ và các điều khiển nhỏ tăng vùng chạm trên thiết bị cảm ứng.
- Tiếng Việt, bố cục thông tin, tra cứu/gợi ý/lịch sử/ngữ cảnh, chỉnh sửa/lưu từ, dịch AI, audio, family links và tags tiếp tục dùng handler hiện có. Lịch FSRS và dữ liệu học không thay đổi.

Kiểm tra bằng `npm run lint`, `npm run typecheck`, `npm test -- --maxWorkers=2`, `npm run build` và bộ Playwright hiện có. Giới hạn worker giúp tránh timeout của heatmap khi nhiều test DOM cùng chạy. Ảnh kiểm tra sử dụng context riêng và từ vựng minh họa, không thay dữ liệu trình duyệt của người dùng.

Kết quả lượt này: 77 file / 524 unit test đạt với hai worker; typecheck và production build đạt. 20/20 kịch bản Playwright về giao diện/học tập đạt; sau sửa tint nút chính đã chạy lại 4 kịch bản responsive, accessibility, thao tác từ vựng và lưu nhãn, đều đạt. Lint không có lỗi; hai cảnh báo effect hiện có trong SearchBar/WordCard vẫn còn khi kiểm tra các file sửa. Kiểm tra ảnh ở 390–1920 px, hai theme và các tùy chọn accessibility trong Chromium; chưa kiểm tra Safari/Firefox hoặc điện thoại vật lý. Browser panel bị chặn vì không xác minh được quyền truy cập, nên bằng chứng hiển thị đến từ context kiểm tra riêng.

Ảnh hiện tại: [desktop tối](screenshots/liquid-glass/lookup-liquid-glass-desktop-dark.png), [mobile tối](screenshots/liquid-glass/lookup-liquid-glass-mobile-dark.png), [desktop sáng](screenshots/liquid-glass/lookup-liquid-glass-desktop-light.png).

## Khảo sát trước khi sửa

Frontend hiện dùng React 19, TypeScript, Vite và Tailwind 3; icon từ Lucide. Không có thư viện animation hoặc đồ họa. `App.tsx` điều hướng bằng state giữa tra cứu, bộ từ và ôn tập; các màn hình lớn được lazy load. Dữ liệu học nằm trong Dexie/IndexedDB, theme và ngôn ngữ có lựa chọn đã lưu. Thư mục `lexipulse` là junction tới `voc`.

Các lớp giao diện đã có:

- `index.css`: style nền, theme, focus, animation và flashcard 3D.
- `study-layout.css`: bố cục dùng chung, bảng từ, thống kê, dashboard SRS và responsive.
- `Header`: navigation với một capsule đo kích thước theo nội dung; hỗ trợ bàn phím và thay đổi ngôn ngữ.
- `SlidingSelection`: một vùng chọn trượt dùng lại cho các nhóm điều khiển.
- `AudioButton`, `.btn-primary`, `.btn-secondary`: các điểm dùng chung cho hành động.
- Các dialog dùng `useModalA11y` để giữ focus, đóng bằng Escape và trả focus.
- Search có debounce, gợi ý, lịch sử và xử lý bàn phím; bộ từ có tìm kiếm, lọc ngày, trạng thái, chủ đề và tải danh sách theo từng đợt.
- SRS, các phương pháp luyện, TOEIC và phiên học đã lưu là logic hiện có; thiết kế không thay schema hay thuật toán học.

Trong lượt tinh chỉnh này, nền và điều khiển vẫn còn khá phẳng, viền kính thiếu phân cấp, một số nút chỉ có vùng chạm 32–38 px, hover áp dụng cả trên thiết bị cảm ứng và modal chưa khóa cuộn hay giữ panel để chạy hiệu ứng đóng. Không có ảnh tham chiếu riêng trong tệp đính kèm; hướng thiết kế dựa trên yêu cầu và giao diện đang chạy.

## Hướng thiết kế

Palette gồm nền sáng `#f3f6fa`, nội dung sáng `#ffffff`, chữ sáng `#1d1d1f`, nền tối `#111820`, nội dung tối `#1c222a` và accent `#007aff`. Ánh sáng môi trường có xanh biển, xanh ngọc, vùng ấm nhẹ ở light mode và phản sắc tím nhẹ ở dark mode; không có animation nền liên tục. Font dùng `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`; tiêu đề phân cấp bằng cỡ chữ và độ đậm, nội dung ưu tiên đọc rõ tiếng Việt.

Navigation nổi phía trên, nhóm tiện ích nằm trong capsule riêng. Nội dung căn trái, vùng đọc rộng và sidebar thống kê nhẹ; trên mobile các cột xếp dọc, ba mục navigation dùng capsule đầy chiều rộng. Dictionary dùng kính dày xuyên màu môi trường; bảng từ, thống kê và câu hỏi vẫn dùng bề mặt đọc yên tĩnh.

## Hệ vật liệu

Vật liệu dùng chung có ba mức độ, cộng thêm bề mặt đọc cho danh sách và bài học:

| Lớp | Vật liệu | Vị trí |
| --- | --- | --- |
| Thin Glass | `--glass-thin`, blur 16 px | Phát âm, icon và tags |
| Regular Glass | `--glass-regular`, blur 26 px | Navigation, search và segmented control |
| Thick Glass | `--glass-thick`, gradient xuyên nền, blur 32 px | Card Dictionary |
| Bề mặt đọc | Cùng tint dày và viền phản sáng, không backdrop blur | Bảng từ, thống kê, câu hỏi, sidebar |
| Cửa sổ | `--dialog-fill`, tint rõ hơn và blur 32 px | Modal, với vùng cuộn nằm trong khung |

`liquid-glass.css` tập trung token màu, chữ, blur, hình học, spacing, bóng và motion. Các alias giữ tương thích với bài luyện và dialog hiện có. `LiquidGlass` hỗ trợ `thin`, `regular`, `thick`, cùng alias `clear` và `tinted`. Ba lớp `backdrop`, `edge`, `reflection` và lớp khúc xạ tùy chọn đều dùng `pointer-events: none`; nội dung nằm ngoài các lớp filter. `GlassSurface` là tên tương thích; `GlassSearchField` và `SlidingSelection` dùng lại nó. Các primitive khác gồm `GlassButton`, `GlassIconButton`, `ContentSurface`, `GlassDropdown` và `GlassTooltip`.

### Tinh chỉnh vật liệu theo phản hồi ngày 02/10/2026

- Dictionary dùng gradient trắng 58% → 28% ở light mode, xám xanh 42% → 32% ở dark mode; màu môi trường nhìn xuyên qua card. Viền sáng bất đối xứng, inner reflection và contact shadow tạo chiều sâu mà không tăng blur đồng loạt.
- Navigation và search có `GlassRefraction`; Dictionary bật bằng prop `refract`. SVG `feDisplacementMap` dịch pixel nền rất nhẹ trong một dải viền 7 px. Đây là hiệu ứng web mô phỏng, không phải shader vật liệu của Apple; mức hỗ trợ SVG backdrop filter tùy trình duyệt. Lớp blur/tint và viền sáng chính hoạt động độc lập với lớp tăng cường này. Tham khảo [MDN backdrop-filter](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter) và [feDisplacementMap](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feDisplacementMap).
- Ánh sáng theo con trỏ được cập nhật trong một frame dùng chung cho các bề mặt lồng nhau. Khi đi qua nút audio/action, phản chiếu trên card vẫn tiếp tục; vòng cập nhật dừng khi tọa độ đã ổn định, con trỏ rời bề mặt hoặc trang bị ẩn.
- Selected capsule có phản sáng cong và bóng sát bề mặt; chuyển tab giữ capsule trượt bằng spring hiện có. Hover nút nâng nhẹ, thay bóng trong 350 ms; nút xanh có inner glow, highlight trên và bóng dưới. Tags chọn dùng kính nhuộm xanh và `aria-pressed`.
- Reduced motion tắt ánh sáng theo con trỏ và khúc xạ; reduced transparency, contrast more và forced colors chuyển về bề mặt rõ nét. Nút tag có vùng chạm 44 px trên thiết bị cảm ứng. Không thêm thư viện animation, WebGL hoặc vòng animation nền.

- `regular`: kính đủ rõ cho toolbar và nhóm điều khiển.
- `clear`: alias của kính mỏng, blur 16 px; chỉ dùng khi nền và chữ có đủ tương phản.
- `tinted`: tint accent tiết chế cho điều khiển cần nhấn mạnh.

Blur mặc định 26 px, saturation 150%; light/dark có tint, viền và bóng riêng. Bóng sát mép kết hợp bóng khuếch tán rộng; viền có highlight đổi độ sáng theo chu vi. Viền phản sáng dày 1 px.

### Đồng bộ theo các ảnh phản hồi

- Thống kê, bảng từ, các bài luyện và sidebar dùng cùng gradient xuyên nền, viền phản sáng và geometry; bảng dài và nút trong hàng không chạy backdrop filter riêng.
- Cột thao tác dành đúng 148 px cho ba nút 44 px và hai gap 8 px. Desktop, tablet và mobile đều giữ đủ lề trước mép card; icon có cùng kích thước 17 px.
- Nhập/Xuất, Settings, phím tắt, chi tiết từ, sửa từ và kiểm tra bản dịch dùng `dialog-frame` / `dialog-scroll-body`. Thanh cuộn nằm bên trong khung với lề 8 px; các header riêng giữ vị trí khi cuộn nội dung.
- Bốn mục Nhập/Xuất và lựa chọn cách trả lời dùng `SlidingSelection`; trên mobile bốn mục chuyển thành grid 2 × 2. Capsule đặt ngay vào kích thước mới khi resize, chỉ chạy spring khi đổi lựa chọn, tránh tràn ngang trong lúc viewport thu hẹp.
- Các bộ Quizlet đã lưu dùng tên và meta riêng, nhóm thao tác có cột rõ ràng; tiêu đề dài xuống dòng an toàn. Hai nút ôn có chiều cao đồng đều, nút xóa giữ vùng chạm 44 px. URL input và nút tải theo token dùng chung.
- Điền từ, trắc nghiệm và nối từ giữ màu đúng/sai/chọn qua `data-answer-state`; prompt, badge, spacing và đáp án theo cùng hệ vật liệu. Không thay thuật toán chấm hay lịch FSRS.

Vật liệu trên web kết hợp backdrop blur lấy mẫu màu nền, SVG backdrop displacement tại viền, highlight và bóng. SVG chỉ áp dụng trên lớp trang trí riêng, có mask khoét rỗng ở giữa; chữ và icon không bị displacement. Test Chromium so sánh ảnh của nền sọc có và không có SVG để xác nhận thay đổi pixel ở viền, đồng thời vùng giữa giữ nguyên. Đây vẫn là mô phỏng web; không khẳng định tương đương vật liệu native của Apple hoặc đã hỗ trợ đồng nhất trên mọi engine.

## Tương tác và hiệu năng

`GlassLighting` dùng listener được ủy quyền, lưu vị trí vào CSS variables và cập nhật bằng requestAnimationFrame. Vị trí ánh sáng được làm mượt; vòng animation dừng khi đã ổn định, mục tiêu bị tháo khỏi DOM, cuộn ra khỏi vị trí con trỏ hoặc tab bị ẩn. Chỉ thiết bị có hover và con trỏ chính xác mới chạy ánh sáng; press cập nhật điểm sáng ngay. Chỉ search lớn dùng tilt nhẹ; nội dung không có parallax. Shimmer tạm dừng khi tab bị ẩn.

Các capsule trượt dùng transform và nội suy kích thước. Hiệu ứng hover/press dùng một `transform` kết hợp để giữ kết quả nhất quán sau khi build/minify CSS. Không animate blur trên bảng; hàng và các nút trong hàng không có backdrop filter. Danh sách tiếp tục render theo từng đợt.

Dropdown có listbox được portal, tránh bị cắt bởi content surface; vị trí tự chuyển lên trên khi thiếu chỗ phía dưới. Hỗ trợ Arrow Up/Down, Home/End, Enter/Space, Escape, Tab, tìm theo ký tự, mục bị disabled, click ngoài và trả focus. Tooltip audio cũng dùng portal.

`ModalPresence` giữ panel 160 ms để chạy hiệu ứng đóng và hủy việc tháo panel khi mở lại nhanh. Panel đang đóng trở thành inert ngay. `useModalA11y` khóa cuộn đến khi modal cuối cùng đóng, xử lý focus và Escape cho modal trên cùng, giữ focus khi callback thay đổi và trả focus không kéo trang. Modal mở bằng scale 0.97/translateY 10 px; không animate blur trên chữ. Slider dùng thumb kính nhưng cập nhật giá trị ngay bằng điều khiển native.

Phím `/` đưa focus vào ô tra cứu khi người dùng không đang nhập ở trường khác hoặc mở dialog. Các shortcut hiện có được giữ nguyên.

## Khả năng tiếp cận

- `prefers-reduced-motion`: tắt pointer lighting, tilt, biến dạng và overshoot; giữ fade nhẹ.
- `prefers-reduced-transparency` hoặc `prefers-contrast: more`: vật liệu đặc, viền rõ, tắt sampling.
- `forced-colors`: dùng màu hệ thống cho điều khiển và vùng chọn.
- Focus bàn phím rõ; trạng thái chọn có cả vật liệu, icon/checkmark và ARIA.
- Nút audio, hành động trong hàng, công cụ header và điều khiển modal có vùng chạm tối thiểu 44 px; nhãn speech-rate slider có tên truy cập.
- Theme sáng/tối và ngôn ngữ đã lưu được giữ nguyên.
- Bố cục thích nghi theo chiều rộng, không thu nhỏ đồng loạt; trên màn hình hẹp, hai cột trở thành một và navigation dùng capsule đầy chiều rộng.

## Kiểm tra

Chạy `npm run check` cho lint, typecheck, test và build. Kiểm tra trình duyệt bằng:

```sh
npx playwright test e2e/liquid-glass.spec.ts e2e/study-features.spec.ts
```

Bộ kiểm tra Liquid Glass chụp cả bốn màn hình ở 1920, 1600, 1440, 1280, 1024, 768 và 390 px; kiểm tra theme sáng ở desktop/mobile, dropdown, focus, ánh sáng con trỏ, press, scroll edge, dialog, audio và chế độ giảm chuyển động/tăng tương phản. Bộ study kiểm tra tiếp tục phiên học, luyện lại từ khó, FSRS, TOEIC, nối từ và dictation. Dữ liệu minh họa chỉ được tạo trong browser context riêng của kiểm tra.

Profile requestAnimationFrame trong Chromium headless là phép đo cục bộ, không đảm bảo 60 FPS trên mọi GPU hay thiết bị. Chưa kiểm tra Safari/Firefox hay điện thoại vật lý; kiểm tra cảm ứng dùng context Chromium có `hasTouch`/`isMobile`. Fallback cho thiếu backdrop-filter, giảm transparency và tăng tương phản có sẵn. Panel browser của Codex không mở được do không xác minh được quyền browser; bằng chứng kiểm tra được tạo từ browser context riêng của Playwright, không dùng phiên hay dữ liệu trình duyệt của người dùng.

### Kết quả ngày 02/10/2026

Sau lượt đồng bộ theo ảnh phản hồi: build/typecheck đạt, lint không có lỗi (98 cảnh báo hiện có), 77 file / 524 unit test đạt. Bộ UI có 15 kịch bản, kết hợp 5 regression học tập thành 20/20 kịch bản đạt. Kiểm tra mới bao gồm vị trí và vùng chạm của mọi nút hàng ở 320–1920 px, modal với năm bộ Quizlet/tên dài ở 320–1440 px, vùng cuộn nằm trong viền, header giữ vị trí, bốn tab Nhập/Xuất, chuyển MCQ/tự gõ và phản hồi đúng/sai. Ảnh kiểm tra dùng dữ liệu minh họa trong browser context riêng.

Kiểm tra bổ sung sau lượt tinh chỉnh vật liệu: production build và typecheck đạt; lint không có lỗi, còn cảnh báo hiện có. Toàn bộ 77 file / 524 test đạt khi chạy `npx vitest run --maxWorkers=2`. Lần chạy đồng thời với kiểm tra browser có một timeout ở test heatmap; ca đó đạt khi chạy riêng. Cả 12 kịch bản trong `e2e/liquid-glass.spec.ts` đạt; sau thay đổi accessibility cuối đã chạy lại 5 kịch bản liên quan. Test mới xác nhận phản chiếu tiếp tục qua control lồng nhau, tag chọn/bỏ chọn hoạt động, khúc xạ thay pixel ở viền và giữ nguyên pixel ở giữa. Những kết quả bên dưới ghi lại lượt thiết kế trước đó.

- `npm run check`: thành công; typecheck và production build thành công, 77 file test / 524 test đạt. Lint không có lỗi; còn 98 cảnh báo trong checkout hiện có. Các primitive, hook và test mới được lint riêng, không có cảnh báo.
- Hai bộ Playwright trên production preview: 14/14 test đạt; kịch bản mới về thiết bị cảm ứng và giảm transparency cũng đạt (tổng 15 kịch bản). Sau tinh chỉnh cuối đã chạy lại các kiểm tra responsive, modal và forced-colors.
- Cả bốn màn hình được kiểm tra ở 1920, 1600, 1440, 1280, 1024, 768 và 390 px; theme sáng ở desktop/mobile. Không tràn ngang; modal mobile nằm trong viewport.
- Đã kiểm tra press, pointer light, scroll, capsule trượt, dropdown mở lên/xuống, click ngoài, Escape, focus trap/restore, mở lại modal giữa hiệu ứng đóng, slider, audio/tooltip, phím `/`, empty state và chuyển tab nhanh. Bộ test ghi nhận không có lỗi JavaScript trong các luồng này; 80 từ minh họa còn nguyên sau thao tác.
- Reduced motion, contrast more, forced-colors và reduced transparency đã được kiểm tra trong Chromium. Thao tác tap hoạt động; thiết bị cảm ứng không chạy hover light.
- Bộ regression học xác nhận tiếp tục phiên sau reload, luyện lại từ khó giữ lịch FSRS, TOEIC giữ đáp án đã chọn, nối từ không lặp sự kiện lịch học và dictation giữ riêng lần kiểm tra sai/gợi ý.
- Profile xác nhận các hàng danh sách không có backdrop filter; chỉ 30/80 hàng render ban đầu. Kiểm tra cục bộ không bảo đảm mức FPS trên mọi thiết bị.

## Ảnh và clip

Ảnh dùng dữ liệu minh họa trong browser test, không sửa dữ liệu thật. Clip WebM ghi các thao tác navigation, dropdown, modal, đổi theme và cuộn.

Ảnh sau lượt tinh chỉnh độ trong và phản chiếu: [Dictionary sáng](screenshots/liquid-glass/material-depth-light.png), [Dictionary tối](screenshots/liquid-glass/material-depth-dark.png), [mobile sáng](screenshots/liquid-glass/material-depth-mobile-light.png), [mobile tối](screenshots/liquid-glass/material-depth-mobile-dark.png).

Ảnh sau lượt đồng bộ: [Nhập/Xuất tối](screenshots/liquid-glass/consistency-import-dark.png), [Nhập/Xuất sáng](screenshots/liquid-glass/consistency-import-light.png), [modal mobile](screenshots/liquid-glass/consistency-import-mobile.png), [bảng từ](screenshots/liquid-glass/consistency-deck-dark.png), [điền từ tối](screenshots/liquid-glass/consistency-cloze-dark.png), [điền từ sáng](screenshots/liquid-glass/consistency-cloze-light.png).

- [Tra cứu — sáng](screenshots/liquid-glass/lookup-desktop-light.png), [Tra cứu — tối](screenshots/liquid-glass/lookup-desktop-dark.png)
- [Bộ từ](screenshots/liquid-glass/deck-desktop-dark.png), [Ôn tập](screenshots/liquid-glass/review-desktop-dark.png), [TOEIC](screenshots/liquid-glass/toeic-desktop-dark.png)
- [Ôn tập mobile](screenshots/liquid-glass/review-390-dark.png), [TOEIC mobile](screenshots/liquid-glass/toeic-390-light.png), [Modal mobile](screenshots/liquid-glass/settings-mobile.png)
- [Clip tương tác](screenshots/liquid-glass/interactions.webm)
