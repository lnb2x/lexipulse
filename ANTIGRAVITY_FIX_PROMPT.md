# Prompt sửa LexiPulse cho Antigravity — model 3.8 theo lựa chọn của người dùng

Sao chép phần dưới vào Antigravity. Chọn model 3.8 trong giao diện nếu đó là model bạn đang dùng; tài liệu này không xác nhận tên hoặc khả năng của một model cụ thể.

---

Bạn đang làm việc trong dự án LexiPulse, ứng dụng học từ vựng React/TypeScript/Vite/Dexie. Hãy sửa trực tiếp các lỗi dưới đây, kiểm thử và báo cáo kết quả. Không chỉ đưa ra kế hoạch.

## Phạm vi và nguyên tắc

- Đọc hướng dẫn dự án, git status và diff hiện tại trước khi sửa. Có nhiều thay đổi chưa commit của người dùng: giữ chúng, không reset/checkout đè file, không viết lại toàn bộ ứng dụng.
- Ưu tiên: bản dịch và nguồn dữ liệu đúng → kết nối luồng AI/ngữ cảnh → bảo toàn dữ liệu → câu chữ → cảnh báo kỹ thuật.
- Giữ kiến trúc local-first và lịch ôn FSRS hiện tại. Không đổi thuật toán, reset database, đổi ID thẻ hoặc gộp từ chỉ vì chúng có cùng lemma.
- Không dùng API trả phí hoặc khóa thật để kiểm thử tự động. Mock phản hồi và thời gian hoàn thành của các dịch vụ.
- Xác minh lại các vị trí nêu dưới đây vì mã có thể đã thay đổi. Nếu lỗi đã được sửa, kiểm tra regression thay vì sửa trùng.

## 1. Bản dịch AI bị chặn khi cập nhật giao diện — ưu tiên cao

Bằng chứng: `src/App.tsx`, handleSearch/onEnriched, khoảng dòng 205–230. Phép gộp hiện tại dùng:

    vietnameseDefinition: prev.vietnameseDefinition || enrichedWord.vietnameseDefinition

Khi nghĩa ban đầu đã có nội dung, nghĩa AI về sau không được hiển thị. `src/services/dictionary.ts` khoảng dòng 301 lại nhận nghĩa AI; cache, giao diện và dữ liệu lưu vì vậy có thể không thống nhất. Phần đồng bộ nền vào repository khoảng dòng 338 chỉ truyền một số trường, bỏ nghĩa Việt và dữ liệu hình thái mới.

Yêu cầu:

- Xác định chính sách chọn nội dung theo nguồn và quyền chỉnh sửa của người dùng; không dùng chuỗi có/không có để quyết định chất lượng.
- Khi ưu tiên AI được bật, áp dụng bản dịch AI hợp lệ vào UI. Khi AI thất bại, giữ nghĩa từ điển hợp lệ và thông báo trạng thái phù hợp.
- Thống nhất nghĩa chính, meanings, phiên âm, lemma, ví dụ và nguồn dữ liệu sau khi làm giàu; không để các phần mô tả những nghĩa hoặc dạng từ khác nhau mà không ghi rõ.
- Kết quả cũ không được cập nhật UI hay lưu đè kết quả của truy vấn mới. Bảo toàn chỉnh sửa thủ công, tags và notes ngay cả khi phản hồi nền đến muộn.
- Xử lý trường hợp người dùng lưu thẻ trước khi AI hoàn thành, rồi tải lại trang. Chính sách cập nhật phải nhất quán, không ghi đè nội dung họ vừa sửa.

## 2. Nhãn “Dịch bằng AI” phải phản ánh nguồn thật — ưu tiên cao

Bằng chứng: `src/services/dictionary.ts` khoảng dòng 645 gán `source: openVnData ? 'online' : 'ai'`. Nhánh không có openVnData chưa chứng minh đã nhận kết quả từ mô hình AI. `WordCard.tsx` có biểu tượng Sparkles cố định cạnh phần nghĩa, chưa có nhãn nguồn bản dịch dựa trên provenance. `enrichmentPipeline.ts` trả `sourceVi` riêng, chưa lưu nguồn nghĩa Việt trong WordItem.

Yêu cầu:

- Theo dõi nguồn của chính nghĩa Việt: AI, từ điển, dịch máy, người dùng sửa, hoặc chưa xác định. Không suy ra AI từ việc thiếu từ điển hay từ một icon.
- Chỉ hiện “Dịch bằng AI” / “AI translation” khi nghĩa đang hiển thị thực sự do mô hình AI tạo ra. Nếu chỉ ví dụ được tạo bằng AI, không gắn nhãn AI cho nghĩa từ điển.
- Có thể xem nhà cung cấp, model và thời điểm tạo nếu có dữ liệu thật. Không ghi API key/token vào metadata, cache key, log hoặc backup.
- Khi người dùng sửa nghĩa, hiển thị trạng thái đã chỉnh sửa; có thể giữ nguồn gốc để tham khảo nhưng không làm người dùng hiểu rằng nội dung mới chưa qua sửa là bản dịch AI nguyên bản.
- Giữ provenance qua save/update/reload và JSON backup/restore. Dữ liệu cũ thiếu nguồn được xem là chưa xác định, không tự nhận là AI.
- Nhãn gọn, có chữ đọc được, hỗ trợ bàn phím/cảm ứng và cả giao diện Việt–Anh. Hiển thị nhất quán ở tra cứu và chi tiết thẻ trong bộ từ.

## 3. Nối pipeline và câu ngữ cảnh vào luồng sử dụng thật

Bằng chứng: `runEnrichmentPipeline` hiện chỉ được gọi từ test; App vẫn gọi lookupWord. SearchBar và LookupView nhận `onSearch(word: string)`; ô contextSentence trong EditableWordModal chỉ sửa dữ liệu. Luồng AI nền trong dictionary gọi enrichWordWithAI mà không truyền contextSentence.

Yêu cầu:

- Cho phép nhập câu ngữ cảnh tùy chọn khi tra từ và truyền nó xuyên suốt UI → orchestration → morphology/AI → kết quả → lưu thẻ.
- Nếu sửa câu ngữ cảnh trên thẻ, có hành động tra lại theo câu mới; lưu văn bản đơn thuần không được làm người dùng tưởng rằng AI đã dịch lại.
- Hợp nhất trách nhiệm của pipeline mới và enrichment cũ. Một thao tác tra cứu không được vô tình gọi AI hai lần hoặc tạo vòng gọi dictionary/pipeline.
- Giữ kết quả từ điển nhanh trong lúc chờ AI, có trạng thái đang xử lý/thất bại; không chặn mọi nội dung cho đến khi toàn bộ mạng hoàn tất.
- Khi người dùng hủy hoặc đổi truy vấn, không phát callback done với dữ liệu cũ lên UI.

## 4. Sửa chính sách gộp trong pipeline

Bằng chứng: `enrichmentPipeline.ts` khoảng dòng 114 luôn gán nghĩa AI; nhánh dictionary khoảng dòng 179 mới kiểm tra prioritizeAI. Khi prioritizeAI=false, kết quả cuối phụ thuộc dịch vụ nào trả về sau. Pipeline tạo englishDefinition rỗng và chưa chép englishDefinition từ dictionary. Khi AI sửa lemma, word vẫn giữ targetTerm lấy từ phân tích ban đầu.

Yêu cầu:

- Tách kết quả từng nguồn, dùng một hàm quyết định/gộp rõ ràng; cùng dữ liệu đầu vào phải cho kết quả cuối giống nhau ở cả hai thứ tự hoàn thành.
- Nếu prioritizeAI=false và có nghĩa từ điển hợp lệ, dictionary thắng; nếu dictionary thất bại, có thể dùng AI làm fallback theo chính sách rõ ràng.
- Sao chép định nghĩa Anh hợp lệ. Phân biệt từ người dùng nhập, từ hiển thị và lemma; phiên âm phải thuộc đúng dạng từ được ghi cạnh nó.
- Không ghép phiên âm của “went” vào tiêu đề “go”, hay giữ nghĩa của lemma bị chọn sai sau khi AI đã giải nghĩa theo câu.
- Không coi giải thích hình thái hoặc placeholder là bản dịch đã hoàn tất.

## 5. Cache phải phân biệt đúng ngữ cảnh

Bằng chứng: `src/services/ai/aiCache.ts` khoảng dòng 35 chỉ dùng 80 ký tự đầu của câu. Hai câu có cùng tiền tố dài nhưng khác phần quyết định nghĩa bị trùng cache. Khóa cũng chưa phân biệt POS và custom endpoint.

Yêu cầu:

- Dùng toàn bộ ngữ cảnh chuẩn hóa hoặc hash ổn định của toàn bộ ngữ cảnh, không cắt tiền tố.
- Bao gồm các yếu tố ảnh hưởng kết quả: từ, POS, câu, provider, model thực tế, định danh endpoint an toàn, ngôn ngữ đích và phiên bản prompt/schema.
- Loại credential khỏi định danh endpoint; không đưa token vào cache key.
- Bảo đảm TTL và giới hạn kích thước; nếu gọi là LRU thì cập nhật thứ tự khi truy cập. Không trả object chia sẻ có thể bị bên gọi sửa làm hỏng cache.

## 6. Loại nội dung giả và sửa tiếng Việt máy móc

Bằng chứng: fallback thêm word-family trong `WordCard.tsx` khoảng dòng 100–113 dựng “Ý nghĩa của ...”, “Definition for ...” và IPA bằng cách bọc từ trong dấu `/`. `enrichmentPipeline.ts` dựng “Ví dụ theo ngữ cảnh nhập vào.” ở trường bản dịch câu. Đây là placeholder, không phải tri thức đã xác minh.

Yêu cầu:

- Khi chưa tra được nghĩa/phiên âm/bản dịch câu, để thiếu dữ liệu và hiển thị “Chưa có bản dịch”, “Chưa có phiên âm” hoặc trạng thái cần bổ sung. Cho lưu từ thiếu dữ liệu nếu cần nhưng không trình bày như dữ liệu đã hoàn thiện.
- Prompt AI yêu cầu tiếng Việt tự nhiên, ngắn gọn, đúng nghĩa trong câu; tách nghĩa của từ khỏi giải thích ngữ pháp, không tự bịa tình huống hoặc cố ép mọi từ vào TOEIC/công sở.
- Không dùng một quy tắc regex đơn giản để kết luận “văn bản do AI viết”. Chất lượng văn phong và provenance là hai việc riêng.
- Chuẩn hóa giao diện: “deck” → “bộ từ”; “Về Dashboard” → “Về tổng quan”; “Luyện thêm (Cram)” → “Luyện thêm”; mô tả “Luyện tập mà không thay đổi lịch ôn”. Giữ thuật ngữ chuyên môn khi cần, giải thích một lần.
- Rà chuỗi hardcode, placeholder, tooltip, thông báo lỗi và trạng thái trống của các màn liên quan; chuyển vào i18n và kiểm tra đủ key Việt–Anh. Ví dụ `+ tag mới` trong WordCard chưa đổi theo ngôn ngữ.
- `translations.ts` và README còn mô tả SM-2 trong khi useSpacedRepetition dùng FSRS. Cập nhật mô tả đúng thực tế; bỏ lời khẳng định quá mức về độ chính xác hoặc bảo đảm ghi nhớ.
- Rà chuỗi “Lưu trữ an toàn cục bộ...” và chỉ mô tả cơ chế lưu thực tế, không khẳng định an toàn tuyệt đối. Phân biệt chuỗi đang dùng với chuỗi thừa.

## 7. Bảo toàn âm thanh và dữ liệu học

Bằng chứng: `src/services/vocabRepository.ts` khoảng dòng 75 dựng mergedPhonetics chỉ có us/uk, làm mất audioUs/audioUk khi gộp thẻ.

- Giữ cả audioUs/audioUk khi cập nhật trường không liên quan; chỉ thay khi có dữ liệu thay thế hợp lệ.
- Không để làm giàu ngôn ngữ sửa reviewMeta, history, dueDate, trạng thái học hoặc ID của thẻ hiện có.
- Giữ chỉnh sửa thủ công khi background enrichment hoàn thành; thực hiện đọc/gộp dữ liệu mới nhất nếu có thể có cạnh tranh.

## 8. Kiểm thử và điều kiện hoàn thành

Viết regression cho hành vi thật, tối thiểu:

1. Dictionary trả trước, AI trả sau: nghĩa AI và badge cập nhật trên UI khi bật ưu tiên AI.
2. Đảo thứ tự hoàn thành: cùng kết quả cuối; kiểm tra cả prioritizeAI=true/false.
3. Không cấu hình AI, AI lỗi hoặc timeout: không gắn nhãn AI cho nghĩa fallback.
4. AI chỉ bổ sung ví dụ: không đổi nguồn của nghĩa từ điển.
5. Save → reload → JSON export/import: nghĩa, nguồn, audio và lịch ôn giữ đúng.
6. Sửa nghĩa/tag trong lúc chờ AI: phản hồi nền không xóa chỉnh sửa đó.
7. Hai ngữ cảnh cùng 80 ký tự đầu nhưng khác nghĩa: không trùng cache; phân biệt POS và endpoint.
8. Tra liên tiếp hai từ, hủy truy vấn đầu: chỉ kết quả mới cập nhật giao diện.
9. Tra từ kèm câu ngữ cảnh qua UI thật: đúng tham số xuống AI, không gọi lặp.
10. “went”, “written”, “studies” và từ đa nghĩa như “bank”: phân biệt input/lemma/IPA/nghĩa; khi thiếu ngữ cảnh thì không ép một cách giải nghĩa duy nhất.
11. Không có dữ liệu: không sinh nghĩa hay IPA giả; chuyển Việt–Anh không sót chuỗi của các phần đã sửa.

Chạy typecheck, lint, unit/component tests và production build. Chạy E2E tra cứu → AI mock → lưu → xem bộ từ → reload trên trình duyệt, cả hai ngôn ngữ, desktop và chiều rộng mobile. Không tuyên bố đã kiểm tra UI nếu chỉ chạy unit test. Báo rõ bước nào không chạy được và nguyên nhân.

Kết quả rà soát ngày 09/09/2026 để tham khảo, không thay thế kiểm thử sau sửa:

- TypeScript: qua; Vitest: 16 file, 77 test qua.
- Vite production build: qua, chunk chính khoảng 559 kB, có cảnh báo >500 kB.
- Oxlint: exit 0 nhưng còn cảnh báo React hooks/purity và các cảnh báo khác. Chỉ sửa cảnh báo trong phạm vi có căn cứ; không tắt rule hoặc tăng ngưỡng để che vấn đề.
- npm trên máy đang trỏ tới npm-cli.js không tồn tại. Kiểm tra runtime đúng hoặc chạy entrypoint trong node_modules trực tiếp; không thay đổi npm toàn hệ thống như một phần sửa ứng dụng.
- Các lệnh đã chạy được: `node node_modules/typescript/bin/tsc -b --noEmit`, `node node_modules/vitest/vitest.mjs run`, `node node_modules/oxlint/bin/oxlint`, `node node_modules/vite/bin/vite.js build`.
- Rà soát này dựa trên mã và các kiểm tra trên; chưa chạy E2E hoặc đánh giá bản dịch từ một nhà cung cấp AI thật.

Cuối cùng báo cáo bằng tiếng Việt: lỗi đã sửa và tác động, file chính đã đổi, kết quả kiểm thử thực tế, giới hạn còn lại. Không tự commit/push/deploy.
