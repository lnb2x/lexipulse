import type { CollocationItem, ExampleItem, WordFamilyItem } from '../../types/vocab';

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
  pool: {
    vi: '1. Bể bơi, hồ bơi; vũng nước; 2. Nhóm người, đội ngũ sẵn có (talent pool, pool of candidates); 3. Quỹ chung, nguồn lực chung (resource pool); 4. (v) Gom góp, đóng góp chung vốn/nguồn lực',
    enDef: '1. A swimming pool or body of water; 2. A group of people or resources available for work (e.g. talent pool, candidate pool); 3. A shared supply of money or resources; 4. (verb) To put funds or resources together for joint use.',
    usIpa: '/puːl/',
    ukIpa: '/puːl/',
    pos: ['noun', 'verb'],
    collocations: [
      { phrase: 'talent pool', meaningVi: 'nguồn nhân tài, lực lượng ứng viên giỏi' },
      { phrase: 'pool of candidates', meaningVi: 'nhóm ứng viên tiềm năng' },
      { phrase: 'pool resources', meaningVi: 'gom chung tài nguyên/nguồn lực' },
      { phrase: 'swimming pool', meaningVi: 'bể bơi, hồ bơi' },
      { phrase: 'pool of funds', meaningVi: 'quỹ đóng góp chung, nguồn vốn góp' },
      { phrase: 'car pool', meaningVi: 'đi chung xe (chia sẻ phương tiện)' },
    ],
    wordFamily: [
      { word: 'pool', pos: 'noun', meaningVi: 'hồ bơi; nhóm người; quỹ chung' },
      { word: 'pool', pos: 'verb', meaningVi: 'gom góp, chung vốn, hợp lực' },
      { word: 'pooling', pos: 'noun', meaningVi: 'sự gom góp, sự tập hợp nguồn lực' },
    ],
    examples: [
      {
        en: 'The human resources division maintains a diverse talent pool of highly qualified candidates for management roles.',
        vi: 'Bộ phận nhân sự duy trì một nhóm nhân tài đa dạng gồm các ứng viên có trình độ cao cho các vị trí quản lý.',
        context: 'workplace',
      },
      {
        en: 'Several technology companies agreed to pool their resources to accelerate research on clean energy.',
        vi: 'Nhiều công ty công nghệ đã đồng ý gom chung nguồn lực để đẩy nhanh tiến độ nghiên cứu về năng lượng sạch.',
        context: 'toeic',
      },
      {
        en: 'The apartment complex offers a heated swimming pool and a fitness center.',
        vi: 'Khu chung cư có một hồ bơi nước ấm và một phòng tập thể dục.',
        context: 'general',
      },
    ],
    tags: ['#TOEIC', '#HR', '#Business', '#Polysemous'],
  },
  'a pool': {
    vi: '1. Một hồ bơi, bể bơi; 2. Một nhóm người, đội ngũ sẵn có (talent pool, candidate pool); 3. Một nguồn quỹ/tài nguyên chung',
    enDef: '1. A swimming pool; 2. A group or supply of people available for work; 3. A shared supply of resources or funds.',
    usIpa: '/ə puːl/',
    ukIpa: '/ə puːl/',
    pos: ['phrase', 'noun'],
    collocations: [
      { phrase: 'a pool of talent', meaningVi: 'một nhóm người tài năng, nguồn nhân lực' },
      { phrase: 'a pool of candidates', meaningVi: 'một nhóm ứng viên tiềm năng' },
      { phrase: 'a pool of resources', meaningVi: 'một nguồn tài nguyên chung' },
      { phrase: 'a swimming pool', meaningVi: 'một bể bơi, hồ bơi' },
    ],
    wordFamily: [
      { word: 'pool', pos: 'noun', meaningVi: 'hồ bơi; nhóm người; quỹ chung' },
      { word: 'pool', pos: 'verb', meaningVi: 'gom góp, hợp lực' },
    ],
    examples: [
      {
        en: 'The firm drew from a pool of qualified candidates who had registered in their talent database.',
        vi: 'Công ty đã tuyển chọn từ một nhóm ứng viên đủ tiêu chuẩn đã đăng ký trong cơ sở dữ liệu nhân tài của họ.',
        context: 'workplace',
      },
      {
        en: 'The resort features a pool surrounded by palm trees.',
        vi: 'Khu nghỉ dưỡng có một hồ bơi được bao quanh bởi những hàng cọ.',
        context: 'general',
      },
      {
        en: 'Establishing a pool of shared funds helped the consortium overcome liquidity constraints.',
        vi: 'Việc thành lập một quỹ nguồn vốn chung đã giúp liên doanh vượt qua các hạn chế về thanh khoản.',
        context: 'toeic',
      },
    ],
    tags: ['#TOEIC', '#HR', '#Phrase', '#Polysemous'],
  },
};

/**
 * Common English function words, prepositions, articles and auxiliaries with standard IPA.
 */
export const COMMON_WORDS_IPA: Record<string, string> = {
  a: 'ə', an: 'ən', the: 'ðə', to: 'tuː', of: 'əv', in: 'ɪn', for: 'fɔːr',
  on: 'ɒn', with: 'wɪð', at: 'æt', by: 'baɪ', from: 'frɒm', up: 'ʌp',
  about: 'əˈbaʊt', into: 'ˈɪntuː', over: 'ˈoʊvər', after: 'ˈæftər',
  out: 'aʊt', down: 'daʊn', off: 'ɒf', through: 'θruː', between: 'bɪˈtwiːn',
  under: 'ˈʌndər', behind: 'bɪˈhaɪnd', across: 'əˈkrɒs', and: 'ænd', but: 'bʌt',
  or: 'ɔːr', nor: 'nɔːr', so: 'soʊ', yet: 'jet', if: 'ɪf', as: 'æz',
  is: 'ɪz', are: 'ɑːr', was: 'wɒz', were: 'wɜːr', be: 'biː', been: 'biːn',
  being: 'ˈbiːɪŋ', have: 'hæv', has: 'hæz', had: 'hæd', do: 'duː', does: 'dʌz',
  did: 'dɪd', will: 'wɪl', would: 'wʊd', can: 'kæn', could: 'kʊd', may: 'meɪ',
  might: 'maɪt', must: 'mʌst', should: 'ʃʊd', shall: 'ʃæl', not: 'nɒt',
  all: 'ɔːl', any: 'ˈeni', some: 'sʌm', no: 'noʊ', each: 'iːtʃ', every: 'ˈevri',
  other: 'ˈʌðər', another: 'əˈnʌðər', such: 'sʌtʃ', only: 'ˈoʊnli', own: 'oʊn',
  same: 'seɪm', than: 'ðæn', too: 'tuː', very: 'ˈveri', just: 'dʒʌst',
  this: 'ðɪs', that: 'ðæt', these: 'ðiːz', those: 'ðoʊz', what: 'wɒt',
  which: 'wɪtʃ', who: 'huː', whom: 'huːm', whose: 'huːz', where: 'weər',
  when: 'wen', why: 'waɪ', how: 'haʊ', there: 'ðeər', here: 'hɪər',
  i: 'aɪ', you: 'juː', he: 'hiː', she: 'ʃiː', it: 'ɪt', we: 'wiː', they: 'ðeɪ',
  me: 'miː', him: 'hɪm', her: 'hɜːr', us: 'ʌs', them: 'ðem', my: 'maɪ',
  your: 'jɔːr', his: 'hɪz', its: 'ɪts', our: 'aʊər', their: 'ðeər',
};

export const STATIC_KB_CANDIDATES = Object.entries(LOCAL_KNOWLEDGE_BASE).map(([word, data]) => ({
  word,
  meaningVi: data.vi,
  pos: data.pos?.[0] || 'word',
  source: 'builtin' as const,
}));
