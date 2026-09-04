import type { WordItem } from '../../types/vocab';
import { createInitialReviewMeta } from '../sm2';

// Helper to generate consistent historical timestamps in local time (morning/afternoon to avoid midnight boundary)
function getHistoricalTimestamp(daysAgo: number, hour = 10, minute = 0): number {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

function getFutureTimestamp(daysAhead: number, hour = 10, minute = 0): number {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

// Pre-seeded high-yield words for instant, rich test-taker experience with staggered historical dates
const SEED_WORDS: WordItem[] = [
  {
    id: 'seed-1',
    word: 'negotiate',
    phonetics: {
      us: '/nəˈɡoʊ.ʃi.eɪt/',
      uk: '/nəˈɡəʊ.ʃi.eɪt/',
    },
    pos: ['verb'],
    vietnameseDefinition: 'Đàm phán, thương lượng các điều khoản',
    englishDefinition: 'To try to reach an agreement or compromise by discussion with others.',
    meanings: [
      {
        pos: 'verb',
        englishDefinition: 'To discuss something formally in order to make an agreement.',
        vietnameseDefinition: 'Thương lượng, đàm phán chính thức.',
        synonyms: ['bargain', 'mediate', 'settle'],
      },
    ],
    collocations: [
      { phrase: 'negotiate a contract', meaningVi: 'thương lượng một hợp đồng' },
      { phrase: 'negotiate in good faith', meaningVi: 'đàm phán với thiện chí' },
      { phrase: 'successful negotiation', meaningVi: 'cuộc thương thảo thành công' },
    ],
    wordFamily: [
      { word: 'negotiation', pos: 'noun', meaningVi: 'sự đàm phán, cuộc thương lượng' },
      { word: 'negotiator', pos: 'noun', meaningVi: 'người đàm phán, nhà thương thuyết' },
      { word: 'negotiable', pos: 'adjective', meaningVi: 'có thể thương lượng được' },
    ],
    examples: [
      {
        en: 'The union leaders met to negotiate higher wages for workers.',
        vi: 'Các nhà lãnh đạo công đoàn đã gặp nhau để thương lượng mức lương cao hơn cho công nhân.',
        context: 'general',
      },
      {
        en: 'Our procurement team managed to negotiate a 15% discount on bulk office supplies.',
        vi: 'Đội ngũ mua hàng của chúng tôi đã đàm phán thành công mức chiết khấu 15% cho đơn hàng văn phòng phẩm số lượng lớn.',
        context: 'toeic',
      },
    ],
    tags: ['#TOEIC', '#Contract', '#Office'],
    status: 'review_needed',
    createdAt: getHistoricalTimestamp(8, 9, 30),
    updatedAt: getHistoricalTimestamp(4, 16, 45),
    reviewMeta: {
      repetition: 2,
      interval: 3,
      easeFactor: 2.5,
      dueDate: getHistoricalTimestamp(0, 8, 0), // due today, ready for review
      lastReviewedDate: getHistoricalTimestamp(4, 16, 45),
      history: [
        { date: getHistoricalTimestamp(7, 14, 20), rating: 2, interval: 1, easeFactor: 2.5, repetition: 1 },
        { date: getHistoricalTimestamp(4, 16, 45), rating: 2, interval: 3, easeFactor: 2.5, repetition: 2 },
      ],
    },
  },
  {
    id: 'seed-2',
    word: 'feasible',
    phonetics: {
      us: '/ˈfiː.zə.bəl/',
      uk: '/ˈfiː.zə.bəl/',
    },
    pos: ['adjective'],
    vietnameseDefinition: 'Khả thi, có thể thực hiện được một cách thực tế',
    englishDefinition: 'Possible to do easily or conveniently; workable.',
    meanings: [
      {
        pos: 'adjective',
        englishDefinition: 'Capable of being done, effected, or accomplished.',
        vietnameseDefinition: 'Có khả năng thực hiện thành công.',
        synonyms: ['viable', 'achievable', 'practicable'],
      },
    ],
    collocations: [
      { phrase: 'feasibility study', meaningVi: 'nghiên cứu tính khả thi' },
      { phrase: 'economically feasible', meaningVi: 'khả thi về mặt kinh tế' },
      { phrase: 'feasible alternative', meaningVi: 'giải pháp thay thế khả thi' },
    ],
    wordFamily: [
      { word: 'feasibility', pos: 'noun', meaningVi: 'tính khả thi' },
      { word: 'feasibly', pos: 'adverb', meaningVi: 'một cách khả thi' },
      { word: 'infeasible', pos: 'adjective', meaningVi: 'không khả thi' },
    ],
    examples: [
      {
        en: 'It is simply not feasible to finish the entire project in three days.',
        vi: 'Hoàn thành toàn bộ dự án trong ba ngày là điều không khả thi.',
        context: 'general',
      },
      {
        en: 'The committee concluded that relocating the regional headquarters is financially feasible.',
        vi: 'Hội đồng kết luận rằng việc di dời trụ sở khu vực là hoàn toàn khả thi về mặt tài chính.',
        context: 'toeic',
      },
    ],
    tags: ['#TOEIC', '#Project', '#Strategy'],
    status: 'review_needed',
    createdAt: getHistoricalTimestamp(3, 10, 15),
    updatedAt: getHistoricalTimestamp(2, 15, 30),
    reviewMeta: {
      repetition: 1,
      interval: 1,
      easeFactor: 2.5,
      dueDate: getHistoricalTimestamp(0, 9, 0), // due today, ready for review
      lastReviewedDate: getHistoricalTimestamp(2, 15, 30),
      history: [
        { date: getHistoricalTimestamp(2, 15, 30), rating: 2, interval: 1, easeFactor: 2.5, repetition: 1 },
      ],
    },
  },
  {
    id: 'seed-3',
    word: 'implement',
    phonetics: {
      us: '/ˈɪm.plə.ment/',
      uk: '/ˈɪm.plɪ.ment/',
    },
    pos: ['verb'],
    vietnameseDefinition: 'Thực hiện, triển khai, thi hành một kế hoạch hay hệ thống',
    englishDefinition: 'Put a decision, plan, or agreement into effect.',
    meanings: [
      {
        pos: 'verb',
        englishDefinition: 'To start using a plan, system, or law.',
        vietnameseDefinition: 'Bắt đầu áp dụng quy trình hoặc chính sách mới.',
        synonyms: ['execute', 'enforce', 'apply'],
      },
    ],
    collocations: [
      { phrase: 'implement a policy', meaningVi: 'ban hành/áp dụng chính sách' },
      { phrase: 'implement changes', meaningVi: 'triển khai các thay đổi' },
      { phrase: 'implementation phase', meaningVi: 'giai đoạn triển khai' },
    ],
    wordFamily: [
      { word: 'implementation', pos: 'noun', meaningVi: 'sự triển khai, thực thi' },
      { word: 'implementer', pos: 'noun', meaningVi: 'người thực thi' },
    ],
    examples: [
      {
        en: 'The company decided to implement new security guidelines immediately.',
        vi: 'Công ty quyết định thực thi các nguyên tắc an ninh mới ngay lập tức.',
        context: 'general',
      },
      {
        en: 'Human Resources will implement a hybrid working model starting next quarter.',
        vi: 'Phòng Nhân sự sẽ triển khai mô hình làm việc kết hợp (hybrid) từ quý tới.',
        context: 'toeic',
      },
    ],
    tags: ['#TOEIC', '#Management', '#Office'],
    status: 'learning',
    createdAt: getHistoricalTimestamp(4, 11, 0),
    updatedAt: getHistoricalTimestamp(1, 17, 10),
    reviewMeta: {
      repetition: 2,
      interval: 3,
      easeFactor: 2.5,
      dueDate: getFutureTimestamp(2, 11, 0), // due in 2 days
      lastReviewedDate: getHistoricalTimestamp(1, 17, 10),
      history: [
        { date: getHistoricalTimestamp(3, 14, 0), rating: 2, interval: 1, easeFactor: 2.5, repetition: 1 },
        { date: getHistoricalTimestamp(1, 17, 10), rating: 2, interval: 3, easeFactor: 2.5, repetition: 2 },
      ],
    },
  },
  {
    id: 'seed-4',
    word: 'delegate',
    phonetics: {
      us: '/ˈdel.ə.ɡeɪt/',
      uk: '/ˈdel.ɪ.ɡeɪt/',
    },
    pos: ['verb', 'noun'],
    vietnameseDefinition: 'Ủy thác, giao phó trách nhiệm (v) / Người đại biểu (n)',
    englishDefinition: 'Entrust a task or responsibility to another person, typically one who is less senior.',
    meanings: [
      {
        pos: 'verb',
        englishDefinition: 'To give a particular job, duty, right, etc. to someone else.',
        vietnameseDefinition: 'Giao nhiệm vụ hoặc quyền hạn cho cấp dưới.',
        synonyms: ['assign', 'entrust', 'transfer'],
      },
    ],
    collocations: [
      { phrase: 'delegate authority', meaningVi: 'ủy quyền' },
      { phrase: 'delegate tasks effectively', meaningVi: 'giao nhiệm vụ hiệu quả' },
      { phrase: 'conference delegate', meaningVi: 'đại biểu tham dự hội nghị' },
    ],
    wordFamily: [
      { word: 'delegation', pos: 'noun', meaningVi: 'đoàn đại biểu; sự ủy quyền' },
      { word: 'delegator', pos: 'noun', meaningVi: 'người ủy quyền' },
    ],
    examples: [
      {
        en: 'A good manager knows how to delegate responsibilities without micromanaging.',
        vi: 'Một người quản lý giỏi biết cách ủy thác trách nhiệm mà không kiểm soát tiểu tiết.',
        context: 'general',
      },
      {
        en: 'Mr. Vance asked his deputy to delegate routine client inquiries to junior analysts.',
        vi: 'Ông Vance yêu cầu cấp phó phân công việc giải đáp thắc mắc thường ngày của khách hàng cho các chuyên viên tập sự.',
        context: 'toeic',
      },
    ],
    tags: ['#TOEIC', '#Leadership', '#Workplace'],
    status: 'learning',
    createdAt: getHistoricalTimestamp(6, 14, 20),
    updatedAt: getHistoricalTimestamp(1, 18, 0),
    reviewMeta: {
      repetition: 2,
      interval: 4,
      easeFactor: 2.6,
      dueDate: getFutureTimestamp(3, 14, 0), // due in 3 days
      lastReviewedDate: getHistoricalTimestamp(1, 18, 0),
      history: [
        { date: getHistoricalTimestamp(5, 10, 0), rating: 3, interval: 2, easeFactor: 2.65, repetition: 1 },
        { date: getHistoricalTimestamp(1, 18, 0), rating: 2, interval: 4, easeFactor: 2.65, repetition: 2 },
      ],
    },
  },
  {
    id: 'seed-5',
    word: 'comprehensive',
    phonetics: {
      us: '/ˌkɑːm.prəˈhen.sɪv/',
      uk: '/ˌkɒm.prɪˈhen.sɪv/',
    },
    pos: ['adjective'],
    vietnameseDefinition: 'Toàn diện, bao quát mọi khía cạnh',
    englishDefinition: 'Complete and including everything that is necessary.',
    meanings: [
      {
        pos: 'adjective',
        englishDefinition: 'Including or dealing with all or nearly all elements or aspects of something.',
        vietnameseDefinition: 'Bao quát tất cả mọi chi tiết cần thiết.',
        synonyms: ['exhaustive', 'thorough', 'all-inclusive'],
      },
    ],
    collocations: [
      { phrase: 'comprehensive report', meaningVi: 'báo cáo toàn diện' },
      { phrase: 'comprehensive insurance', meaningVi: 'bảo hiểm toàn diện' },
      { phrase: 'comprehensive training program', meaningVi: 'chương trình đào tạo chuyên sâu' },
    ],
    wordFamily: [
      { word: 'comprehensively', pos: 'adverb', meaningVi: 'một cách toàn diện' },
      { word: 'comprehensiveness', pos: 'noun', meaningVi: 'tính toàn diện' },
      { word: 'comprehend', pos: 'verb', meaningVi: 'hiểu, lĩnh hội' },
    ],
    examples: [
      {
        en: 'The guide offers a comprehensive overview of the city historic sites.',
        vi: 'Cuốn cẩm nang cung cấp một cái nhìn tổng quan toàn diện về các di tích lịch sử của thành phố.',
        context: 'general',
      },
      {
        en: 'The consulting firm submitted a comprehensive audit of the company financial records.',
        vi: 'Công ty tư vấn đã nộp một bản kiểm toán toàn diện về hồ sơ tài chính của doanh nghiệp.',
        context: 'toeic',
      },
    ],
    tags: ['#TOEIC', '#Report', '#HighYield'],
    status: 'mastered',
    createdAt: getHistoricalTimestamp(42, 9, 0),
    updatedAt: getHistoricalTimestamp(10, 16, 0),
    reviewMeta: {
      repetition: 5,
      interval: 28,
      easeFactor: 2.7,
      dueDate: getFutureTimestamp(18, 9, 0), // due in 18 days
      lastReviewedDate: getHistoricalTimestamp(10, 16, 0),
      history: [
        { date: getHistoricalTimestamp(40, 10, 0), rating: 2, interval: 1, easeFactor: 2.5, repetition: 1 },
        { date: getHistoricalTimestamp(38, 11, 0), rating: 2, interval: 3, easeFactor: 2.5, repetition: 2 },
        { date: getHistoricalTimestamp(34, 15, 0), rating: 3, interval: 7, easeFactor: 2.65, repetition: 3 },
        { date: getHistoricalTimestamp(26, 14, 0), rating: 3, interval: 18, easeFactor: 2.7, repetition: 4 },
        { date: getHistoricalTimestamp(10, 16, 0), rating: 2, interval: 28, easeFactor: 2.7, repetition: 5 },
      ],
    },
  },
  {
    id: 'seed-6',
    word: 'allocate',
    phonetics: {
      us: '/ˈæl.ə.keɪt/',
      uk: '/ˈæl.ə.keɪt/',
    },
    pos: ['verb'],
    vietnameseDefinition: 'Phân bổ, cấp phát ngân sách hoặc nguồn lực',
    englishDefinition: 'Distribute (resources or duties) for a particular purpose.',
    meanings: [
      {
        pos: 'verb',
        englishDefinition: 'To give something to someone as their share of a total amount, to use in a particular way.',
        vietnameseDefinition: 'Dành riêng một khoản ngân sách/tài nguyên cho mục đích cụ thể.',
        synonyms: ['apportion', 'assign', 'earmark'],
      },
    ],
    collocations: [
      { phrase: 'allocate funds/budget', meaningVi: 'phân bổ ngân sách' },
      { phrase: 'allocate resources', meaningVi: 'phân chia nguồn lực' },
      { phrase: 'efficiently allocate', meaningVi: 'phân bổ một cách hiệu quả' },
    ],
    wordFamily: [
      { word: 'allocation', pos: 'noun', meaningVi: 'sự phân bổ, phần cấp phát' },
      { word: 'allocator', pos: 'noun', meaningVi: 'người phân bổ' },
      { word: 'reallocate', pos: 'verb', meaningVi: 'tái phân bổ' },
    ],
    examples: [
      {
        en: 'The government promised to allocate more money to public schools.',
        vi: 'Chính phủ hứa sẽ phân bổ thêm tiền cho các trường công lập.',
        context: 'general',
      },
      {
        en: 'The board voted to allocate 20% of annual profits to research and development.',
        vi: 'Ban giám đốc đã biểu quyết phân bổ 20% lợi nhuận thường niên cho nghiên cứu và phát triển (R&D).',
        context: 'toeic',
      },
    ],
    tags: ['#TOEIC', '#Finance', '#Budget'],
    status: 'new',
    createdAt: getHistoricalTimestamp(5, 13, 40),
    updatedAt: getHistoricalTimestamp(5, 13, 40),
    reviewMeta: createInitialReviewMeta(),
  },
  {
    id: 'seed-7',
    word: 'preliminary',
    phonetics: {
      us: '/prɪˈlɪm.ə.ner.i/',
      uk: '/prɪˈlɪm.ɪ.nər.i/',
    },
    pos: ['adjective'],
    vietnameseDefinition: 'Sơ bộ, mở đầu, chuẩn bị trước',
    englishDefinition: 'Denoting an action or event preceding or done in preparation for something fuller or more important.',
    meanings: [
      {
        pos: 'adjective',
        englishDefinition: 'Coming before a more important action or event, especially introducing or preparing for it.',
        vietnameseDefinition: 'Diễn ra trước để chuẩn bị cho sự kiện quan trọng hơn.',
        synonyms: ['introductory', 'exploratory', 'prior'],
      },
    ],
    collocations: [
      { phrase: 'preliminary findings / results', meaningVi: 'kết quả nghiên cứu sơ bộ' },
      { phrase: 'preliminary discussions', meaningVi: 'các cuộc thảo luận bước đầu' },
      { phrase: 'preliminary approval', meaningVi: 'sự chấp thuận sơ bộ' },
    ],
    wordFamily: [
      { word: 'preliminaries', pos: 'noun', meaningVi: 'các bước chuẩn bị sơ bộ' },
      { word: 'preliminarily', pos: 'adverb', meaningVi: 'một cách sơ bộ' },
    ],
    examples: [
      {
        en: 'After a few preliminary remarks, the keynote speaker introduced the guest.',
        vi: 'Sau vài lời giới thiệu mở đầu, diễn giả chính đã giới thiệu vị khách mời.',
        context: 'general',
      },
      {
        en: 'The preliminary audit revealed slight discrepancies in the Q3 expense accounts.',
        vi: 'Cuộc kiểm toán sơ bộ đã phát hiện một vài điểm sai lệch nhỏ trong sổ sách chi phí quý 3.',
        context: 'toeic',
      },
    ],
    tags: ['#TOEIC', '#Research', '#Office'],
    status: 'new',
    createdAt: getHistoricalTimestamp(3, 16, 25),
    updatedAt: getHistoricalTimestamp(3, 16, 25),
    reviewMeta: createInitialReviewMeta(),
  },
  {
    id: 'seed-8',
    word: 'accommodate',
    phonetics: {
      us: '/əˈkɑː.mə.deɪt/',
      uk: '/əˈkɒm.ə.deɪt/',
    },
    pos: ['verb'],
    vietnameseDefinition: 'Đáp ứng nhu cầu, cung cấp chỗ ở hoặc tiện nghi',
    englishDefinition: 'Fit in with the wishes or needs of; provide lodging or sufficient space for.',
    meanings: [
      {
        pos: 'verb',
        englishDefinition: 'To provide with a place to live or to be stored in; or to suit someone needs.',
        vietnameseDefinition: 'Cung cấp không gian hoặc đáp ứng nguyện vọng của ai đó.',
        synonyms: ['oblige', 'house', 'adapt to'],
      },
    ],
    collocations: [
      { phrase: 'accommodate special requests', meaningVi: 'đáp ứng các yêu cầu đặc biệt' },
      { phrase: 'accommodate up to 500 guests', meaningVi: 'chứa được tới 500 khách' },
      { phrase: 'accommodate schedule changes', meaningVi: 'linh hoạt theo thay đổi lịch trình' },
    ],
    wordFamily: [
      { word: 'accommodation', pos: 'noun', meaningVi: 'chỗ ở; sự đáp ứng' },
      { word: 'accommodating', pos: 'adjective', meaningVi: 'sẵn lòng giúp đỡ, chu đáo' },
    ],
    examples: [
      {
        en: 'The hotel staff did their best to accommodate our late check-in.',
        vi: 'Nhân viên khách sạn đã cố gắng hết sức để hỗ trợ chúng tôi nhận phòng muộn.',
        context: 'general',
      },
      {
        en: 'The main auditorium was remodeled to accommodate the growing number of shareholders.',
        vi: 'Khán phòng chính đã được tu sửa để đáp ứng đủ số lượng cổ đông ngày càng tăng.',
        context: 'toeic',
      },
    ],
    tags: ['#TOEIC', '#CustomerService', '#Hospitality'],
    status: 'review_needed',
    createdAt: getHistoricalTimestamp(8, 11, 15),
    updatedAt: getHistoricalTimestamp(4, 15, 20),
    reviewMeta: {
      repetition: 2,
      interval: 3,
      easeFactor: 2.4,
      dueDate: getHistoricalTimestamp(0, 10, 0), // due today, ready for review
      lastReviewedDate: getHistoricalTimestamp(4, 15, 20),
      history: [
        { date: getHistoricalTimestamp(7, 10, 0), rating: 2, interval: 1, easeFactor: 2.5, repetition: 1 },
        { date: getHistoricalTimestamp(4, 15, 20), rating: 2, interval: 3, easeFactor: 2.4, repetition: 2 },
      ],
    },
  },
  {
    id: 'seed-9',
    word: 'lucrative',
    phonetics: {
      us: '/ˈluː.krə.t̬ɪv/',
      uk: '/ˈluː.krə.tɪv/',
    },
    pos: ['adjective'],
    vietnameseDefinition: 'Sinh lợi cao, mang lại nhiều tiền của',
    englishDefinition: 'Producing a great deal of profit.',
    meanings: [
      {
        pos: 'adjective',
        englishDefinition: 'Earning or producing a lot of money.',
        vietnameseDefinition: 'Hái ra tiền, đem lại lợi nhuận kếch xù.',
        synonyms: ['profitable', 'rewarding', 'gainful'],
      },
    ],
    collocations: [
      { phrase: 'lucrative contract / deal', meaningVi: 'hợp đồng/thỏa thuận béo bở' },
      { phrase: 'lucrative market', meaningVi: 'thị trường màu mỡ' },
      { phrase: 'highly lucrative career', meaningVi: 'nghề nghiệp đem lại thu nhập cao' },
    ],
    wordFamily: [
      { word: 'lucrativeness', pos: 'noun', meaningVi: 'tính sinh lợi, sự béo bở' },
      { word: 'lucratively', pos: 'adverb', meaningVi: 'một cách sinh lợi' },
    ],
    examples: [
      {
        en: 'She left her teaching job to pursue a lucrative career in tech consulting.',
        vi: 'Cô ấy đã rời công việc giảng dạy để theo đuổi sự nghiệp tư vấn công nghệ có thu nhập cao.',
        context: 'general',
      },
      {
        en: 'Securing the government contract proved to be extremely lucrative for the startup.',
        vi: 'Giành được hợp đồng của chính phủ đã chứng minh là một thắng lợi cực kỳ sinh lời cho công ty khởi nghiệp.',
        context: 'toeic',
      },
    ],
    tags: ['#TOEIC', '#Finance', '#Business'],
    status: 'learning',
    createdAt: getHistoricalTimestamp(2, 9, 50),
    updatedAt: getHistoricalTimestamp(1, 14, 30),
    reviewMeta: {
      repetition: 1,
      interval: 2,
      easeFactor: 2.6,
      dueDate: getFutureTimestamp(1, 9, 50), // due in 1 day
      lastReviewedDate: getHistoricalTimestamp(1, 14, 30),
      history: [
        { date: getHistoricalTimestamp(1, 14, 30), rating: 3, interval: 2, easeFactor: 2.6, repetition: 1 },
      ],
    },
  },
  {
    id: 'seed-10',
    word: 'discrepancy',
    phonetics: {
      us: '/dɪˈskrep.ən.si/',
      uk: '/dɪˈskrep.ən.si/',
    },
    pos: ['noun'],
    vietnameseDefinition: 'Sự sai khác, không nhất quán giữa hai dữ liệu',
    englishDefinition: 'A lack of compatibility or similarity between two or more facts.',
    meanings: [
      {
        pos: 'noun',
        englishDefinition: 'A difference between two things that should be the same.',
        vietnameseDefinition: 'Sự chênh lệch hoặc khác biệt giữa hai tài liệu/số liệu lẽ ra phải khớp nhau.',
        synonyms: ['inconsistency', 'divergence', 'variance'],
      },
    ],
    collocations: [
      { phrase: 'discrepancy in figures / records', meaningVi: 'sự sai lệch trong số liệu/sổ sách' },
      { phrase: 'uncover a discrepancy', meaningVi: 'phát hiện điểm sai lệch' },
      { phrase: 'reconcile discrepancies', meaningVi: 'đối chiếu và xử lý chênh lệch' },
    ],
    wordFamily: [
      { word: 'discrepant', pos: 'adjective', meaningVi: 'không nhất quán, khác nhau' },
    ],
    examples: [
      {
        en: 'There is a noticeable discrepancy between what he reported and the actual receipts.',
        vi: 'Có sự chênh lệch rõ ràng giữa những gì anh ta báo cáo và các hóa đơn thực tế.',
        context: 'general',
      },
      {
        en: 'The accounting team worked overtime to explain the $50,000 discrepancy on the balance sheet.',
        vi: 'Nhóm kế toán đã làm thêm giờ để giải trình khoản chênh lệch 50.000 đô la trên bảng cân đối kế toán.',
        context: 'toeic',
      },
    ],
    tags: ['#TOEIC', '#Accounting', '#Audit'],
    status: 'review_needed',
    createdAt: getHistoricalTimestamp(9, 15, 10),
    updatedAt: getHistoricalTimestamp(3, 16, 40),
    reviewMeta: {
      repetition: 2,
      interval: 3,
      easeFactor: 2.3,
      dueDate: getHistoricalTimestamp(0, 8, 30), // due today, ready for review
      lastReviewedDate: getHistoricalTimestamp(3, 16, 40),
      history: [
        { date: getHistoricalTimestamp(8, 14, 0), rating: 2, interval: 1, easeFactor: 2.5, repetition: 1 },
        { date: getHistoricalTimestamp(4, 11, 0), rating: 1, interval: 1, easeFactor: 2.3, repetition: 0 },
        { date: getHistoricalTimestamp(3, 16, 40), rating: 2, interval: 3, easeFactor: 2.3, repetition: 1 },
      ],
    },
  },
  {
    id: 'seed-11',
    word: 'initiative',
    phonetics: {
      us: '/ɪˈnɪʃ.ə.t̬ɪv/',
      uk: '/ɪˈnɪʃ.ə.tɪv/',
    },
    pos: ['noun'],
    vietnameseDefinition: 'Sáng kiến, kế hoạch hành động mới; tinh thần chủ động',
    englishDefinition: 'An act or strategy intended to resolve a difficulty or improve a situation; a fresh approach.',
    meanings: [
      {
        pos: 'noun',
        englishDefinition: 'A new plan or process to achieve something or solve a problem.',
        vietnameseDefinition: 'Một chương trình hoặc sáng kiến mới nhằm đạt mục tiêu.',
        synonyms: ['enterprise', 'action', 'campaign'],
      },
    ],
    collocations: [
      { phrase: 'take the initiative', meaningVi: 'chủ động tiên phong' },
      { phrase: 'green / sustainability initiative', meaningVi: 'sáng kiến phát triển bền vững' },
      { phrase: 'launch a new initiative', meaningVi: 'khởi động một sáng kiến mới' },
    ],
    wordFamily: [
      { word: 'initiate', pos: 'verb', meaningVi: 'khởi xướng, bắt đầu' },
      { word: 'initiation', pos: 'noun', meaningVi: 'sự khởi xướng' },
      { word: 'initiator', pos: 'noun', meaningVi: 'người khởi xướng' },
    ],
    examples: [
      {
        en: 'Employees are encouraged to take the initiative and propose new workflows.',
        vi: 'Nhân viên được khuyến khích phát huy tính chủ động và đề xuất quy trình làm việc mới.',
        context: 'general',
      },
      {
        en: 'Management unveiled a corporate wellness initiative aimed at reducing employee burnout.',
        vi: 'Ban quản lý đã công bố một sáng kiến chăm sóc sức khỏe doanh nghiệp nhằm giảm thiểu tình trạng kiệt sức của nhân viên.',
        context: 'toeic',
      },
    ],
    tags: ['#TOEIC', '#Innovation', '#Leadership'],
    status: 'mastered',
    createdAt: getHistoricalTimestamp(36, 10, 30),
    updatedAt: getHistoricalTimestamp(10, 17, 15),
    reviewMeta: {
      repetition: 4,
      interval: 22,
      easeFactor: 2.6,
      dueDate: getFutureTimestamp(12, 10, 30), // due in 12 days
      lastReviewedDate: getHistoricalTimestamp(10, 17, 15),
      history: [
        { date: getHistoricalTimestamp(35, 11, 0), rating: 2, interval: 1, easeFactor: 2.5, repetition: 1 },
        { date: getHistoricalTimestamp(32, 14, 0), rating: 3, interval: 3, easeFactor: 2.5, repetition: 2 },
        { date: getHistoricalTimestamp(25, 16, 0), rating: 3, interval: 8, easeFactor: 2.6, repetition: 3 },
        { date: getHistoricalTimestamp(10, 17, 15), rating: 2, interval: 22, easeFactor: 2.6, repetition: 4 },
      ],
    },
  },
  {
    id: 'seed-12',
    word: 'substantial',
    phonetics: {
      us: '/səbˈstæn.ʃəl/',
      uk: '/səbˈstæn.ʃəl/',
    },
    pos: ['adjective'],
    vietnameseDefinition: 'Đáng kể, quan trọng, có giá trị lớn',
    englishDefinition: 'Of considerable importance, size, or worth.',
    meanings: [
      {
        pos: 'adjective',
        englishDefinition: 'Large in size, value, or importance.',
        vietnameseDefinition: 'Lớn về số lượng, giá trị hoặc ý nghĩa.',
        synonyms: ['significant', 'considerable', 'sizeable'],
      },
    ],
    collocations: [
      { phrase: 'substantial increase / growth', meaningVi: 'sự tăng trưởng đáng kể' },
      { phrase: 'substantial amount of money', meaningVi: 'khoản tiền lớn' },
      { phrase: 'substantial contribution', meaningVi: 'đóng góp to lớn' },
    ],
    wordFamily: [
      { word: 'substantially', pos: 'adverb', meaningVi: 'đáng kể, về căn bản' },
      { word: 'substantiate', pos: 'verb', meaningVi: 'chứng minh, xác thực' },
      { word: 'substance', pos: 'noun', meaningVi: 'chất; bản chất, thực chất' },
    ],
    examples: [
      {
        en: 'The community raised a substantial sum of money for the disaster relief fund.',
        vi: 'Cộng đồng đã quyên góp được một số tiền đáng kể cho quỹ cứu trợ thiên tai.',
        context: 'general',
      },
      {
        en: 'The software upgrade resulted in a substantial improvement in operational efficiency.',
        vi: 'Việc nâng cấp phần mềm đã mang lại sự cải thiện đáng kể về hiệu quả vận hành.',
        context: 'toeic',
      },
    ],
    tags: ['#TOEIC', '#Growth', '#Finance'],
    status: 'new',
    createdAt: getHistoricalTimestamp(1, 14, 10),
    updatedAt: getHistoricalTimestamp(1, 14, 10),
    reviewMeta: createInitialReviewMeta(),
  },
];

export { SEED_WORDS };
