# ⚡ LexiPulse - Intelligent English Vocabulary Mastery

> **Hệ thống tra cứu, làm giàu ngữ cảnh và ôn tập từ vựng tiếng Anh chuyên sâu (TOEIC, IELTS & Workplace Communication) ứng dụng thuật toán lặp lại ngắt quãng FSRS v5, công nghệ Phân tích Hình thái học (English Morphology) và Trí tuệ Nhân tạo đa nền tảng.**

[![React](https://img.shields.io/badge/React-19-blue.svg?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.2-purple.svg?logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC.svg?logo=tailwind-css)](https://tailwindcss.com/)
[![Dexie.js](https://img.shields.io/badge/IndexedDB-Dexie.js-orange.svg)](https://dexie.org/)
[![FSRS v5](https://img.shields.io/badge/Spaced_Repetition-FSRS_v5-emerald.svg)](https://github.com/open-spaced-repetition/fsrs4anki)
[![Tests](https://img.shields.io/badge/Tests-155%20passed-brightgreen.svg)](https://vitest.dev/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 🌟 Giới thiệu tổng quan (Overview)

**LexiPulse** là ứng dụng học từ vựng tiếng Anh chuyên sâu xây dựng theo kiến trúc **Local-First / Offline-Capable** trên nền tảng trình duyệt hiện đại (`React 19 + TypeScript + Vite + Dexie.js`). Ứng dụng giải quyết triệt để các hạn chế của phương pháp học từ truyền thống nhờ sự kết hợp giữa:

1. **Hệ thống Nhận diện Hình thái học & Lemma Chuyên sâu (Advanced Morphology & Lemma Engine)**:
   - Thay thế hoàn toàn các thuật toán stemming cắt đuôi cơ học bằng mô hình âm vị học (English Phonotactics) kết hợp AI Disambiguation.
   - Phục hồi chính xác từ nguyên mẫu: `postponing -> postpone`, `making -> make`, `running -> run`, `studies -> study`, `went -> go`, `children -> child`, `better -> good/well`.
   - Phân giải nghĩa theo câu ngữ cảnh thực tế (Context-aware disambiguation), bảo toàn từ dạng biến thể mà người dùng nhập và hỗ trợ chuyển nhanh sang từ gốc chỉ với một chạm.
2. **Động cơ Lặp lại Ngắt quãng FSRS v5 (Free Spaced Repetition Scheduler v5)**:
   - Triển khai thuật toán FSRS v5 chuẩn mực toán học với các đại lượng Độ ổn định (*Stability* - S), Độ khó (*Difficulty* - D) và Xác suất ghi nhớ (*Retrievability* - R) theo số ngày thực tế.
   - Tối ưu hóa chu kỳ ôn tập vượt trội so với thuật toán SM-2 cổ điển, duy trì tỷ lệ nhớ mong muốn (>90%) với số lượt ôn ít hơn.
3. **5 Phương thức Ôn tập Đa giác quan Toàn diện**:
   - Thẻ ghi nhớ 3D (Flashcard), Điền từ vào chỗ trống (Cloze Test), Nghe & Chép chính tả (Dictation), Trắc nghiệm phản xạ (Choice), và Minigame Nối từ siêu tốc (Speed Match).
4. **Cổng kết nối AI Đa nền tảng (Universal AI Gateway)**:
   - Tích hợp linh hoạt Google Gemini, OpenAI, Claude, DeepSeek, Groq, OpenRouter và các Local LLM ngoại tuyến (Ollama, LM Studio).
   - Đo lường độ trễ mạng thời gian thực (Live Ping), lưu trữ API Key an toàn trong Session Storage, và hiển thị rõ nguồn gốc bản dịch (AI vs Dictionary Provenance).
5. **Trải nghiệm Chuyển động Tinh tế (Smooth Motion & Transitions)**:
   - Chuyển đổi mượt mà giữa các màn hình Tra cứu / Bộ từ / Ôn tập không giật lag.
   - Tích hợp chuẩn trợ năng giảm chuyển động `prefers-reduced-motion` tự động tắt hiệu ứng mạnh khi người dùng nhạy cảm.

---

## 🚀 Tính năng nổi bật (Key Features)

### 1. 🧬 Động cơ Hình thái học & Từ nguyên mẫu (Morphology & Lemma Engine)

LexiPulse loại bỏ hoàn toàn lỗi nhận diện từ gốc sai (như `postponing -> postpon` hay `working -> worke`):

- **Giải mã Âm vị học Tiếng Anh (English Phonotactics)**:
  - *Âm tiết mở Silent-e*: `postponing -> postpone`, `making -> make`, `using -> use`, `writing -> write`, `scheduling -> schedule`, `improving -> improve`.
  - *Gấp đôi phụ âm*: `running -> run`, `swimming -> swim`, `planning -> plan`, `stopping -> stop`.
  - *Nguyên âm đôi & Cụm phụ âm không thêm -e*: `reading -> read` (không bao giờ `reade`), `meeting -> meet` (không bao giờ `meete`), `working -> work` (không bao giờ `worke`), `helping -> help`.
  - *Biến đổi y-to-i & số nhiều*: `studies/studied -> study`, `tries/tried -> try`, `companies -> company`, `businesses -> business`, `knives -> knife`.
  - *Bất quy tắc toàn diện*: `went/gone -> go`, `did/done -> do`, `was/were/been -> be`, `bought -> buy`, `children -> child`, `feet -> foot`, `mice -> mouse`.
- **Phân giải theo Ngữ cảnh (Context-Aware Disambiguation)**:
  - `"I saw him yesterday"` ➔ `saw -> see` (Động từ).
  - `"He bought a new saw"` ➔ `saw -> saw` (Danh từ cái cưa).
  - `"We achieved better results"` ➔ `better -> good` (Tính từ so sánh hơn).
  - `"I feel better"` ➔ `better -> well / good` (Hồi phục sức khỏe / cảm giác).
- **Bộ nhớ đệm LRU Ngữ cảnh (Morphology Cache)**:
  - Tự động lưu trữ kết quả phân tích theo `word + context_hash` với TTL 24 giờ, truy xuất <0.1ms.
- **Bảo vệ Chống Cắt Cụt Gốc Từ (`SUSPICIOUS_TRUNCATED_STEMS`)**:
  - Tự động phát hiện và sửa chữa các lỗi stem vô nghĩa trước khi hiển thị cho người học.

---

### 2. 🔍 Pipeline Tra cứu 4 tầng Siêu tốc (4-Tier Lookup & Enrichment)

Hệ thống kết hợp đa nguồn đồng thời để mang lại tốc độ tức thì và chiều sâu nội dung:

```
User Input ➔ [Tier 0: LRU Cache <0.1ms]
          ➔ [Tier 1: IndexedDB <2ms]
          ➔ [Tier 2: Local Knowledge Base 4,000+ từ <0.5ms]
          ➔ [Tier 3: Online CDN Dictionaries <400ms]
          ➔ [AI Tier: Multi-Provider Enrichment song song]
```

- **Phiên âm ngữ âm chuẩn quốc tế (IPA Resolution)**:
  - Hỗ trợ cả từ đơn và cụm từ ghép phức hợp (*floral arrangement*, *take into account*).
  - Phân biệt rõ phiên âm của từ biến thể người dùng tra (`postponing` /poʊˈspoʊnɪŋ/) và từ nguyên mẫu (`postpone` /poʊˈspoʊn/).
  - Tích hợp audio phát âm bản xứ cả hai giọng **Anh - Mỹ (US)** và **Anh - Anh (UK)**.
- **Bóc tách Đa tầng nghĩa (Multi-Sense Engine)**:
  - Nhận diện và đánh số thứ tự rõ ràng từng nét nghĩa (`1`, `2`, `3`...) cho các từ đa nghĩa (Polysemy).
- **Sửa lỗi chính tả thông minh (Fuzzy Search & Levenshtein)**:
  - Tự động gợi ý từ đúng khi gõ sai chính tả dựa trên khoảng cách ký tự và âm vị.
- **Cụm từ Collocations & Họ từ liên kết (Word Family)**:
  - Khám phá các dạng danh từ, động từ, tính từ, trạng từ liên quan và tra cứu chỉ với 1 cú click.

---

### 3. 🗂️ 5 Chế độ Ôn tập FSRS v5 Toàn diện

| Chế độ ôn tập | Mô tả chi tiết | Kỹ năng rèn luyện | Phím tắt hỗ trợ |
| :--- | :--- | :--- | :--- |
| 🗂️ **Flashcard 3D** | Lật thẻ 3 chiều. Đánh giá 4 mức (*Học lại, Khó, Tốt, Dễ*) với dự báo ngày ôn tiếp theo. | Khả năng hồi tưởng chủ động (Active Recall) | `Space` lật thẻ, `1`-`4` đánh giá |
| 📝 **Điền từ ngữ cảnh (Cloze)** | Chọn từ điền vào chỗ trống trong câu ngữ cảnh TOEIC/công sở thực tế. | Hiểu và vận dụng từ trong ngữ cảnh | `1`-`4` chọn đáp án |
| 🎧 **Nghe chép chính tả (Dictation)** | Nghe audio bản xứ, điều chỉnh tốc độ `0.75x`, gợi ý ký tự thông minh. | Thính giác & Độ chuẩn xác chính tả | `Ctrl + Space` nghe lại |
| 🎯 **Trắc nghiệm phản xạ (Choice)** | Trắc nghiệm 4 đáp án với các phương án gây nhiễu ngữ nghĩa thông minh. | Phản xạ nhận diện từ tức thì | `1`-`4` chọn nhanh |
| ⚡ **Nối từ siêu tốc (Speed Match)** | Ghép nhanh 5 cặp thẻ Anh - Việt, tính combo liên hoàn và thời gian. | Tốc độ kết nối ngữ nghĩa | Nhấp chuột / Chạm |

---

### 4. 🤖 Cổng kết nối AI Toàn diện (Universal AI Gateway)

- 🔷 **Google Gemini**: Hỗ trợ `gemini-2.5-flash`, `gemini-1.5-flash`, `gemini-1.5-pro`.
- 🟢 **OpenAI**: Hỗ trợ `gpt-4o`, `gpt-4o-mini`, `gpt-3.5-turbo`.
- 🟣 **Anthropic Claude**: Hỗ trợ `claude-3-5-haiku-20241022`, `claude-3-5-sonnet-20241022`.
- 🔵 **DeepSeek**: Hỗ trợ `deepseek-chat`, `deepseek-reasoner` qua endpoint OpenAI-compatible.
- ⚡ **Groq**: Phản xạ cực nhanh với `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`.
- 🌐 **OpenRouter**: Truy cập hơn 200+ mô hình AI toàn cầu.
- 🖥️ **Ollama / Local LLM**: Chạy mô hình offline ngay trên máy cá nhân không cần mạng (`http://localhost:11434/v1`).
- **Live Ping Latency**: Đo kiểm tra độ trễ mạng thực tế và tính hợp lệ của API Key ngay trong Settings.

---

### 5. 📊 Quản lý Bộ từ & Biểu đồ đóng góp (Deck & Analytics)

- **Biểu đồ đóng góp 365 ngày (Contribution Heatmap)**:
  - Theo dõi tiến độ học tập liên tục theo phong cách GitHub Heatmap với 5 cấp độ chuyên cần.
  - Hỗ trợ đổi năm và xem chi tiết số từ học/ôn từng ngày qua tooltip.
- **Thanh đo lường Spaced Repetition**:
  - Thống kê thời gian thực: Cần ôn hôm nay (*Due Today*), Đang học (*Learning*), Đã thuần thục (*Mastered*).
- **Bộ lọc từ vựng đa tiêu chí**:
  - Tìm kiếm nhanh, lọc theo Tags, sắp xếp theo mức khẩn cấp ôn tập hoặc chữ cái.
- **Nhập / Xuất dữ liệu đa dạng**:
  - Nhập hàng loạt qua danh sách văn bản.
  - Nhập / Xuất bảng tính Excel (`.xlsx`), file `.csv`.
  - Sao lưu và phục hồi trọn vẹn cơ sở dữ liệu qua file `.json`.

---

## 📂 Cấu trúc thư mục (Project Structure)

```text
lexipulse/
├── src/
│   ├── components/
│   │   ├── common/              # Các component giao diện dùng chung
│   │   │   ├── AudioButton.tsx          # Nút phát âm bản xứ US/UK
│   │   │   ├── Header.tsx               # Header, thanh điều hướng & chuyển tab
│   │   │   ├── SettingsModal.tsx        # Cấu hình AI, FSRS, mục tiêu học
│   │   │   ├── ShortcutsModal.tsx       # Bảng phím tắt tiện ích
│   │   │   └── WordFamilyInteractive.tsx# Họ từ liên kết tương tác
│   │   ├── deck/                # Quản lý kho từ vựng cá nhân
│   │   │   ├── ContributionHeatmap.tsx  # Biểu đồ chuyên cần 365 ngày
│   │   │   ├── DeckHeader.tsx           # Thanh tìm kiếm & lọc bộ từ
│   │   │   ├── DeckStats.tsx            # Thống kê phân bổ FSRS
│   │   │   ├── ImportExportModal.tsx    # Nhập/xuất Excel, CSV, JSON
│   │   │   ├── WordDetailModal.tsx      # Modal chi tiết từ & liên kết từ gốc
│   │   │   └── WordListItem.tsx         # Dòng hiển thị từ trong danh sách
│   │   ├── lookup/              # Giao diện tra cứu
│   │   │   ├── EditableWordModal.tsx    # Chỉnh sửa từ trước khi lưu
│   │   │   ├── SearchBar.tsx            # Thanh tra từ & gợi ý chính tả
│   │   │   └── WordCard.tsx             # Thẻ hiển thị từ vựng, lemma & nghĩa
│   │   └── review/              # Hệ thống ôn tập 5 chế độ
│   │       ├── Flashcard.tsx            # Chế độ Flashcard 3D
│   │       ├── ReviewChoice.tsx         # Chế độ trắc nghiệm phản xạ
│   │       ├── ReviewComplete.tsx       # Màn hình chúc mừng hoàn thành
│   │       ├── ReviewDashboard.tsx      # Dashboard chọn chế độ ôn
│   │       ├── ReviewListening.tsx      # Chế độ nghe chép chính tả
│   │       ├── ReviewMatch.tsx          # Minigame nối từ siêu tốc
│   │       └── ReviewQuiz.tsx           # Chế độ điền từ ngữ cảnh
│   ├── features/                # Màn hình chức năng chính (Code-split)
│   │   ├── deck/DeckView.tsx            # Màn hình Bộ từ vựng
│   │   ├── lookup/LookupView.tsx        # Màn hình Tra cứu
│   │   └── review/ReviewView.tsx        # Màn hình Ôn tập
│   ├── hooks/                   # Custom Hooks
│   │   ├── usePrefersReducedMotion.ts   # Tự động hỗ trợ trợ năng giảm chuyển động
│   │   ├── useSpacedRepetition.ts       # Hook FSRS v5 quản lý lịch ôn
│   │   └── useVocabulary.ts             # Hook quản lý kho từ Dexie IndexedDB
│   ├── services/
│   │   ├── ai/
│   │   │   ├── aiCache.ts               # In-memory LRU cache AI
│   │   │   └── aiMorphology.ts          # Service AI Morphology & Guardrails
│   │   ├── fsrs/
│   │   │   ├── fsrsService.ts           # Thuật toán FSRS v5 chuẩn mực
│   │   │   └── fsrsMigration.ts         # Migration an toàn từ dữ liệu cũ
│   │   ├── morphology/
│   │   │   └── lemmatizer.ts            # NLP Lemmatizer & English Phonotactics
│   │   ├── ai.ts                        # Universal AI Gateway (7 providers)
│   │   ├── dictionary.ts                # Tra cứu từ điển đa tầng
│   │   ├── enrichmentPipeline.ts        # Điều phối Pipeline kết hợp Morphology + Dict + AI
│   │   └── vocabRepository.ts           # Bảo vệ toàn vẹn dữ liệu từ vựng
│   ├── types/
│   │   └── vocab.ts                     # Định nghĩa kiểu dữ liệu TypeScript
│   ├── App.tsx                          # Root component & Animation Orchestrator
│   └── index.css                        # Design system tokens & Tailwind utilities
├── tests/                               # Bộ kiểm thử tự động
│   ├── ai_morphology_and_lemma.test.ts  # 54 test cases hình thái học & lemma
│   ├── morphology_ui_integration.test.tsx # Kiểm thử UI hiển thị lemma & nút từ gốc
│   ├── navigation_motion_and_pipeline_fixes.test.tsx # Kiểm thử chuyển tab & reduced motion
│   └── ... (19 test suites, 155 tests)
├── package.json                         # Scripts & Dependencies
├── tailwind.config.js                   # Cấu hình Tailwind theme & animations
└── vite.config.ts                       # Cấu hình Vite bundler & build chunks
```

---

## 💻 Hướng dẫn Cài đặt & Khởi chạy (Getting Started)

### Yêu cầu môi trường
- **Node.js**: Phiên bản 18.0.0 trở lên (khuyến nghị Node 20+ hoặc 22+).
- **npm** (hoặc `pnpm` / `yarn`).

### 1. Cài đặt các gói phụ thuộc
```bash
npm install
```

### 2. Khởi chạy Development Server
```bash
npm run dev
```
Mở trình duyệt tại: **`http://localhost:5173/`**

### 3. Đóng gói sản phẩm (Production Build)
```bash
npm run build
```
Bản build tối ưu hóa sẽ được tạo trong thư mục `dist/`. Chạy thử bản build:
```bash
npm run preview
```

### 4. Chạy bộ kiểm thử (Verification Suite)
```bash
# Kiểm tra TypeScript Types nghiêm ngặt
npm run typecheck

# Kiểm tra cú pháp mã nguồn
npm run lint

# Chạy toàn bộ 155 unit & regression tests
npm run test
```

---

## 🛠️ Công nghệ sử dụng (Tech Stack)

- **Frontend Core**: [React 19](https://react.dev/), [TypeScript 6](https://www.typescriptlang.org/), [Vite 8](https://vitejs.dev/)
- **Styling & Icons**: [Tailwind CSS 3.4](https://tailwindcss.com/), [Lucide React](https://lucide.dev/)
- **Local Database**: [Dexie.js](https://dexie.org/) (Reactive IndexedDB wrapper)
- **Spaced Repetition Algorithm**: [FSRS v5](https://github.com/open-spaced-repetition/fsrs4anki)
- **Testing**: [Vitest](https://vitest.dev/), [@testing-library/react](https://testing-library.com/), [Playwright](https://playwright.dev/)
- **Spreadsheet Processing**: [SheetJS (xlsx)](https://docs.sheetjs.com/) (Dynamic import theo nhu cầu, bundle initial < 500 kB)

---

## 🔒 Bảo mật & Quyền riêng tư (Security & Privacy)

- **Nguyên tắc Local-First**: Dữ liệu thẻ từ vựng, tiến trình ôn tập FSRS và lịch sử học tập được lưu trữ hoàn toàn trong trình duyệt của bạn (IndexedDB).
- **Bảo vệ API Key**:
  - API Key được lưu mặc định trong **Session Storage** (tự động giải phóng khi đóng tab).
  - LexiPulse không gửi API Key hay dữ liệu từ vựng cá nhân về bất kỳ máy chủ trung gian nào. Các cuộc gọi AI được thực hiện trực tiếp từ trình duyệt đến nhà cung cấp AI do bạn cấu hình.

---

## 📄 Giấy phép (License)

Dự án được phát hành theo giấy phép mã nguồn mở **[MIT License](LICENSE)**. Mọi đóng góp (Issues & Pull Requests) đều được chào đón!
