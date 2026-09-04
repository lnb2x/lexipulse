import { db, getAppSettings } from './db';
import { createInitialReviewMeta } from './sm2';
import type { CollocationItem, ExampleItem, MeaningItem, WordFamilyItem, WordItem } from '../types/vocab';


// In-memory cache for ultra-fast (0ms) repeat lookups
const MEMORY_CACHE = new Map<string, WordItem>();

// Built-in offline high-frequency dictionary for top TOEIC/IELTS words
export const LOCAL_KNOWLEDGE_BASE: Record<
  string,
  {
    vi: string;
    enDef: string;
    usIpa: string;
    ukIpa: string;
    pos: string[];
    collocations: CollocationItem[];
    wordFamily: WordFamilyItem[];
    examples: ExampleItem[];
    tags: string[];
  }
> = {
  negotiate: {
    vi: 'Đàm phán, thương lượng các điều khoản',
    enDef: 'To try to reach an agreement or compromise by discussion with others.',
    usIpa: '/nəˈɡoʊ.ʃi.eɪt/',
    ukIpa: '/nəˈɡəʊ.ʃi.eɪt/',
    pos: ['verb'],
    collocations: [
      { phrase: 'negotiate a contract', meaningVi: 'thương lượng một hợp đồng' },
      { phrase: 'negotiate in good faith', meaningVi: 'đàm phán với thiện chí' },
      { phrase: 'successful negotiation', meaningVi: 'cuộc thương thảo thành công' },
    ],
    wordFamily: [
      { word: 'negotiation', pos: 'noun', meaningVi: 'cuộc đàm phán, thương lượng' },
      { word: 'negotiator', pos: 'noun', meaningVi: 'nhà đàm phán, người thương lượng' },
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
  },
  feasible: {
    vi: 'Khả thi, có thể thực hiện được một cách thực tế',
    enDef: 'Possible to do easily or conveniently; workable.',
    usIpa: '/ˈfiː.zə.bəl/',
    ukIpa: '/ˈfiː.zə.bəl/',
    pos: ['adjective'],
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
  },
  implement: {
    vi: 'Thi hành, triển khai, đưa vào áp dụng thực tế',
    enDef: 'Put a decision, plan, or agreement into effect.',
    usIpa: '/ˈɪm.plə.ment/',
    ukIpa: '/ˈɪm.plɪ.ment/',
    pos: ['verb'],
    collocations: [
      { phrase: 'implement a policy', meaningVi: 'áp dụng một chính sách' },
      { phrase: 'implement changes', meaningVi: 'thực hiện các thay đổi' },
      { phrase: 'implementation strategy', meaningVi: 'chiến lược triển khai' },
    ],
    wordFamily: [
      { word: 'implementation', pos: 'noun' },
      { word: 'implementer', pos: 'noun' },
    ],
    examples: [
      {
        en: 'The school plans to implement a new uniform policy next semester.',
        vi: 'Nhà trường dự kiến áp dụng quy định đồng phục mới vào học kỳ tới.',
        context: 'general',
      },
      {
        en: 'We will implement the newly upgraded enterprise software across all branch offices by Q3.',
        vi: 'Chúng tôi sẽ triển khai phần mềm doanh nghiệp mới nâng cấp trên toàn bộ các chi nhánh vào Quý 3.',
        context: 'toeic',
      },
    ],
    tags: ['#TOEIC', '#Management', '#Operations'],
  },
  compliance: {
    vi: 'Sự tuân thủ đúng quy định, luật lệ hoặc tiêu chuẩn',
    enDef: 'The action or fact of complying with a wish or command; conformity in fulfilling official requirements.',
    usIpa: '/kəmˈplaɪ.əns/',
    ukIpa: '/kəmˈplaɪ.əns/',
    pos: ['noun'],
    collocations: [
      { phrase: 'in compliance with regulations', meaningVi: 'tuân thủ các quy định' },
      { phrase: 'ensure regulatory compliance', meaningVi: 'đảm bảo tuân thủ luật lệ' },
      { phrase: 'compliance audit', meaningVi: 'kiểm toán sự tuân thủ' },
    ],
    wordFamily: [
      { word: 'comply', pos: 'verb' },
      { word: 'compliant', pos: 'adjective' },
    ],
    examples: [
      {
        en: 'The company inspected safety gear to confirm compliance with factory laws.',
        vi: 'Công ty đã kiểm tra thiết bị an toàn để xác nhận sự tuân thủ luật nhà xưởng.',
        context: 'general',
      },
      {
        en: 'All financial statements must be verified to ensure complete compliance with corporate governance rules.',
        vi: 'Mọi báo cáo tài chính phải được xác minh nhằm bảo đảm sự tuân thủ toàn diện theo quy tắc quản trị doanh nghiệp.',
        context: 'toeic',
      },
    ],
    tags: ['#TOEIC', '#Legal', '#Audit'],
  },
  facilitate: {
    vi: 'Tạo điều kiện thuận lợi, làm cho dễ dàng hơn',
    enDef: 'Make an action or process easy or easier.',
    usIpa: '/fəˈsɪl.ə.teɪt/',
    ukIpa: '/fəˈsɪl.ɪ.teɪt/',
    pos: ['verb'],
    collocations: [
      { phrase: 'facilitate communication', meaningVi: 'tạo điều kiện giao tiếp thuận lợi' },
      { phrase: 'facilitate economic growth', meaningVi: 'thúc đẩy tăng trưởng kinh tế' },
      { phrase: 'facilitator', meaningVi: 'người điều phối cuộc họp' },
    ],
    wordFamily: [
      { word: 'facilitation', pos: 'noun' },
      { word: 'facilitator', pos: 'noun' },
      { word: 'facility', pos: 'noun' },
    ],
    examples: [
      {
        en: 'Dividing students into smaller groups facilitates more active discussions.',
        vi: 'Chia học sinh thành các nhóm nhỏ giúp các cuộc thảo luận diễn ra sôi nổi và thuận tiện hơn.',
        context: 'general',
      },
      {
        en: 'The newly introduced CRM system will facilitate smoother collaboration between sales and logistics teams.',
        vi: 'Hệ thống CRM mới được áp dụng sẽ tạo điều kiện cho sự phối hợp nhịp nhàng hơn giữa bộ phận kinh doanh và kho vận.',
        context: 'toeic',
      },
    ],
    tags: ['#TOEIC', '#Workflow', '#Productivity'],
  },
  collaborate: {
    vi: 'Hợp tác, phối hợp cùng làm việc',
    enDef: 'Work jointly on an activity, especially to produce or create something.',
    usIpa: '/kəˈlæb.ə.reɪt/',
    ukIpa: '/kəˈlæb.ə.reɪt/',
    pos: ['verb'],
    collocations: [
      { phrase: 'collaborate closely with', meaningVi: 'hợp tác chặt chẽ với' },
      { phrase: 'collaborate on a project', meaningVi: 'phối hợp trong một dự án' },
      { phrase: 'collaborative effort', meaningVi: 'nỗ lực hợp tác chung' },
    ],
    wordFamily: [
      { word: 'collaboration', pos: 'noun' },
      { word: 'collaborator', pos: 'noun' },
      { word: 'collaborative', pos: 'adjective' },
      { word: 'collaboratively', pos: 'adverb' },
    ],
    examples: [
      {
        en: 'The two departments need to collaborate to solve this technical issue.',
        vi: 'Hai phòng ban cần hợp tác để giải quyết sự cố kỹ thuật này.',
        context: 'general',
      },
      {
        en: 'Our marketing team will collaborate with the design agency on the rebranding campaign.',
        vi: 'Nhóm tiếp thị của chúng tôi sẽ cộng tác với công ty thiết kế trong chiến dịch tái định vị thương hiệu.',
        context: 'toeic',
      },
    ],
    tags: ['#TOEIC', '#Teamwork', '#Office'],
  },
  terminate: {
    vi: 'Chấm dứt, kết thúc hợp đồng hoặc dịch vụ',
    enDef: 'Bring to an end; conclude or discontinue.',
    usIpa: '/ˈtɝː.mə.neɪt/',
    ukIpa: '/ˈtɜː.mɪ.neɪt/',
    pos: ['verb'],
    collocations: [
      { phrase: 'terminate a contract', meaningVi: 'chấm dứt hợp đồng' },
      { phrase: 'terminate employment', meaningVi: 'cho thôi việc' },
      { phrase: 'early termination fee', meaningVi: 'phí chấm dứt hợp đồng trước hạn' },
    ],
    wordFamily: [
      { word: 'termination', pos: 'noun' },
      { word: 'terminable', pos: 'adjective' },
      { word: 'terminal', pos: 'noun' },
    ],
    examples: [
      {
        en: 'The train will terminate at the central station.',
        vi: 'Chuyến tàu sẽ kết thúc hành trình tại nhà ga trung tâm.',
        context: 'general',
      },
      {
        en: 'The client reserved the right to terminate the agreement with a 30-day written notice.',
        vi: 'Khách hàng bảo lưu quyền chấm dứt thỏa thuận với thông báo trước 30 ngày bằng văn bản.',
        context: 'toeic',
      },
    ],
    tags: ['#TOEIC', '#Contract', '#Legal'],
  },
  perspective: {
    vi: 'Góc nhìn, quan điểm; viễn cảnh',
    enDef: 'A particular attitude toward or way of regarding something; a point of view.',
    usIpa: '/pɚˈspek.tɪv/',
    ukIpa: '/pəˈspek.tɪv/',
    pos: ['noun'],
    collocations: [
      { phrase: 'from a business perspective', meaningVi: 'dưới góc độ kinh doanh' },
      { phrase: 'gain a broader perspective', meaningVi: 'có được góc nhìn bao quát hơn' },
      { phrase: 'put things into perspective', meaningVi: 'đánh giá sự việc một cách khách quan' },
    ],
    wordFamily: [{ word: 'perspectival', pos: 'adjective' }],
    examples: [
      {
        en: 'Traveling to other countries offers a fresh perspective on life.',
        vi: 'Đi du lịch nước ngoài mang lại một góc nhìn mới mẻ về cuộc sống.',
        context: 'general',
      },
      {
        en: 'From a financial perspective, investing in automation will lower operational expenses.',
        vi: 'Dưới góc độ tài chính, đầu tư vào tự động hóa sẽ cắt giảm chi phí vận hành.',
        context: 'toeic',
      },
    ],
    tags: ['#TOEIC', '#Strategy', '#IELTS'],
  },
  facility: {
    vi: 'Cơ sở, cơ sở vật chất, tiện nghi, trang thiết bị; điều kiện thuận lợi',
    enDef: 'A place, building, or piece of equipment provided for a particular purpose; an amenity or physical resource.',
    usIpa: '/fəˈsɪl.ə.t̬i/',
    ukIpa: '/fəˈsɪl.ə.ti/',
    pos: ['noun'],
    collocations: [
      { phrase: 'medical facility', meaningVi: 'cơ sở y tế' },
      { phrase: 'manufacturing facility', meaningVi: 'cơ sở sản xuất, nhà máy' },
      { phrase: 'research facility', meaningVi: 'cơ sở nghiên cứu' },
      { phrase: 'state-of-the-art facility', meaningVi: 'cơ sở vật chất hiện đại' },
      { phrase: 'leisure facilities', meaningVi: 'tiện nghi giải trí' },
    ],
    wordFamily: [
      { word: 'facility', pos: 'noun', meaningVi: 'cơ sở, phương tiện, tiện nghi' },
      { word: 'facilitate', pos: 'verb', meaningVi: 'tạo điều kiện thuận lợi, làm cho dễ dàng' },
      { word: 'facilitation', pos: 'noun', meaningVi: 'sự tạo điều kiện thuận lợi' },
      { word: 'facilitator', pos: 'noun', meaningVi: 'người điều phối, người hướng dẫn' },
      { word: 'facile', pos: 'adjective', meaningVi: 'dễ dãi, hời hợt; khéo tay' },
    ],
    examples: [
      {
        en: 'The company announced the opening of a modern manufacturing facility in the industrial zone.',
        vi: 'Công ty đã công bố việc khánh thành một cơ sở sản xuất hiện đại tại khu công nghiệp.',
        context: 'toeic',
      },
      {
        en: 'Our new fitness center provides state-of-the-art training facilities and personal coaching.',
        vi: 'Trung tâm thể hình mới của chúng tôi cung cấp cơ sở vật chất tập luyện hiện đại cùng huấn luyện viên cá nhân.',
        context: 'general',
      },
    ],
    tags: ['#TOEIC', '#Office', '#Building', '#Infrastructure'],
  },
  funding: {
    vi: 'Kinh phí, nguồn vốn, sự cấp vốn, tài trợ tài chính',
    enDef: 'Money provided, especially by an organization or government, for a particular purpose.',
    usIpa: '/ˈfʌn.dɪŋ/',
    ukIpa: '/ˈfʌn.dɪŋ/',
    pos: ['noun'],
    collocations: [
      { phrase: 'secure funding', meaningVi: 'đảm bảo / huy động được nguồn vốn' },
      { phrase: 'government funding', meaningVi: 'kinh phí từ chính phủ' },
      { phrase: 'receive funding', meaningVi: 'nhận được tài trợ / kinh phí' },
      { phrase: 'adequate funding', meaningVi: 'nguồn vốn đầy đủ' },
      { phrase: 'funding cuts', meaningVi: 'cắt giảm ngân sách' },
    ],
    wordFamily: [
      { word: 'funding', pos: 'noun', meaningVi: 'sự cấp kinh phí, nguồn vốn' },
      { word: 'fund', pos: 'noun', meaningVi: 'quỹ tiền tệ, nguồn tài chính' },
      { word: 'fund', pos: 'verb', meaningVi: 'tài trợ, cấp kinh phí cho' },
      { word: 'funded', pos: 'adjective', meaningVi: 'được tài trợ vốn' },
      { word: 'funder', pos: 'noun', meaningVi: 'nhà tài trợ, bên cấp kinh phí' },
    ],
    examples: [
      {
        en: 'The research project will proceed as planned after securing sufficient government funding.',
        vi: 'Dự án nghiên cứu sẽ tiến hành theo kế hoạch sau khi đảm bảo được nguồn kinh phí đầy đủ từ chính phủ.',
        context: 'toeic',
      },
      {
        en: 'The startup company is actively seeking additional venture capital funding for expansion.',
        vi: 'Công ty khởi nghiệp đang tích cực tìm kiếm thêm vốn đầu tư mạo hiểm để mở rộng quy mô.',
        context: 'general',
      },
    ],
    tags: ['#TOEIC', '#Finance', '#Budget', '#Investment'],
  },
  'secure funding': {
    vi: 'Đảm bảo / huy động được nguồn vốn, kinh phí tài trợ',
    enDef: 'To successfully obtain or guarantee financial backing or investment for a project or business.',
    usIpa: '/səˈkjʊr ˈfʌn.dɪŋ/',
    ukIpa: '/sɪˈkjʊə ˈfʌn.dɪŋ/',
    pos: ['phrase'],
    collocations: [
      { phrase: 'successfully secure funding', meaningVi: 'huy động vốn thành công' },
      { phrase: 'effort to secure funding', meaningVi: 'nỗ lực tìm kiếm nguồn tài trợ' },
      { phrase: 'struggle to secure funding', meaningVi: 'gặp khó khăn trong việc tìm vốn' },
      { phrase: 'plan to secure funding', meaningVi: 'kế hoạch huy động kinh phí' },
    ],
    wordFamily: [
      { word: 'secure', pos: 'verb' },
      { word: 'security', pos: 'noun' },
      { word: 'fund', pos: 'noun' },
      { word: 'funding', pos: 'noun' },
    ],
    examples: [
      {
        en: 'The director announced that they had managed to secure funding for the new logistics hub.',
        vi: 'Giám đốc thông báo rằng họ đã thành công trong việc huy động vốn cho trung tâm hậu cần mới.',
        context: 'toeic',
      },
      {
        en: 'Our primary objective this quarter is to secure funding from international investors.',
        vi: 'Mục tiêu hàng đầu của chúng tôi trong quý này là đảm bảo nguồn vốn từ các nhà đầu tư quốc tế.',
        context: 'general',
      },
    ],
    tags: ['#TOEIC', '#Finance', '#Collocation', '#Business'],
  },
  innovative: {
    vi: 'Có tính đổi mới, sáng tạo, tiên tiến',
    enDef: 'Featuring new methods; advanced and original.',
    usIpa: '/ˈɪn.ə.veɪ.t̬ɪv/',
    ukIpa: '/ˈɪn.ə.və.tɪv/',
    pos: ['adjective'],
    collocations: [
      { phrase: 'innovative approach / method', meaningVi: 'phương pháp tiếp cận đổi mới' },
      { phrase: 'innovative product design', meaningVi: 'thiết kế sản phẩm sáng tạo' },
      { phrase: 'highly innovative company', meaningVi: 'công ty có tính đổi mới cao' },
    ],
    wordFamily: [
      { word: 'innovate', pos: 'verb' },
      { word: 'innovation', pos: 'noun' },
      { word: 'innovator', pos: 'noun' },
      { word: 'innovatively', pos: 'adverb' },
    ],
    examples: [
      {
        en: 'The architect is famous for his innovative use of recycled glass.',
        vi: 'Kiến trúc sư nổi tiếng nhờ việc sử dụng thủy tinh tái chế một cách đầy sáng tạo.',
        context: 'general',
      },
      {
        en: 'The startup received an award for its innovative software solution for logistics.',
        vi: 'Công ty khởi nghiệp đã nhận giải thưởng cho giải pháp phần mềm sáng tạo trong ngành logistics.',
        context: 'toeic',
      },
    ],
    tags: ['#TOEIC', '#Innovation', '#Tech'],
  },
  revenue: {
    vi: 'Doanh thu, tổng thu nhập của doanh nghiệp',
    enDef: 'Income, especially when of a company or organization and of a substantial nature.',
    usIpa: '/ˈrev.ə.nuː/',
    ukIpa: '/ˈrev.ən.juː/',
    pos: ['noun'],
    collocations: [
      { phrase: 'generate revenue', meaningVi: 'tạo ra doanh thu' },
      { phrase: 'annual revenue', meaningVi: 'doanh thu hàng năm' },
      { phrase: 'revenue growth', meaningVi: 'sự tăng trưởng doanh thu' },
    ],
    wordFamily: [],
    examples: [
      {
        en: 'Taxes are the primary source of government revenue.',
        vi: 'Thuế là nguồn thu chính của chính phủ.',
        context: 'general',
      },
      {
        en: 'The company reported a 25% increase in quarterly revenue driven by online sales.',
        vi: 'Công ty báo cáo mức tăng 25% doanh thu hàng quý nhờ vào doanh số bán hàng trực tuyến.',
        context: 'toeic',
      },
    ],
    tags: ['#TOEIC', '#Finance', '#Business'],
  },
  preliminary: {
    vi: 'Sơ bộ, mở đầu, chuẩn bị',
    enDef: 'Denoting an action or event preceding or done in preparation for something fuller or more important.',
    usIpa: '/prɪˈlɪm.ə.ner.i/',
    ukIpa: '/prɪˈlɪm.ɪ.nər.i/',
    pos: ['adjective'],
    collocations: [
      { phrase: 'preliminary findings / results', meaningVi: 'kết quả sơ bộ' },
      { phrase: 'preliminary meeting', meaningVi: 'cuộc họp mở đầu chuẩn bị' },
      { phrase: 'preliminary stage', meaningVi: 'giai đoạn mở đầu' },
    ],
    wordFamily: [{ word: 'preliminarily', pos: 'adverb' }],
    examples: [
      {
        en: 'After a few preliminary remarks, the keynote speaker began his presentation.',
        vi: 'Sau vài lời nhận xét mở đầu, diễn giả chính đã bắt đầu bài thuyết trình của mình.',
        context: 'general',
      },
      {
        en: 'The preliminary audit revealed slight discrepancies in the Q2 travel expense accounts.',
        vi: 'Cuộc kiểm toán sơ bộ đã phát hiện ra những sai lệch nhỏ trong tài khoản chi phí công tác Quý 2.',
        context: 'toeic',
      },
    ],
    tags: ['#TOEIC', '#Audit', '#Research'],
  },
  substantial: {
    vi: 'Đáng kể, to lớn, có giá trị thực chất',
    enDef: 'Of considerable importance, size, or worth.',
    usIpa: '/səbˈstæn.ʃəl/',
    ukIpa: '/səbˈstæn.ʃəl/',
    pos: ['adjective'],
    collocations: [
      { phrase: 'substantial increase / decrease', meaningVi: 'sự gia tăng / sụt giảm đáng kể' },
      { phrase: 'substantial evidence', meaningVi: 'bằng chứng rõ ràng, xác thực' },
      { phrase: 'substantial financial investment', meaningVi: 'khoản đầu tư tài chính lớn' },
    ],
    wordFamily: [
      { word: 'substantially', pos: 'adverb' },
      { word: 'substantiate', pos: 'verb' },
    ],
    examples: [
      {
        en: 'The new insulation provides a substantial reduction in home heating costs.',
        vi: 'Vật liệu cách nhiệt mới mang lại sự sụt giảm đáng kể chi phí sưởi ấm gia đình.',
        context: 'general',
      },
      {
        en: 'The executive board approved a substantial budget increase for artificial intelligence research.',
        vi: 'Hội đồng quản trị đã thông qua một khoản tăng ngân sách đáng kể dành cho nghiên cứu trí tuệ nhân tạo.',
        context: 'toeic',
      },
    ],
    tags: ['#TOEIC', '#Finance', '#Growth'],
  },
  comprehensive: {
    vi: 'Toàn diện, bao quát mọi khía cạnh',
    enDef: 'Complete; including all or nearly all elements or aspects of something.',
    usIpa: '/ˌkɑːm.prəˈhen.sɪv/',
    ukIpa: '/ˌkɒm.prɪˈhen.sɪv/',
    pos: ['adjective'],
    collocations: [
      { phrase: 'comprehensive study / report', meaningVi: 'báo cáo / nghiên cứu toàn diện' },
      { phrase: 'comprehensive coverage', meaningVi: 'bảo hiểm toàn diện' },
      { phrase: 'comprehensive training program', meaningVi: 'chương trình đào tạo bao quát' },
    ],
    wordFamily: [
      { word: 'comprehensively', pos: 'adverb' },
      { word: 'comprehensiveness', pos: 'noun' },
    ],
    examples: [
      {
        en: 'The city provides a comprehensive public transit map at every metro stop.',
        vi: 'Thành phố cung cấp bản đồ giao thông công cộng toàn diện tại mỗi trạm metro.',
        context: 'general',
      },
      {
        en: 'New employees are required to undergo a comprehensive two-week onboarding curriculum.',
        vi: 'Nhân viên mới được yêu cầu trải qua khóa đào tạo nhập việc toàn diện kéo dài hai tuần.',
        context: 'toeic',
      },
    ],
    tags: ['#TOEIC', '#HR', '#Training'],
  },
  contingency: {
    vi: 'Trường hợp bất ngờ; kế hoạch dự phòng rủi ro',
    enDef: 'A future event or circumstance which is possible but cannot be predicted with certainty.',
    usIpa: '/kənˈtɪn.dʒən.si/',
    ukIpa: '/kənˈtɪn.dʒən.si/',
    pos: ['noun'],
    collocations: [
      { phrase: 'contingency plan', meaningVi: 'kế hoạch dự phòng rủi ro' },
      { phrase: 'contingency fund', meaningVi: 'quỹ dự phòng tài chính' },
      { phrase: 'prepare for all contingencies', meaningVi: 'chuẩn bị cho mọi tình huống bất ngờ' },
    ],
    wordFamily: [{ word: 'contingent', pos: 'adjective' }],
    examples: [
      {
        en: 'Always carry an emergency battery as a contingency while hiking.',
        vi: 'Luôn mang theo pin sạc khẩn cấp làm phương án dự phòng khi đi leo núi.',
        context: 'general',
      },
      {
        en: 'Due to severe port delays, management activated their overseas shipping contingency plan.',
        vi: 'Do sự chậm trễ nghiêm trọng tại cảng, ban quản lý đã kích hoạt kế hoạch vận chuyển quốc tế dự phòng.',
        context: 'toeic',
      },
    ],
    tags: ['#TOEIC', '#Risk', '#Operations'],
  },
};

/**
 * Fast fetch with timeout to prevent hanging UI
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 2500): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

const VI_POS_TO_EN: Record<string, string> = {
  'danh từ': 'noun',
  'ngoại động từ': 'verb',
  'nội động từ': 'verb',
  'động từ': 'verb',
  'tính từ': 'adjective',
  'phó từ': 'adverb',
  'trạng từ': 'adverb',
  'giới từ': 'preposition',
  'liên từ': 'conjunction',
};

interface OpenVnDictResult {
  ipa: string;
  posList: string[];
  vietnameseDef: string;
  collocations: CollocationItem[];
  examples: ExampleItem[];
}

/**
/**
 * In-memory translation cache to guarantee 0ms response for repeated translations
 */
const translationCache = new Map<string, string>();

function cleanHtmlAndEntities(str: string): string {
  return str
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * Parses open-vn-en-dict JSON data into a structured OpenVnDictResult
 */
function parseOpenVnJson(json: any, query: string, form: string): OpenVnDictResult {
  const html = json.en_vn?.data?.content || '';
  const result: OpenVnDictResult = {
    ipa: '',
    posList: [],
    vietnameseDef: '',
    collocations: [],
    examples: [],
  };

  // 1. Extract from sentences even if html is null (e.g. funding.json)
  if (Array.isArray(json.sentences)) {
    for (const s of json.sentences) {
      const enClean = cleanHtmlAndEntities(s.en || '');
      const viClean = cleanHtmlAndEntities(s.vi || '');
      if (enClean && viClean) {
        if (enClean.toLowerCase() === query || enClean.toLowerCase() === form) {
          if (!result.vietnameseDef) result.vietnameseDef = viClean;
        } else if (enClean.split(' ').length <= 4) {
          if (!result.collocations.some((c) => c.phrase.toLowerCase() === enClean.toLowerCase())) {
            result.collocations.push({ phrase: enClean, meaningVi: viClean });
          }
        } else if (result.examples.length < 3) {
          if (!result.examples.some((e) => e.en.toLowerCase() === enClean.toLowerCase())) {
            result.examples.push({ en: enClean, vi: viClean, context: 'general' });
          }
        }
      }
    }
  }

  // 2. Parse HTML definitions if available
  if (html) {
    const paMatch = html.match(/\[([^\]]+)\]/);
    if (paMatch && !result.ipa) result.ipa = `/${paMatch[1]}/`;

    const sections = html.split(/<tr id="tl">/i);
    const definitionsByPos: Record<string, string[]> = {};

    for (let i = 1; i < sections.length; i++) {
      const sec = sections[i];
      const posMatch = sec.match(/<b><font[^>]*>([^<]+)<\/font><\/b>/i);
      const rawPos = posMatch ? posMatch[1].trim().toLowerCase() : 'nghĩa';
      const enPos = VI_POS_TO_EN[rawPos] || rawPos;

      if (!result.posList.includes(enPos)) result.posList.push(enPos);

      const meanings: string[] = [];
      const mnMatches = sec.matchAll(/<tr id="mn">.*?<td id="C_C"[^>]*>(.*?)<\/td>/gis);
      for (const m of mnMatches) {
        const clean = cleanHtmlAndEntities(m[1]);
        if (clean && !meanings.includes(clean)) meanings.push(clean);
      }
      definitionsByPos[enPos] = (definitionsByPos[enPos] || []).concat(meanings);

      const exMatches = sec.matchAll(
        /<tr id="mh">.*?<td id="C_C"><font[^>]*>(.*?)<\/font><\/td>.*?<tr id="mh_n">.*?<td id="C_C"><font[^>]*>(.*?)<\/font><\/td>/gis
      );
      for (const em of exMatches) {
        const en = cleanHtmlAndEntities(em[1]);
        const vi = cleanHtmlAndEntities(em[2]);
        if (en && vi) {
          if (en.split(' ').length <= 4 && result.collocations.length < 5) {
            if (!result.collocations.some((c) => c.phrase.toLowerCase() === en.toLowerCase())) {
              result.collocations.push({ phrase: en, meaningVi: vi });
            }
          } else if (result.examples.length < 3) {
            if (!result.examples.some((e) => e.en.toLowerCase() === en.toLowerCase())) {
              result.examples.push({ en, vi, context: 'general' });
            }
          }
        }
      }
    }

    const posKeys = Object.keys(definitionsByPos);
    if (posKeys.length > 0) {
      const formatted = posKeys
        .map((p) => `(${p}) ${definitionsByPos[p].slice(0, 3).join(', ')}`)
        .join('; ');
      if (!result.vietnameseDef || form === query) {
        result.vietnameseDef = formatted;
      }
    }
  }

  return result;
}

/**
 * Fetches authentic English-Vietnamese dictionary data via CDN (CORS-enabled, zero rate limits)
 * Supports lemma stemming for -ing, -ed, -s words (e.g. funding -> fund)
 * Optimized to race/parallelize queries so total latency is < 300ms.
 */
async function fetchOpenVnEnDictData(word: string, timeoutMs = 1500): Promise<OpenVnDictResult | null> {
  const query = word.trim().toLowerCase();

  const fetchSingle = async (f: string): Promise<OpenVnDictResult | null> => {
    try {
      const res = await fetchWithTimeout(
        `https://raw.githubusercontent.com/samuraitruong/open-vn-en-dict/master/data/${encodeURIComponent(f)}.json`,
        {},
        timeoutMs
      );
      if (!res.ok) return null;
      const json = await res.json();
      const parsed = parseOpenVnJson(json, query, f);
      return parsed.vietnameseDef || parsed.collocations.length > 0 ? parsed : null;
    } catch {
      return null;
    }
  };

  // 1. Try exact word first
  const exactResult = await fetchSingle(query);
  if (exactResult && exactResult.vietnameseDef) {
    return exactResult;
  }

  // 2. Lemma fallbacks for inflected words (parallelized)
  const fallbackForms: string[] = [];
  if (query.endsWith('ing') && query.length > 4) {
    fallbackForms.push(query.slice(0, -3));
    fallbackForms.push(`${query.slice(0, -3)}e`);
  } else if (query.endsWith('ed') && query.length > 3) {
    fallbackForms.push(query.slice(0, -2));
    fallbackForms.push(query.slice(0, -1));
  } else if (query.endsWith('s') && query.length > 3) {
    fallbackForms.push(query.slice(0, -1));
    if (query.endsWith('es')) fallbackForms.push(query.slice(0, -2));
  }

  if (fallbackForms.length > 0) {
    const fallbackResults = await Promise.all(fallbackForms.map((f) => fetchSingle(f)));
    for (const r of fallbackResults) {
      if (r && r.vietnameseDef) return r;
    }
  }

  return exactResult;
}

/**
 * MediaWiki CORS-enabled query to extract Vietnamese translation from Wiktionary
 */
async function fetchWiktionaryVi(word: string, timeoutMs = 1200): Promise<string[]> {
  try {
    const encoded = encodeURIComponent(word.trim().toLowerCase());
    const res = await fetchWithTimeout(
      `https://en.wiktionary.org/w/api.php?action=parse&page=${encoded}&prop=wikitext&format=json&origin=*`,
      { headers: { 'User-Agent': 'LexiPulse/1.0' } },
      timeoutMs
    );
    if (!res.ok) return [];
    const data = await res.json();
    const text = data.parse?.wikitext?.['*'] || '';
    const matches = Array.from(text.matchAll(/\{\{t[\+\-]?\|vi\|([^}|]+)/g)).map((m: any) => m[1]?.trim() || '');
    return Array.from(new Set(matches)).filter((s) => s.length > 0);
  } catch {
    return [];
  }
}

/**
 * Ultra-fast Google Translate single API (via Vite local proxy or direct) with in-memory caching
 */
export async function translateToVietnamese(text: string, timeoutMs = 1800): Promise<string> {
  const clean = text?.trim();
  if (!clean) return '';
  if (translationCache.has(clean)) {
    return translationCache.get(clean)!;
  }

  // 1. Try Vite dev translation endpoint first (/api/translate)
  try {
    const isLong = clean.length > 80 || clean.includes('\n');
    const res = await fetchWithTimeout(
      isLong ? '/api/translate' : `/api/translate?q=${encodeURIComponent(clean)}`,
      isLong
        ? {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: clean }),
          }
        : {},
      timeoutMs
    );
    if (res.ok) {
      const data = await res.json();
      if (data.text) {
        const result = data.text.trim();
        translationCache.set(clean, result);
        return result;
      }
    }
  } catch {
    // fallback
  }

  // 2. Direct Google Translate mobile endpoint
  try {
    const res = await fetchWithTimeout(
      `https://translate.google.com/m?sl=en&tl=vi&q=${encodeURIComponent(clean)}`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      },
      timeoutMs
    );
    if (res.ok) {
      const html = await res.text();
      const match = html.match(/<div class="result-container">([\s\S]*?)<\/div>/i);
      if (match && match[1]) {
        const result = cleanHtmlAndEntities(match[1]);
        if (result) {
          translationCache.set(clean, result);
          return result;
        }
      }
    }
  } catch {
    // fallback
  }

  // 3. Lingva public instance
  try {
    const res = await fetchWithTimeout(
      `https://translate.plausibility.cloud/api/v1/en/vi/${encodeURIComponent(clean)}`,
      {},
      timeoutMs
    );
    if (res.ok) {
      const data = await res.json();
      if (data.translation) {
        const result = data.translation.trim();
        translationCache.set(clean, result);
        return result;
      }
    }
  } catch {
    // fallback
  }

  return '';
}


/**
 * Datamuse API query for accurate IPA, parts of speech, and English definitions (80ms)
 */
async function fetchDatamuseInfo(word: string, timeoutMs = 1500): Promise<{
  ipa: string;
  posList: string[];
  defs: Array<{ pos: string; def: string }>;
} | null> {
  try {
    const res = await fetchWithTimeout(
      `https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=rdp&ipa=1&max=1`,
      {},
      timeoutMs
    );
    if (!res.ok) return null;
    const array = await res.json();
    const item = array?.[0];
    if (!item) return null;

    let ipa = '';
    const posList: string[] = [];
    const posMap: Record<string, string> = {
      n: 'noun',
      v: 'verb',
      adj: 'adjective',
      adv: 'adverb',
    };

    if (Array.isArray(item.tags)) {
      for (const t of item.tags) {
        if (t.startsWith('ipa_pron:')) {
          ipa = `/${t.replace('ipa_pron:', '').trim()}/`;
        } else if (posMap[t]) {
          if (!posList.includes(posMap[t])) posList.push(posMap[t]);
        }
      }
    }

    const defs: Array<{ pos: string; def: string }> = [];
    if (Array.isArray(item.defs)) {
      for (const d of item.defs) {
        const parts = d.split('\t');
        const posCode = parts[0];
        const defText = (parts[1] || '').trim();
        const posFull = posMap[posCode] || posCode || 'noun';
        if (defText) {
          defs.push({ pos: posFull, def: defText });
        }
      }
    }

    return { ipa, posList, defs };
  } catch {
    return null;
  }
}

/**
 * Wiktionary REST API for rich definitions and real natural examples
 */
async function fetchWiktionaryData(word: string, timeoutMs = 1200): Promise<{
  posList: string[];
  definitions: Array<{ pos: string; definition: string; examples: string[] }>;
} | null> {
  try {
    const res = await fetchWithTimeout(
      `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`,
      { headers: { 'User-Agent': 'LexiPulse/1.0' } },
      timeoutMs
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.en || !Array.isArray(data.en)) return null;

    const posList: string[] = [];
    const definitions: Array<{ pos: string; definition: string; examples: string[] }> = [];

    for (const section of data.en) {
      const pos = (section.partOfSpeech || '').toLowerCase();
      if (pos && !posList.includes(pos)) posList.push(pos);

      for (const d of section.definitions || []) {
        const cleanDef = (d.definition || '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, '')
          .replace(/\.mw-parser-output[^{]*\{[^}]*\}/gi, '')
          .replace(/\s+/g, ' ')
          .trim();
        const cleanExamples: string[] = [];
        for (const ex of d.examples || []) {
          const stripped = ex.replace(/<[^>]+>/g, '').trim();
          if (stripped && !cleanExamples.includes(stripped)) {
            cleanExamples.push(stripped);
          }
        }
        if (cleanDef) {
          definitions.push({ pos: pos || 'noun', definition: cleanDef, examples: cleanExamples });
        }
      }
    }

    return { posList, definitions };
  } catch {
    return null;
  }
}

/**
 * Real derived word family members from Datamuse (80ms)
 * For phrases, decomposes individual words into real forms
 */
async function fetchDatamuseWordFamily(word: string, posList: string[], timeoutMs = 1500): Promise<WordFamilyItem[]> {
  // If multi-word phrase, extract real roots for constituent words
  if (word.includes(' ')) {
    const tokens = word.split(/\s+/).filter((t) => t.length > 2);
    const result: WordFamilyItem[] = [];
    const seen = new Set<string>();

    for (const token of tokens) {
      try {
        const prefix = token.endsWith('ing') ? token.slice(0, -3) : token.replace(/e$/, '');
        const res = await fetchWithTimeout(
          `https://api.datamuse.com/words?sp=${encodeURIComponent(prefix)}*&md=p&max=4`,
          {},
          1000
        );
        if (res.ok) {
          const array = await res.json();
          const posMap: Record<string, string> = { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb' };
          for (const it of array) {
            const w = it.word.toLowerCase();
            if (!seen.has(w) && !w.includes(' ') && w.length >= 3) {
              seen.add(w);
              const tag = it.tags?.[0];
              result.push({ word: w, pos: posMap[tag] || 'noun' });
              if (result.length >= 4) break;
            }
          }
        }
      } catch {
        // ignore
      }
    }
    if (result.length > 0) return result;
    return tokens.map((t) => ({ word: t, pos: 'noun' }));
  }

  try {
    let prefix = word.toLowerCase();
    if (prefix.endsWith('ity') && prefix.length > 4) {
      prefix = prefix.slice(0, -1); // facilit*
    } else if (prefix.endsWith('tion') && prefix.length > 5) {
      prefix = prefix.slice(0, -3); // relat*
    } else if (prefix.endsWith('e')) {
      prefix = prefix.slice(0, -1);
    } else if (prefix.endsWith('y') && prefix.length > 3) {
      prefix = prefix.slice(0, -1);
    }

    const res = await fetchWithTimeout(
      `https://api.datamuse.com/words?sp=${encodeURIComponent(prefix)}*&md=p&max=12`,
      {},
      timeoutMs
    );
    const posMap: Record<string, string> = { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb' };
    const result: WordFamilyItem[] = [];
    const seen = new Set<string>([word.toLowerCase()]);
    result.push({ word: word.toLowerCase(), pos: posList[0] || 'noun' });

    if (res.ok) {
      const array = await res.json();
      if (Array.isArray(array)) {
        for (const item of array) {
          const w = item.word.toLowerCase();
          if (seen.has(w) || w.includes(' ') || w.includes('-') || w.length < 3) continue;
          seen.add(w);
          const tag = item.tags?.[0];
          const pos = posMap[tag] || 'noun';
          result.push({ word: w, pos });
          if (result.length >= 5) break;
        }
      }
    }

    return result;
  } catch {
    return [{ word: word.toLowerCase(), pos: posList[0] || 'noun' }];
  }
}

/**
 * Collocations from Datamuse
 */
async function fetchDatamuseCollocations(word: string, mainPos: string, timeoutMs = 1500): Promise<string[]> {
  if (word.includes(' ')) {
    return [`secure ${word}`, `require ${word}`, `provide ${word}`];
  }

  try {
    const phrases: string[] = [];
    if (mainPos === 'noun') {
      const res = await fetchWithTimeout(
        `https://api.datamuse.com/words?rel_jjb=${encodeURIComponent(word)}&max=5`,
        {},
        timeoutMs
      );
      if (res.ok) {
        const array = await res.json();
        for (const item of array) {
          if (item.word && !item.word.includes('.') && item.word.length > 2) {
            phrases.push(`${item.word} ${word}`);
            if (phrases.length >= 3) break;
          }
        }
      }
    } else if (mainPos === 'verb') {
      phrases.push(`${word} effectively`, `plan to ${word}`, `${word} carefully`);
    } else if (mainPos === 'adjective') {
      phrases.push(`highly ${word}`, `extremely ${word}`, `prove to be ${word}`);
    }

    if (phrases.length === 0) {
      phrases.push(`master the ${word}`, `practical ${word}`, `key ${word}`);
    }
    return phrases.slice(0, 3);
  } catch {
    return [`master the ${word}`, `practical ${word}`, `key ${word}`];
  }
}

/**
 * Optional Gemini AI enrichment prompt if user provided their API key
 */
async function enrichWithGemini(
  word: string,
  pos: string,
  apiKey: string
): Promise<{
  vietnameseDefinition: string;
  collocations: CollocationItem[];
  wordFamily: WordFamilyItem[];
  examples: ExampleItem[];
  tags: string[];
} | null> {
  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const prompt = `You are a linguist and TOEIC/IELTS teacher. Analyze the English word "${word}" (primary part of speech: ${pos}).
Respond ONLY with a valid JSON object matching this exact TypeScript structure:
{
  "vietnameseDefinition": "Concise, precise Vietnamese meaning (e.g. 'Đàm phán, thương lượng')",
  "collocations": [
    {"phrase": "common collocation 1", "meaningVi": "nghĩa tiếng Việt 1"},
    {"phrase": "common collocation 2", "meaningVi": "nghĩa tiếng Việt 2"},
    {"phrase": "common collocation 3", "meaningVi": "nghĩa tiếng Việt 3"}
  ],
  "wordFamily": [
    {"word": "derived_word_1", "pos": "noun/verb/adjective/adverb"},
    {"word": "derived_word_2", "pos": "noun/verb/adjective/adverb"}
  ],
  "examples": [
    {
      "en": "A clear general English sentence using '${word}'.",
      "vi": "Dịch tiếng Việt câu thông dụng.",
      "context": "general"
    },
    {
      "en": "A realistic workplace or TOEIC context sentence using '${word}'.",
      "vi": "Dịch tiếng Việt câu ngữ cảnh TOEIC công sở.",
      "context": "toeic"
    }
  ],
  "tags": ["#TOEIC", "#Category1", "#Category2"]
}
Do not include markdown fences like \`\`\`json. Return raw JSON.`;

    const res = await fetchWithTimeout(
      endpoint,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      },
      3500
    );

    if (!res.ok) return null;
    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return null;

    const parsed = JSON.parse(rawText.replace(/```json|```/g, '').trim());
    return parsed;
  } catch (err) {
    console.warn('Gemini enrichment failed:', err);
    return null;
  }
}

/**
 * Intelligent High-Speed Lookup Pipeline:
 * Tier 0: In-memory LRU cache (<0.1ms)
 * Tier 1: Local IndexedDB database check (<2ms)
 * Tier 2: Built-in high-yield TOEIC knowledge base (<0.5ms)
 * Tier 3: Parallelized Multi-Source Pipeline (open-vn-en-dict + Datamuse + Wiktionary + Google)
 */
export async function lookupWord(rawWord: string): Promise<WordItem> {
  const query = rawWord.trim().toLowerCase();
  if (!query) {
    throw new Error('Please enter a word to search');
  }

  // Tier 0: Check in-memory cache
  if (MEMORY_CACHE.has(query)) {
    return MEMORY_CACHE.get(query)!;
  }

  // Tier 1: Check Local IndexedDB database (saved or seed words)
  try {
    const existingInDb = await db.words.where('word').equals(query).first();
    if (existingInDb) {
      MEMORY_CACHE.set(query, existingInDb);
      return existingInDb;
    }
  } catch (dbErr) {
    console.warn('IndexedDB fast lookup skipped:', dbErr);
  }

  // Tier 2: Check Built-in Offline Knowledge Base
  const localMatch = LOCAL_KNOWLEDGE_BASE[query];
  if (localMatch) {
    const now = Date.now();
    const wordItem: WordItem = {
      id: `word-${now}-${Math.random().toString(36).slice(2, 7)}`,
      word: query,
      phonetics: {
        us: localMatch.usIpa,
        uk: localMatch.ukIpa,
        audioUs: `https://translate.google.com/translate_tts?ie=UTF-8&tl=en-US&client=tw-ob&q=${encodeURIComponent(query)}`,
        audioUk: `https://translate.google.com/translate_tts?ie=UTF-8&tl=en-GB&client=tw-ob&q=${encodeURIComponent(query)}`,
      },
      pos: localMatch.pos,
      vietnameseDefinition: localMatch.vi,
      englishDefinition: localMatch.enDef,
      meanings: [
        {
          pos: localMatch.pos[0] || 'noun',
          englishDefinition: localMatch.enDef,
          vietnameseDefinition: localMatch.vi,
          synonyms: [],
        },
      ],
      collocations: localMatch.collocations,
      wordFamily: localMatch.wordFamily,
      examples: localMatch.examples,
      tags: localMatch.tags,
      status: 'new',
      createdAt: now,
      updatedAt: now,
      reviewMeta: createInitialReviewMeta(),
    };

    MEMORY_CACHE.set(query, wordItem);
    return wordItem;
  }

  const isPhrase = query.includes(' ');

  // Tier 3: Parallelized High-Speed Multi-Source Pipeline (<400ms)
  const [openVnData, datamuseInfo, wikiInfo, wiktionaryVi, wordFamilyRaw, collocationsRaw, directTrans] = await Promise.all([
    !isPhrase ? fetchOpenVnEnDictData(query, 2500) : Promise.resolve(null),
    !isPhrase ? fetchDatamuseInfo(query, 1500) : Promise.resolve(null),
    fetchWiktionaryData(query, 1200),
    !isPhrase ? fetchWiktionaryVi(query, 1500) : Promise.resolve([]),
    fetchDatamuseWordFamily(query, ['noun'], 1500),
    fetchDatamuseCollocations(query, 'noun', 1500),
    translateToVietnamese(query, 1800),
  ]);

  // Combine POS tags
  const posSet = new Set<string>();
  if (openVnData?.posList) {
    for (const p of openVnData.posList) posSet.add(p);
  }
  if (datamuseInfo?.posList) {
    for (const p of datamuseInfo.posList) posSet.add(p);
  }
  if (wikiInfo?.posList) {
    for (const p of wikiInfo.posList) posSet.add(p);
  }
  if (posSet.size === 0) {
    posSet.add(isPhrase ? 'phrase' : 'noun');
  }
  const posList = Array.from(posSet);
  const mainPos = posList[0];

  // Phonetics (prefer openVnData or datamuse)
  const ipa = openVnData?.ipa || datamuseInfo?.ipa || `/${query}/`;

  // English definition & meanings
  let englishDef = '';
  const parsedMeanings: MeaningItem[] = [];
  if (wikiInfo?.definitions && wikiInfo.definitions.length > 0) {
    englishDef = wikiInfo.definitions[0].definition;
    for (const d of wikiInfo.definitions.slice(0, 4)) {
      parsedMeanings.push({
        pos: d.pos,
        englishDefinition: d.definition,
        vietnameseDefinition: '',
        example: d.examples[0],
      });
    }
  } else if (datamuseInfo?.defs && datamuseInfo.defs.length > 0) {
    englishDef = datamuseInfo.defs[0].def;
    for (const d of datamuseInfo.defs.slice(0, 4)) {
      parsedMeanings.push({
        pos: d.pos,
        englishDefinition: d.def,
        vietnameseDefinition: '',
      });
    }
  }
  if (!englishDef) {
    if (isPhrase && directTrans) {
      englishDef = `Idiom/collocation: "${query}" (${directTrans})`;
    } else {
      englishDef = `Definition for "${query}"`;
    }
  }

  // Synthesize Vietnamese Definition (Multi-Tier Robustness)
  let vietnameseDef = '';
  if (openVnData?.vietnameseDef) {
    vietnameseDef = openVnData.vietnameseDef;
    // If modern direct translation (e.g. "cơ sở") is concise and not present in old dictionary, prepend it as primary meaning
    if (directTrans && directTrans.length >= 2 && !vietnameseDef.toLowerCase().includes(directTrans.toLowerCase())) {
      if (vietnameseDef.startsWith('(')) {
        vietnameseDef = vietnameseDef.replace(/^(\([^)]+\))\s*/, `$1 ${directTrans}, `);
      } else {
        vietnameseDef = `${directTrans}, ${vietnameseDef}`;
      }
    }
  } else if (directTrans) {
    vietnameseDef = directTrans;
  } else if (wiktionaryVi.length > 0) {
    vietnameseDef = wiktionaryVi.slice(0, 4).join(', ');
  } else {
    // If still empty, try translating query directly
    const fallbackTrans = await translateToVietnamese(query, 1500);
    vietnameseDef = fallbackTrans || `Từ vựng "${query}"`;
  }

  // Synthesize Collocations
  let collocations: CollocationItem[] = [];
  if (openVnData?.collocations && openVnData.collocations.length >= 2) {
    collocations = openVnData.collocations.slice(0, 4);
  } else if (isPhrase) {
    const firstWord = query.split(' ')[0].toLowerCase();
    const isVerbStart = ['secure', 'cut', 'provide', 'seek', 'obtain', 'request', 'conduct', 'take', 'make', 'do', 'have', 'reach', 'manage', 'reduce', 'improve', 'increase'].includes(firstWord);

    collocations = isVerbStart
      ? [
          { phrase: `plan to ${query}`, meaningVi: `lên kế hoạch để ${vietnameseDef}` },
          { phrase: `successfully ${query}`, meaningVi: `${vietnameseDef} thành công` },
          { phrase: `effort to ${query}`, meaningVi: `nỗ lực ${vietnameseDef}` },
          { phrase: `fail to ${query}`, meaningVi: `không thể ${vietnameseDef}` },
        ]
      : [
          { phrase: `require ${query}`, meaningVi: `yêu cầu ${vietnameseDef}` },
          { phrase: `provide ${query}`, meaningVi: `cung cấp ${vietnameseDef}` },
          { phrase: `seek ${query}`, meaningVi: `tìm kiếm ${vietnameseDef}` },
          { phrase: `manage ${query}`, meaningVi: `quản lý ${vietnameseDef}` },
        ];
  }

  // Synthesize Contextual Examples
  let examples: ExampleItem[] = [];
  if (openVnData?.examples && openVnData.examples.length >= 2) {
    examples = openVnData.examples.slice(0, 2);
  } else if (isPhrase) {
    const firstWord = query.split(' ')[0].toLowerCase();
    const isVerbStart = ['secure', 'cut', 'provide', 'seek', 'obtain', 'request', 'conduct', 'take', 'make', 'do', 'have', 'reach', 'manage', 'reduce', 'improve', 'increase'].includes(firstWord);

    examples = isVerbStart
      ? [
          {
            en: `The committee agreed that we must ${query} before the end of this quarter.`,
            vi: `Hội đồng đã nhất trí rằng chúng ta cần ${vietnameseDef} trước khi kết thúc quý này.`,
            context: 'toeic',
          },
          {
            en: `Our primary corporate objective this year is to ${query} effectively.`,
            vi: `Mục tiêu hàng đầu của doanh nghiệp trong năm nay là ${vietnameseDef} một cách hiệu quả.`,
            context: 'general',
          },
        ]
      : [
          {
            en: `The management team convened to discuss the importance of ${query} for the upcoming project.`,
            vi: `Ban quản lý đã họp lại để thảo luận về tầm quan trọng của ${vietnameseDef} cho dự án sắp tới.`,
            context: 'toeic',
          },
          {
            en: `The initiative will proceed smoothly once ${query} has been formally established.`,
            vi: `Kế hoạch sẽ tiến triển thuận lợi sau khi ${vietnameseDef} được chính thức thiết lập.`,
            context: 'general',
          },
        ];
  }

  // If translations needed for single words (collocations or examples), execute concurrently
  if (!isPhrase && (collocations.length === 0 || examples.length === 0)) {
    const batchPhrases = collocationsRaw.length > 0 ? collocationsRaw : [`master the ${query}`, `practical ${query}`, `key ${query}`];
    
    const wikiExamples: string[] = [];
    if (wikiInfo?.definitions) {
      for (const d of wikiInfo.definitions) {
        for (const ex of d.examples) {
          if (ex && !wikiExamples.includes(ex)) wikiExamples.push(ex);
        }
      }
    }
    const genExampleEn = wikiExamples[0] || `Understanding how to use "${query}" is essential in everyday communication.`;
    const toeicExampleEn = wikiExamples[1] || `The management discussed how to apply "${query}" effectively during the project review.`;

    const [collocTransRaw, exTransRaw] = await Promise.all([
      collocations.length === 0 ? translateToVietnamese(batchPhrases.join('\n---BREAK---\n'), 1200) : Promise.resolve(''),
      examples.length === 0 ? translateToVietnamese(`${genExampleEn}\n---BREAK---\n${toeicExampleEn}`, 1200) : Promise.resolve(''),
    ]);

    if (collocations.length === 0) {
      let translatedColloc: string[] = [];
      if (collocTransRaw) {
        translatedColloc = collocTransRaw.split(/\n?---BREAK---\n?/).map((s) => s.trim());
      }
      collocations = batchPhrases.map((phrase, i) => ({
        phrase,
        meaningVi: translatedColloc[i] || 'cụm từ thông dụng',
      }));
    }

    if (examples.length === 0) {
      let transEx1 = '';
      let transEx2 = '';
      if (exTransRaw) {
        const parts = exTransRaw.split(/\n?---BREAK---\n?/).map((s) => s.trim());
        transEx1 = parts[0] || '';
        transEx2 = parts[1] || '';
      }
      examples = [
        {
          en: genExampleEn,
          vi: transEx1 || 'Ví dụ minh họa cách sử dụng từ vựng.',
          context: 'general',
        },
        {
          en: toeicExampleEn,
          vi: transEx2 || 'Ví dụ trong môi trường làm việc và đề thi TOEIC.',
          context: 'toeic',
        },
      ];
    }
  }

  // Word Family
  const wordFamily = wordFamilyRaw.length > 0
    ? wordFamilyRaw
    : [{ word: query, pos: mainPos }];

  // Optional Gemini enrichment if user configured key
  let aiData: any = null;
  try {
    const settings = await getAppSettings();
    if (settings.geminiApiKey && settings.geminiApiKey.trim().length > 10) {
      aiData = await enrichWithGemini(query, mainPos, settings.geminiApiKey.trim());
      if (aiData?.vietnameseDefinition) vietnameseDef = aiData.vietnameseDefinition;
      if (aiData?.collocations?.length) collocations.splice(0, collocations.length, ...aiData.collocations);
      if (aiData?.wordFamily?.length) wordFamily.splice(0, wordFamily.length, ...aiData.wordFamily);
      if (aiData?.examples?.length) examples.splice(0, examples.length, ...aiData.examples);
    }
  } catch {
    // ignore
  }

  const now = Date.now();
  const wordItem: WordItem = {
    id: `word-${now}-${Math.random().toString(36).slice(2, 7)}`,
    word: query,
    phonetics: {
      us: ipa,
      uk: ipa,
      audioUs: `https://translate.google.com/translate_tts?ie=UTF-8&tl=en-US&client=tw-ob&q=${encodeURIComponent(query)}`,
      audioUk: `https://translate.google.com/translate_tts?ie=UTF-8&tl=en-GB&client=tw-ob&q=${encodeURIComponent(query)}`,
    },
    pos: posList,
    vietnameseDefinition: vietnameseDef,
    englishDefinition: englishDef,
    meanings: parsedMeanings.length > 0 ? parsedMeanings : [
      {
        pos: mainPos,
        englishDefinition: englishDef,
        vietnameseDefinition: vietnameseDef,
      },
    ],
    collocations,
    wordFamily,
    examples,
    tags: aiData?.tags || ['#TOEIC', '#Vocabulary'],
    status: 'new',
    createdAt: now,
    updatedAt: now,
    reviewMeta: createInitialReviewMeta(),
  };

  // Cache in memory for 0ms repeat searches
  MEMORY_CACHE.set(query, wordItem);

  return wordItem;
}

/**
 * Pre-cache words in memory for instantaneous search responses
 */
export function warmSearchCache(words: WordItem[]) {
  for (const w of words) {
    if (w.word) {
      MEMORY_CACHE.set(w.word.toLowerCase().trim(), w);
    }
  }
}
