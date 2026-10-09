export type ToeicTopic = 'word-form' | 'tense' | 'preposition' | 'conjunction';
export interface ToeicQuestion {
  id: string;
  topic: ToeicTopic;
  sentence: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanationsVi: [string, string, string, string];
  explanationsEn: [string, string, string, string];
}
export const TOEIC_TOPICS: Record<ToeicTopic, { vi: string; en: string }> = {
  'word-form': { vi: 'Từ loại', en: 'Word forms' },
  tense: { vi: 'Thì động từ', en: 'Verb tenses' },
  preposition: { vi: 'Giới từ', en: 'Prepositions' },
  conjunction: { vi: 'Liên từ', en: 'Conjunctions' },
};

// Original practice items, independent of ETS exam materials.
export const TOEIC_PART5: ToeicQuestion[] = [
  { id: 'wf-1', topic: 'word-form', sentence: 'Please read the instructions _____ before operating the machine.',
    options: ['care', 'careful', 'carefully', 'carefulness'], correctIndex: 2,
    explanationsVi: ['Danh từ “sự quan tâm”, không bổ nghĩa cho read.', 'Tính từ, không bổ nghĩa cho động từ read.', 'Trạng từ “cẩn thận” bổ nghĩa cho read.', 'Danh từ “sự cẩn thận”, không phù hợp vị trí này.'],
    explanationsEn: ['A noun cannot modify read here.', 'An adjective cannot modify the verb read.', 'An adverb modifies the verb read.', 'This noun cannot modify read.'] },
  { id: 'wf-2', topic: 'word-form', sentence: 'The _____ of the new office will take place on Monday.',
    options: ['open', 'opening', 'openly', 'opened'], correctIndex: 1,
    explanationsVi: ['Động từ hoặc tính từ, không phù hợp cấu trúc The ... of.', 'Danh từ “việc khai trương” làm chủ ngữ.', 'Trạng từ “công khai”, không làm chủ ngữ.', 'Dạng quá khứ/phân từ, không phải danh từ cần dùng.'],
    explanationsEn: ['A verb or adjective does not fit The ... of.', 'The noun opening is the subject.', 'An adverb cannot be the subject.', 'A past form does not fit this noun position.'] },
  { id: 'wf-3', topic: 'word-form', sentence: 'The customer service team was very _____ during our visit.',
    options: ['help', 'helpfully', 'helpfulness', 'helpful'], correctIndex: 3,
    explanationsVi: ['Danh từ/động từ, không đứng sau was very trong câu này.', 'Trạng từ, không diễn tả đặc điểm của team sau was.', 'Danh từ, không hợp sau very.', 'Tính từ “nhiệt tình, hữu ích” đứng sau was very.'],
    explanationsEn: ['A noun or verb does not fit was very here.', 'An adverb cannot describe the team after was.', 'This noun cannot follow very here.', 'The adjective helpful describes the team.'] },
  { id: 'wf-4', topic: 'word-form', sentence: 'All visitors must show _____ at the reception desk.',
    options: ['identification', 'identify', 'identifiable', 'identifiably'], correctIndex: 0,
    explanationsVi: ['Danh từ “giấy tờ nhận dạng” làm tân ngữ của show.', 'Động từ “nhận diện”, không làm tân ngữ.', 'Tính từ “có thể nhận diện”, cần danh từ phía sau.', 'Trạng từ, không làm tân ngữ của show.'],
    explanationsEn: ['The noun identification is the object of show.', 'A verb cannot be the object here.', 'This adjective would need a noun.', 'An adverb cannot be the object.'] },
  { id: 'ts-1', topic: 'tense', sentence: 'The accounting department _____ the report yesterday.',
    options: ['submits', 'will submit', 'submitted', 'has submitted'], correctIndex: 2,
    explanationsVi: ['Hiện tại đơn, không hợp yesterday.', 'Tương lai, không hợp thời điểm quá khứ.', 'Quá khứ đơn dùng với yesterday.', 'Hiện tại hoàn thành không dùng với mốc quá khứ đã kết thúc yesterday.'],
    explanationsEn: ['Present simple conflicts with yesterday.', 'Future conflicts with the past time marker.', 'Past simple matches yesterday.', 'Present perfect does not take this finished past time marker.'] },
  { id: 'ts-2', topic: 'tense', sentence: 'Ms. Tran _____ in the sales department since 2021 and still works there.',
    options: ['worked', 'has worked', 'will work', 'works'], correctIndex: 1,
    explanationsVi: ['Quá khứ đơn không diễn đạt khoảng thời gian kéo dài đến hiện tại ở đây.', 'Hiện tại hoàn thành: bắt đầu năm 2021 và còn tiếp tục.', 'Tương lai không hợp since 2021.', 'Hiện tại đơn không diễn đạt khoảng thời gian từ since đến hiện tại.'],
    explanationsEn: ['Past simple does not express this ongoing period.', 'Present perfect covers the period from 2021 to now.', 'Future does not fit since 2021.', 'Present simple does not express this since-period.'] },
  { id: 'ts-3', topic: 'tense', sentence: 'At 10 a.m. yesterday, the technicians _____ the server.',
    options: ['repair', 'will repair', 'have repaired', 'were repairing'], correctIndex: 3,
    explanationsVi: ['Hiện tại đơn không hợp thời điểm quá khứ.', 'Tương lai không hợp yesterday.', 'Hiện tại hoàn thành không hợp mốc thời gian quá khứ xác định.', 'Quá khứ tiếp diễn diễn tả hành động đang xảy ra tại 10 giờ hôm qua.'],
    explanationsEn: ['Present simple does not fit the past time.', 'Future conflicts with yesterday.', 'Present perfect conflicts with a specified past time.', 'Past continuous describes work in progress at that past time.'] },
  { id: 'ts-4', topic: 'tense', sentence: 'By the time the meeting started, the assistant _____ all the documents.',
    options: ['had prepared', 'prepares', 'will prepare', 'has prepared'], correctIndex: 0,
    explanationsVi: ['Quá khứ hoàn thành: chuẩn bị xong trước khi cuộc họp bắt đầu.', 'Hiện tại đơn không hợp mốc started.', 'Tương lai không hợp bối cảnh quá khứ.', 'Hiện tại hoàn thành không biểu đạt hành động trước một mốc quá khứ ở đây.'],
    explanationsEn: ['Past perfect shows completion before the meeting started.', 'Present simple does not fit started.', 'Future does not fit the past context.', 'Present perfect does not place the action before that past event.'] },
  { id: 'pp-1', topic: 'preposition', sentence: 'The training session begins _____ 9 a.m.',
    options: ['on', 'in', 'at', 'by'], correctIndex: 2,
    explanationsVi: ['On thường dùng với ngày, không với giờ.', 'In dùng với tháng/năm/buổi, không với giờ cụ thể.', 'At dùng với giờ cụ thể: at 9 a.m.', 'By nghĩa là “chậm nhất vào”, không chỉ giờ bắt đầu chính xác.'],
    explanationsEn: ['On is used for days, not clock times.', 'In is not used for a specific clock time.', 'At introduces an exact clock time.', 'By gives a deadline rather than the stated start time.'] },
  { id: 'pp-2', topic: 'preposition', sentence: 'The manager is responsible _____ approving travel expenses.',
    options: ['to', 'for', 'with', 'of'], correctIndex: 1,
    explanationsVi: ['Responsible to chỉ chịu trách nhiệm trước ai, không hợp approving.', 'Cấu trúc responsible for + danh từ/V-ing.', 'Không dùng responsible with cho nhiệm vụ.', 'Không dùng responsible of cho nhiệm vụ.'],
    explanationsEn: ['Responsible to refers to accountability to someone.', 'Responsible for introduces a task or gerund.', 'Responsible with is not the task construction.', 'Responsible of is not the task construction.'] },
  { id: 'pp-3', topic: 'preposition', sentence: 'Please submit your application _____ Friday at the latest.',
    options: ['during', 'from', 'since', 'by'], correctIndex: 3,
    explanationsVi: ['During dùng với một khoảng thời gian, không chỉ hạn chót này.', 'From chỉ điểm bắt đầu, không chỉ hạn cuối.', 'Since chỉ thời điểm bắt đầu kéo dài đến một mốc sau.', 'By Friday nghĩa là chậm nhất thứ Sáu, hợp at the latest.'],
    explanationsEn: ['During introduces a period, not this deadline.', 'From marks a start, not a deadline.', 'Since marks the beginning of a continuing period.', 'By Friday sets the latest submission time.'] },
  { id: 'pp-4', topic: 'preposition', sentence: 'The final price depends _____ the quantity ordered.',
    options: ['on', 'at', 'for', 'with'], correctIndex: 0,
    explanationsVi: ['Cụm depend on: phụ thuộc vào.', 'Không dùng depend at.', 'Không dùng depend for trong cấu trúc này.', 'Không dùng depend with.'],
    explanationsEn: ['Depend on means be determined by.', 'Depend at is not the construction.', 'Depend for does not fit this construction.', 'Depend with is not the construction.'] },
  { id: 'cj-1', topic: 'conjunction', sentence: '_____ the shipment was delayed, the store remained open.',
    options: ['Despite', 'Because of', 'Although', 'During'], correctIndex: 2,
    explanationsVi: ['Despite cần danh từ/V-ing, không nhận mệnh đề the shipment was delayed.', 'Because of cần danh từ/V-ing và chỉ nguyên nhân.', 'Although + mệnh đề diễn tả tương phản: dù hàng chậm, cửa hàng vẫn mở.', 'During cần danh từ chỉ khoảng thời gian.'],
    explanationsEn: ['Despite takes a noun or gerund, not this clause.', 'Because of takes a noun phrase and gives a reason.', 'Although introduces a contrasting clause.', 'During requires a time-period noun phrase.'] },
  { id: 'cj-2', topic: 'conjunction', sentence: 'You cannot enter the laboratory _____ you have a valid access card.',
    options: ['because', 'unless', 'although', 'so'], correctIndex: 1,
    explanationsVi: ['Because chỉ nguyên nhân; có thẻ không phải lý do cấm vào.', 'Unless nghĩa là “trừ khi”: phải có thẻ mới được vào.', 'Although diễn tả tương phản, không đặt điều kiện vào phòng.', 'So chỉ kết quả và không hợp cấu trúc này.'],
    explanationsEn: ['Because would give an illogical reason for denying entry.', 'Unless states the required exception: a valid card.', 'Although gives contrast rather than the access condition.', 'So introduces a result and does not fit here.'] },
  { id: 'cj-3', topic: 'conjunction', sentence: 'The office was closed _____ it was a public holiday.',
    options: ['despite', 'unless', 'although', 'because'], correctIndex: 3,
    explanationsVi: ['Despite không nhận mệnh đề it was...', 'Unless đặt điều kiện ngoại lệ, không nêu lý do.', 'Although chỉ tương phản; ngày lễ là lý do đóng cửa.', 'Because + mệnh đề giải thích lý do đóng cửa.'],
    explanationsEn: ['Despite cannot introduce this clause.', 'Unless gives an exception, not a reason.', 'Although gives contrast; the holiday is the stated reason.', 'Because introduces the reason for closing.'] },
  { id: 'cj-4', topic: 'conjunction', sentence: 'The shipment will leave the warehouse _____ the payment has been confirmed.',
    options: ['once', 'despite', 'because of', 'during'], correctIndex: 0,
    explanationsVi: ['Once + mệnh đề: ngay khi thanh toán được xác nhận.', 'Despite cần danh từ/V-ing, không nhận mệnh đề.', 'Because of cần danh từ/V-ing, không nhận mệnh đề.', 'During cần danh từ chỉ khoảng thời gian.'],
    explanationsEn: ['Once introduces the event that triggers shipment.', 'Despite takes a noun or gerund, not a clause.', 'Because of takes a noun phrase, not a clause.', 'During takes a time-period noun phrase.'] },
];
