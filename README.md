# ⚡ LexiPulse - Intelligent English Vocabulary Mastery

> **Hệ thống tra cứu, làm giàu ngữ cảnh và ôn tập từ vựng tiếng Anh chuyên sâu (TOEIC, IELTS & Workplace Communication) ứng dụng thuật toán lặp lại ngắt quãng SM-2 và Trí tuệ Nhân tạo đa nền tảng.**

[![React](https://img.shields.io/badge/React-19-blue.svg?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.2-purple.svg?logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC.svg?logo=tailwind-css)](https://tailwindcss.com/)
[![Dexie.js](https://img.shields.io/badge/IndexedDB-Dexie.js-orange.svg)](https://dexie.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 🌟 Giới thiệu tổng quan (Overview)

**LexiPulse** là ứng dụng học từ vựng tiếng Anh cao cấp hoạt động **100% Offline-First** trên nền tảng trình duyệt. Được thiết kế tối ưu cho người học luyện thi chứng chỉ **TOEIC, IELTS** và người đi làm trong môi trường quốc tế, LexiPulse kết hợp giữa:
- **Động cơ ngôn ngữ đa tầng (Multi-Tier Linguistic Pipeline)** với khả năng tra cứu siêu tốc (<400ms).
- **Thuật toán Spaced Repetition (SuperMemo-2 / SM-2)** giúp khắc phục đường cong lãng quên (Ebbinghaus Forgetting Curve).
- **Hệ thống ôn tập đa giác quan 5 chế độ**: Flashcard 3D, Điền từ ngữ cảnh (Cloze), Nghe & Chép chính tả (Dictation), Trắc nghiệm phản xạ (Choice), và Nối từ siêu tốc (Speed Match).
- **Cổng kết nối AI toàn năng (Universal AI Engine)** hỗ trợ đồng thời Google Gemini, OpenAI (ChatGPT), Anthropic Claude, DeepSeek, Groq, OpenRouter và các Local LLM (Ollama, LM Studio).

---

## 🚀 Tính năng nổi bật (Key Features)

### 1. 🔍 Động cơ tra cứu & Ngôn ngữ học thông minh (Linguistic Engine)
- **Pipeline tra cứu 4 tầng tối ưu tốc độ**:
  - *Tier 0*: Bộ nhớ đệm In-Memory LRU Cache (<0.1ms).
  - *Tier 1*: Cơ sở dữ liệu IndexedDB nội bộ (<2ms).
  - *Tier 2*: Kho tri thức TOEIC ngoại tuyến tuyển chọn sẵn (`LOCAL_KNOWLEDGE_BASE`) (<0.5ms).
  - *Tier 3*: Truy vấn song song dữ liệu từ điển nguồn mở Open-VN-EN-Dict (CDN), Datamuse API, Wiktionary và Google Translate (<400ms).
- **Phiên âm ngữ âm chuẩn quốc tế (IPA Resolution)**:
  - Tự động bóc tách và tạo phiên âm IPA chuẩn cho cả từ đơn và các **cụm từ/thành ngữ phức hợp** (Idioms / Collocations như *floral arrangement*, *take into account*, *customer service*).
  - Tích hợp nút phát âm bản xứ cả hai chất giọng **Anh - Mỹ (US)** và **Anh - Anh (UK)**.
- **Bóc tách đa tầng nghĩa (Multi-Sense Definition Engine)**:
  - Tự động nhận diện và hiển thị rõ ràng từng nét nghĩa được đánh số thứ tự (`1`, `2`, `3`,...) cho các từ đa nghĩa (Polysemous words như `pool` = hồ bơi / nhóm nhân tài / quỹ chung; `board` = bảng / ban giám đốc / lên tàu xe).
- **Khắc phục lỗi gõ sai chính tả (Intelligent Typo Correction & Fuzzy Search)**:
  - Tích hợp thuật toán đối sánh xấp xỉ khoảng cách Levenshtein kết hợp đối sánh ngữ âm (Sounds-like), tự động đưa ra các gợi ý chính xác khi người dùng gõ sai.
- **Họ từ tương tác (Word Family Interactive)**:
  - Nhận diện đầy đủ danh từ, động từ, tính từ, trạng từ liên quan; cho phép bấm tra cứu hoặc thêm nhanh vào bộ từ chỉ với 1 click.
- **Cụm từ thông dụng & Ví dụ môi trường làm việc**:
  - Trích xuất tự động Collocations và câu ví dụ TOEIC/Business thực tế.

---

### 2. 🗂️ 5 Phương thức ôn tập toàn diện (Spaced Repetition System)

LexiPulse triển khai thuật toán **SuperMemo-2 (SM-2)** chuẩn xác với Ease Factor (EF), số lần lặp (Repetition) và khoảng cách chu kỳ ôn tập (Interval). Người học có thể linh hoạt chuyển đổi giữa 5 chế độ ngay trong phiên học:

| Chế độ ôn tập | Mô tả chi tiết | Kỹ năng rèn luyện |
| :--- | :--- | :--- |
| 🗂️ **Thẻ Flashcard 3D** | Lật thẻ 3 chiều mượt mà (`Space`). Chấm điểm SM-2 (`1: Học lại`, `2: Nhớ tốt`, `3: Quá dễ`) với dự báo chu kỳ ngày kế tiếp. | Khả năng hồi tưởng chủ động (Active Recall) |
| 📝 **Điền từ ngữ cảnh (Cloze Test)** | Điền từ mục tiêu vào chỗ trống trong câu đề thi TOEIC/công sở thực tế qua 4 đáp án hoặc gõ phím trực tiếp. | Hiểu nghĩa trong ngữ cảnh thực tế |
| 🎧 **Nghe & Chép chính tả (Dictation)** | Tự động phát âm audio giọng bản xứ; hỗ trợ điều chỉnh tốc độ chậm `0.75x`, phím tắt `Ctrl+Space` nghe lại và hệ thống gợi ý ký tự. | Thính giác & Độ chính xác chính tả |
| 🎯 **Trắc nghiệm phản xạ (Choice)** | Trắc nghiệm 4 đáp án chọn nghĩa tiếng Việt nhanh với các đáp án gây nhiễu thông minh. Hỗ trợ phím số `1`, `2`, `3`, `4`. | Phản xạ nhận diện từ vựng tức thì |
| ⚡ **Nối từ siêu tốc (Speed Match)** | Minigame ghép 5 cặp từ Anh - Việt (10 thẻ) tính combo liên hoàn và thời gian hoàn thành. Tự động tính điểm SM-2 theo số lỗi. | Tốc độ liên kết ngữ nghĩa & Tăng hứng thú |

---

### 3. 🤖 Cổng kết nối AI toàn diện (Universal AI Engine)

Không bị giới hạn trong một nhà cung cấp duy nhất, LexiPulse cho phép tích hợp bất kỳ mô hình AI nào:
- 🔷 **Google Gemini**: Hỗ trợ `gemini-2.5-flash`, `gemini-1.5-flash`, `gemini-1.5-pro`.
- 🟢 **OpenAI (ChatGPT)**: Hỗ trợ `gpt-4o-mini`, `gpt-4o`, `gpt-3.5-turbo`.
- 🟣 **Anthropic Claude**: Hỗ trợ `claude-3-5-haiku-20241022`, `claude-3-5-sonnet-20241022`.
- 🔵 **DeepSeek**: Hỗ trợ `deepseek-chat`, `deepseek-reasoner` qua endpoint OpenAI-compatible.
- ⚡ **Groq (Ultra-Fast)**: Tốc độ phản hồi cực nhanh với `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`.
- 🌐 **OpenRouter**: Truy cập hơn 200+ mô hình AI toàn cầu với hóa đơn thống nhất.
- 🖥️ **Tùy chỉnh / Ollama / Local LLM**: Chạy hoàn toàn ngoại tuyến không cần internet với các mô hình nội bộ trên máy cá nhân qua Ollama (`http://localhost:11434/v1`), LM Studio, vLLM.
- **Kiểm tra kết nối trực tiếp (Live Ping)**: Đo lường độ trễ (latency ms) và xác thực API Key / Base URL theo thời gian thực.

---

### 4. 📊 Quản lý Bộ từ & Biểu đồ đóng góp (Deck & Analytics)
- **Biểu đồ đóng góp 365 ngày (Contribution Heatmap)**:
  - Trực quan hóa tiến độ học tập liên tục theo phong cách GitHub Heatmap với 5 mức độ chuyên cần.
  - Cho phép chuyển đổi linh hoạt các năm và xem chi tiết số từ học / số lượt ôn tập từng ngày qua tooltip.
- **Thanh đo lường Spaced Repetition**:
  - Theo dõi tổng số từ, số từ cần ôn hôm nay (Due Today), số từ đang học (Learning), số từ đã thuần thục (Mastered) và tỷ lệ phân bổ trực quan.
- **Bộ lọc từ vựng đa tiêu chí**:
  - Tìm kiếm theo từ khóa, lọc theo nhãn thẻ (Tags), lọc theo ngày thêm từ, sắp xếp theo mức độ khẩn cấp, bảng chữ cái hoặc số lần lặp lại.
- **Mục tiêu học tập hàng ngày tùy biến (Custom Daily Quota)**:
  - Nhập số lượng từ mục tiêu mong muốn (ví dụ 8, 20, 30, 50, 100 từ/ngày) hoặc chọn nhanh qua các chip gợi ý.
- **Nhập / Xuất dữ liệu đa định dạng (Import/Export)**:
  - Thêm từ hàng loạt qua văn bản.
  - Nhập / Xuất bảng tính Excel (`.xlsx`), file `.csv`.
  - Sao lưu và phục hồi toàn bộ tiến trình học qua file `.json`.

---

### 5. 🎨 Giao diện & Trải nghiệm (UI/UX)
- **Thiết kế tối ưu cho học tập**: Giao diện mang tông màu Slate trầm tính kết hợp điểm nhấn Indigo và trạng thái Emerald, tránh gây mỏi mắt trong các phiên học kéo dài.
- **Chế độ Sáng / Tối (Dark / Light Mode)** hoàn thiện và đồng nhất trên toàn bộ các modal, bảng số liệu và thẻ ôn tập.
- **Hỗ trợ song ngữ hoàn toàn**: Chuyển đổi tức thì giữa Tiếng Việt (🇻🇳) và English (🇬🇧).
- **Hệ thống phím tắt toàn năng (Keyboard Shortcuts)**:
  - `Alt + 1`: Chuyển đến màn hình Tra cứu (Lookup).
  - `Alt + 2`: Chuyển đến màn hình Bộ từ (My Deck).
  - `Alt + 3`: Chuyển đến màn hình Ôn tập (SRS Review).
  - `/`: Focus nhanh vào thanh tìm kiếm từ bất kỳ đâu.
  - `Space`: Lật thẻ Flashcard.
  - `1`, `2`, `3`: Đánh giá mức độ nhớ trong Flashcard.
  - `1`, `2`, `3`, `4`: Chọn đáp án trắc nghiệm trong chế độ Quiz / Choice.
  - `Ctrl + Space`: Nghe lại âm thanh phát âm.

---

## 📂 Cấu trúc thư mục (Project Structure)

```text
voc/
├── src/
│   ├── components/
│   │   ├── common/              # Các component dùng chung
│   │   │   ├── AudioButton.tsx          # Nút phát âm bản xứ (US/UK)
│   │   │   ├── Badge.tsx                # Huy hiệu trạng thái từ vựng
│   │   │   ├── Header.tsx               # Thanh điều hướng chính & phím tắt
│   │   │   ├── SettingsModal.tsx        # Modal cấu hình AI, giọng đọc, mục tiêu
│   │   │   ├── ShortcutsModal.tsx       # Bảng tra cứu phím tắt
│   │   │   └── WordFamilyInteractive.tsx# Họ từ tương tác chống tràn viền
│   │   ├── deck/                # Quản lý kho từ vựng cá nhân
│   │   │   ├── ContributionHeatmap.tsx  # Biểu đồ học tập 365 ngày
│   │   │   ├── DeckHeader.tsx           # Thanh tìm kiếm & bộ lọc bộ từ
│   │   │   ├── DeckStats.tsx            # Thống kê tiến độ Spaced Repetition
│   │   │   ├── ImportExportModal.tsx    # Nhập/xuất Excel, CSV, JSON
│   │   │   ├── WordDetailModal.tsx      # Modal chi tiết từ & chỉnh sửa
│   │   │   └── WordListItem.tsx         # Hàng hiển thị từ trong danh sách
│   │   ├── lookup/              # Màn hình tra cứu từ điển
│   │   │   ├── EditableWordModal.tsx    # Chỉnh sửa từ trước khi lưu
│   │   │   ├── SearchBar.tsx            # Thanh tìm kiếm & gợi ý chính tả
│   │   │   └── WordCard.tsx             # Thẻ hiển thị từ vựng & đa nghĩa
│   │   └── review/              # Hệ thống ôn tập 5 chế độ
│   │       ├── Flashcard.tsx            # Chế độ Flashcard 3D
│   │       ├── ReviewChoice.tsx         # Chế độ trắc nghiệm 4 đáp án
│   │       ├── ReviewComplete.tsx       # Màn hình tổng kết phiên học & pháo hoa
│   │       ├── ReviewDashboard.tsx      # Dashboard chọn chế độ ôn tập
│   │       ├── ReviewListening.tsx      # Chế độ nghe chép chính tả
│   │       ├── ReviewMatch.tsx          # Chế độ minigame nối từ siêu tốc
│   │       └── ReviewQuiz.tsx           # Chế độ điền từ ngữ cảnh (Cloze)
│   ├── context/
│   │   └── LanguageContext.tsx  # Context quản lý ngôn ngữ giao diện (VI/EN)
│   ├── hooks/
│   │   ├── useSpacedRepetition.ts # Hook tính toán lượt ôn tập & hàng đợi SM-2
│   │   └── useVocabulary.ts     # Hook quản lý kho từ Dexie IndexedDB
│   ├── i18n/
│   │   └── translations.ts      # Toàn bộ từ điển ngôn ngữ VI/EN
│   ├── services/
│   │   ├── ai.ts                # Tích hợp Universal AI (7 nhà cung cấp)
│   │   ├── audio.ts             # Web Speech API & TTS audio player
│   │   ├── db.ts                # Cơ sở dữ liệu Dexie IndexedDB
│   │   ├── dictionary.ts        # Động cơ tra cứu ngôn ngữ đa tầng
│   │   └── sm2.ts               # Thuật toán Spaced Repetition SuperMemo-2
│   ├── types/
│   │   └── vocab.ts             # Toàn bộ TypeScript interfaces & types
│   ├── utils/
│   │   ├── dateUtils.ts         # Xử lý múi giờ địa phương chuẩn xác (UTC+7)
│   │   ├── definitionUtils.ts   # Bóc tách và định dạng đa tầng nghĩa
│   │   └── fuzzySearch.ts       # Thuật toán tìm kiếm xấp xỉ & sửa lỗi gõ
│   ├── App.tsx                  # Root component kết nối các màn hình
│   ├── index.css                # CSS Variables & Tailwind utilities
│   └── main.tsx                 # Điểm khởi chạy React
├── package.json                 # Cấu hình gói và dependencies
├── tailwind.config.js           # Cấu hình Tailwind theme, colors, animations
├── tsconfig.json                # Cấu hình TypeScript
└── vite.config.ts               # Cấu hình Vite bundler & proxies
```

---

## 💻 Hướng dẫn cài đặt & Khởi chạy (Getting Started)

### Yêu cầu hệ thống
- **Node.js**: Phiên bản 18.0.0 trở lên (khuyến nghị Node 20+ hoặc 22+).
- **npm** (hoặc `yarn` / `pnpm` / `bun`).

### 1. Cài đặt các gói phụ thuộc
Mở terminal tại thư mục dự án và chạy lệnh:
```bash
npm install
```

### 2. Khởi chạy môi trường phát triển (Development Server)
```bash
npm run dev
```
Sau khi khởi chạy thành công, mở trình duyệt và truy cập:
👉 **`http://localhost:5173/`**

### 3. Đóng gói bản phát hành sản phẩm (Production Build)
```bash
npm run build
```
Bản build sản phẩm đã được tối ưu hóa dung lượng sẽ được xuất tại thư mục `dist/`. Bạn có thể kiểm tra bản build bằng lệnh:
```bash
npm run preview
```

### 4. Kiểm tra chất lượng mã nguồn (Linting)
Dự án sử dụng công cụ linter siêu tốc **Oxlint**:
```bash
npm run lint
```

---

## 🛠️ Công nghệ sử dụng (Tech Stack)

- **Ngôn ngữ & Nền tảng**: [React 19](https://react.dev/), [TypeScript 6](https://www.typescriptlang.org/), [Vite 8](https://vitejs.dev/)
- **Tạo kiểu & Giao diện**: [Tailwind CSS 3.4](https://tailwindcss.com/), [Lucide React](https://lucide.dev/)
- **Lưu trữ dữ liệu cục bộ**: [Dexie.js](https://dexie.org/) (IndexedDB wrapper có khả năng reactive live query)
- **Hiệu ứng & Hoạt ảnh**: [Canvas-Confetti](https://www.npmjs.com/package/canvas-confetti), CSS 3D Transforms
- **Xử lý tệp & Dữ liệu**: [SheetJS (xlsx)](https://docs.sheetjs.com/) cho xuất/nhập Excel
- **Ngữ âm & Âm thanh**: Web Speech API, Google Translate TTS CDN, Datamuse Linguistic API

---

## 🔒 Bảo mật & Quyền riêng tư (Privacy & Security)

- **100% Lưu trữ trên máy người dùng (Local Storage First)**: Toàn bộ danh sách từ vựng, lịch sử ôn tập và thống kê đều được lưu trữ an toàn trong IndexedDB của trình duyệt. Không có dữ liệu cá nhân nào bị gửi về máy chủ bên ngoài.
- **Khóa API bảo mật**: API Key của các dịch vụ AI (Gemini, OpenAI, Claude, v.v.) chỉ được lưu trữ cục bộ trong trình duyệt của bạn và chỉ được gửi trực tiếp tới máy chủ chính thức của nhà cung cấp AI khi bạn thực hiện tra cứu.
- **Hỗ trợ hoàn toàn ngoại tuyến**: Ứng dụng hoạt động mượt mà ngay cả khi ngắt kết nối Internet với kho từ điển tích hợp sẵn và bộ nhớ đệm cục bộ.

---

## 📄 Giấy phép (License)

Dự án được phát hành theo giấy phép mã nguồn mở **MIT License**. Mọi đóng góp và cải tiến đều được hoan nghênh!
