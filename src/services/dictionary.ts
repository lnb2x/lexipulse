import { db, getAppSettings } from './db';
import { createInitialReviewMeta } from './sm2';
import { enrichWordWithAI } from './ai';
import type { CollocationItem, ExampleItem, MeaningItem, SpellingSuggestion, WordFamilyItem, WordItem } from '../types/vocab';
import { findFuzzyMatches, stringSimilarity } from '../utils/fuzzySearch';

export class WordNotFoundError extends Error {
  query: string;
  suggestions: SpellingSuggestion[];

  constructor(query: string, suggestions: SpellingSuggestion[] = [], message?: string) {
    super(message || `No definitions found for "${query}"`);
    this.name = 'WordNotFoundError';
    this.query = query;
    this.suggestions = suggestions;
  }
}


export interface LookupOptions {
  signal?: AbortSignal;
  onEnriched?: (word: WordItem) => void;
}

export class LRUCache<K, V> {
  private capacity: number;
  private map: Map<K, V>;

  constructor(capacity = 500) {
    this.capacity = capacity;
    this.map = new Map<K, V>();
  }

  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key)!;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.capacity) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) {
        this.map.delete(oldest);
      }
    }
    this.map.set(key, value);
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  delete(key: K): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}

export function normalizeWordKey(rawWord: string): string {
  return (rawWord || '').trim().toLowerCase();
}

// Bounded LRU Cache for words (max 500 items)
export const WORD_LRU_CACHE = new LRUCache<string, WordItem>(500);
export const MEMORY_CACHE = WORD_LRU_CACHE;

// In-flight lookup deduplication map
const IN_FLIGHT_LOOKUPS = new Map<string, Promise<WordItem>>();

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
 * Fast fetch with timeout and external AbortSignal to prevent hanging UI
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 2500,
  externalSignal?: AbortSignal
): Promise<Response> {
  if (externalSignal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new DOMException(`Request timeout of ${timeoutMs}ms exceeded`, 'TimeoutError'));
  }, timeoutMs);

  const onExternalAbort = () => {
    controller.abort(externalSignal?.reason || new DOMException('Aborted by user', 'AbortError'));
  };

  if (externalSignal) {
    externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
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
 * Bounded translation cache with TTL (24h) to guarantee 0ms response for repeated translations
 */
interface CachedTranslation {
  result: string;
  expires: number;
}
export const TRANSLATION_CACHE = new LRUCache<string, CachedTranslation>(500);
const IN_FLIGHT_TRANSLATIONS = new Map<string, Promise<string>>();

// Circuit breaker for translation endpoints
interface CircuitBreakerState {
  failures: number;
  nextAllowedTime: number;
  disabled?: boolean;
}
const translationCircuitBreakers: Record<string, CircuitBreakerState> = {
  viteProxy: { failures: 0, nextAllowedTime: 0 },
  googleMobile: { failures: 0, nextAllowedTime: 0 },
  lingva: { failures: 0, nextAllowedTime: 0 },
};

function recordEndpointFailure(endpoint: string) {
  const cb = translationCircuitBreakers[endpoint];
  if (!cb) return;
  cb.failures++;
  if (cb.failures >= 2) {
    cb.nextAllowedTime = Date.now() + 60_000; // Open circuit for 60 seconds
  }
}

function recordEndpointSuccess(endpoint: string) {
  const cb = translationCircuitBreakers[endpoint];
  if (!cb) return;
  cb.failures = 0;
  cb.nextAllowedTime = 0;
}

function isEndpointAvailable(endpoint: string): boolean {
  const cb = translationCircuitBreakers[endpoint];
  if (!cb) return true;
  if (cb.disabled) return false;
  return Date.now() >= cb.nextAllowedTime;
}

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
        .map((p) => `(${p}) ${definitionsByPos[p].slice(0, 4).join(', ')}`)
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
async function fetchOpenVnEnDictData(
  word: string,
  timeoutMs = 1500,
  externalSignal?: AbortSignal
): Promise<OpenVnDictResult | null> {
  const query = word.trim().toLowerCase();

  const fetchSingle = async (f: string): Promise<OpenVnDictResult | null> => {
    try {
      const res = await fetchWithTimeout(
        `https://raw.githubusercontent.com/samuraitruong/open-vn-en-dict/master/data/${encodeURIComponent(f)}.json`,
        {},
        timeoutMs,
        externalSignal
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
export async function fetchWiktionaryVi(
  word: string,
  timeoutMs = 1200,
  externalSignal?: AbortSignal
): Promise<string[]> {
  try {
    const encoded = encodeURIComponent(word.trim().toLowerCase());
    const res = await fetchWithTimeout(
      `https://en.wiktionary.org/w/api.php?action=parse&page=${encoded}&prop=wikitext&format=json&origin=*`,
      { headers: { 'User-Agent': 'LexiPulse/1.0' } },
      timeoutMs,
      externalSignal
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
 * Optimized Vietnamese translation with bounded LRU cache, TTL, in-flight dedup,
 * circuit breaker, shared deadline, and AbortSignal support.
 */
export async function translateToVietnamese(
  text: string,
  timeoutMs = 1800,
  signal?: AbortSignal
): Promise<string> {
  const clean = text?.trim();
  if (!clean) return '';

  if (signal?.aborted) {
    return '';
  }

  // Check LRU cache with TTL (24 hours)
  const cached = TRANSLATION_CACHE.get(clean);
  if (cached && cached.expires > Date.now()) {
    return cached.result;
  }

  // Deduplicate in-flight requests for identical text
  if (IN_FLIGHT_TRANSLATIONS.has(clean)) {
    return IN_FLIGHT_TRANSLATIONS.get(clean)!;
  }

  const translationPromise = (async (): Promise<string> => {
    const deadline = Date.now() + timeoutMs;
    const TTL = 24 * 60 * 60 * 1000;

    // Detect if Vite proxy endpoint is available (only in dev mode)
    const isViteDev =
      typeof window !== 'undefined' &&
      typeof import.meta !== 'undefined' &&
      import.meta.env?.DEV;

    if (!isViteDev) {
      translationCircuitBreakers.viteProxy.disabled = true;
    }

    // 1. Try Vite local dev proxy (/api/translate) if available and healthy
    if (isEndpointAvailable('viteProxy')) {
      const rem = Math.max(100, deadline - Date.now());
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
          Math.min(rem, 600),
          signal
        );

        if (res.ok) {
          const data = await res.json();
          if (data.text) {
            const result = data.text.trim();
            recordEndpointSuccess('viteProxy');
            TRANSLATION_CACHE.set(clean, { result, expires: Date.now() + TTL });
            return result;
          }
        } else if (res.status === 404) {
          translationCircuitBreakers.viteProxy.disabled = true;
        } else {
          recordEndpointFailure('viteProxy');
        }
      } catch {
        recordEndpointFailure('viteProxy');
      }
    }

    // 2. Direct Google Translate mobile endpoint
    if (isEndpointAvailable('googleMobile')) {
      const rem = Math.max(100, deadline - Date.now());
      if (rem > 120 && !signal?.aborted) {
        try {
          const res = await fetchWithTimeout(
            `https://translate.google.com/m?sl=en&tl=vi&q=${encodeURIComponent(clean)}`,
            {
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              },
            },
            Math.min(rem, 900),
            signal
          );
          if (res.ok) {
            const html = await res.text();
            const match = html.match(/<div class="result-container">([\s\S]*?)<\/div>/i);
            if (match && match[1]) {
              const result = cleanHtmlAndEntities(match[1]);
              if (result) {
                recordEndpointSuccess('googleMobile');
                TRANSLATION_CACHE.set(clean, { result, expires: Date.now() + TTL });
                return result;
              }
            }
          } else {
            recordEndpointFailure('googleMobile');
          }
        } catch {
          recordEndpointFailure('googleMobile');
        }
      }
    }

    // 3. Lingva public instance (fallback)
    if (isEndpointAvailable('lingva')) {
      const rem = Math.max(100, deadline - Date.now());
      if (rem > 150 && !signal?.aborted) {
        try {
          const res = await fetchWithTimeout(
            `https://translate.plausibility.cloud/api/v1/en/vi/${encodeURIComponent(clean)}`,
            {},
            Math.min(rem, 900),
            signal
          );
          if (res.ok) {
            const data = await res.json();
            if (data.translation) {
              const result = data.translation.trim();
              recordEndpointSuccess('lingva');
              TRANSLATION_CACHE.set(clean, { result, expires: Date.now() + TTL });
              return result;
            }
          } else {
            recordEndpointFailure('lingva');
          }
        } catch {
          recordEndpointFailure('lingva');
        }
      }
    }

    return '';
  })();

  IN_FLIGHT_TRANSLATIONS.set(clean, translationPromise);
  try {
    return await translationPromise;
  } finally {
    IN_FLIGHT_TRANSLATIONS.delete(clean);
  }
}


/**
 * Datamuse API query for accurate IPA, parts of speech, and English definitions (80ms)
 */
async function fetchDatamuseInfo(
  word: string,
  timeoutMs = 1500,
  externalSignal?: AbortSignal
): Promise<{
  matchedWord: string;
  isExact: boolean;
  ipa: string;
  posList: string[];
  defs: Array<{ pos: string; def: string }>;
} | null> {
  try {
    const res = await fetchWithTimeout(
      `https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=rdp&ipa=1&max=1`,
      {},
      timeoutMs,
      externalSignal
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

    const matchedWord = typeof item.word === 'string' ? item.word.trim() : word;
    const isExact = matchedWord.toLowerCase() === word.toLowerCase();

    return { matchedWord, isExact, ipa, posList, defs };
  } catch {
    return null;
  }
}

/**
 * Common English function words, prepositions, articles and auxiliaries with standard IPA.
 */
const COMMON_WORDS_IPA: Record<string, string> = {
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

function cleanIpa(rawIpa: string): string {
  if (!rawIpa) return '';
  return rawIpa.replace(/^\/+|\/+$/g, '').replace(/^[\[\(]+|[\]\)]+$/g, '').trim();
}

/**
 * Resolves IPA for a single word using cache, knowledge base, open-vn-en-dict, and Datamuse.
 */
async function resolveSingleWordIpa(rawWord: string): Promise<string> {
  const w = rawWord.trim().toLowerCase().replace(/^[^\w]+|[^\w]+$/g, '');
  if (!w) return '';

  // 1. Common words dictionary
  if (COMMON_WORDS_IPA[w]) {
    return COMMON_WORDS_IPA[w];
  }

  // 2. Built-in Knowledge Base
  if (LOCAL_KNOWLEDGE_BASE[w]?.usIpa) {
    return cleanIpa(LOCAL_KNOWLEDGE_BASE[w].usIpa);
  }

  // 3. Memory cache
  if (MEMORY_CACHE.has(w)) {
    const cached = MEMORY_CACHE.get(w);
    if (cached?.phonetics?.us) {
      return cleanIpa(cached.phonetics.us);
    }
  }

  // 4. Online parallel query (OpenVnDict + Datamuse)
  try {
    const [openVn, datamuse] = await Promise.all([
      fetchOpenVnEnDictData(w, 1500),
      fetchDatamuseInfo(w, 1500),
    ]);
    const ipa = openVn?.ipa || datamuse?.ipa;
    if (ipa) {
      return cleanIpa(ipa);
    }
  } catch {
    // fallback
  }

  return '';
}

/**
 * Resolves accurate IPA for multi-word phrases (e.g. "floral arrangement", "take into account")
 * by resolving each constituent word and combining them cleanly.
 */
async function resolvePhraseIpa(phrase: string): Promise<string> {
  const words = phrase.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) {
    const singleIpa = await resolveSingleWordIpa(words[0]);
    return singleIpa ? `/${singleIpa}/` : '';
  }

  // Resolve all words in parallel
  const wordIpas = await Promise.all(words.map((w) => resolveSingleWordIpa(w)));

  // If at least one word has a valid phonetic representation, combine
  const hasAnyValid = wordIpas.some((ipa) => ipa.length > 0);
  if (!hasAnyValid) return '';

  const combined = wordIpas
    .map((ipa, idx) => ipa || words[idx].toLowerCase())
    .join(' ');

  return `/${combined}/`;
}

const STATIC_KB_CANDIDATES = Object.entries(LOCAL_KNOWLEDGE_BASE).map(([word, data]) => ({
  word,
  meaningVi: data.vi,
  pos: data.pos?.[0] || 'word',
  source: 'builtin' as const,
}));

const SUGGESTION_CACHE = new LRUCache<string, { results: SpellingSuggestion[]; expires: number }>(300);
const IN_FLIGHT_SUGGESTIONS = new Map<string, Promise<SpellingSuggestion[]>>();

/**
 * Intelligent Spelling Suggestions & Typo Correction with LRU caching, TTL and AbortSignal
 */
export async function getSpellingSuggestions(
  rawQuery: string,
  deckWords: WordItem[] = [],
  signal?: AbortSignal
): Promise<SpellingSuggestion[]> {
  const q = rawQuery.trim().toLowerCase();
  if (!q || q.length < 2 || signal?.aborted) return [];

  // Check cache (TTL 5 minutes)
  const cached = SUGGESTION_CACHE.get(q);
  if (cached && cached.expires > Date.now()) {
    return cached.results;
  }

  if (IN_FLIGHT_SUGGESTIONS.has(q)) {
    return IN_FLIGHT_SUGGESTIONS.get(q)!;
  }

  const suggestionPromise = (async (): Promise<SpellingSuggestion[]> => {
    const results: SpellingSuggestion[] = [];
    const seenWords = new Set<string>([q]);

    // 1. Check user's Deck words with fuzzy matching
    if (deckWords.length > 0) {
      const deckCandidates = deckWords.map((w) => ({
        word: w.word,
        meaningVi: w.vietnameseDefinition,
        pos: w.pos?.[0] || 'word',
        source: 'deck' as const,
      }));
      const deckFuzzy = findFuzzyMatches(q, deckCandidates, (item) => item.word, 0.62, 3);
      for (const match of deckFuzzy) {
        if (!seenWords.has(match.key)) {
          seenWords.add(match.key);
          results.push({
            word: match.item.word,
            meaningVi: match.item.meaningVi,
            pos: match.item.pos,
            source: 'deck',
            score: match.similarity,
          });
        }
      }
    }

    // 2. Check pre-computed Built-in Knowledge Base with fuzzy matching
    const kbFuzzy = findFuzzyMatches(q, STATIC_KB_CANDIDATES, (item) => item.word, 0.62, 3);
    for (const match of kbFuzzy) {
      if (!seenWords.has(match.key)) {
        seenWords.add(match.key);
        results.push({
          word: match.item.word,
          meaningVi: match.item.meaningVi,
          pos: match.item.pos,
          source: 'builtin',
          score: match.similarity,
        });
      }
    }

    // 3. Online Datamuse suggestions & spelling
    if (!signal?.aborted) {
      try {
        const [sugRes, spRes] = await Promise.all([
          fetchWithTimeout(`https://api.datamuse.com/sug?s=${encodeURIComponent(q)}&max=6`, {}, 800, signal),
          fetchWithTimeout(`https://api.datamuse.com/words?sp=${encodeURIComponent(q)}&max=6`, {}, 800, signal),
        ]);

        const onlineCandidates: string[] = [];

        if (sugRes.ok) {
          const arr = await sugRes.json();
          if (Array.isArray(arr)) {
            for (const item of arr) {
              if (item.word && typeof item.word === 'string') {
                const w = item.word.trim().toLowerCase();
                if (!seenWords.has(w) && !w.includes(' ') && w.length >= 2) {
                  onlineCandidates.push(w);
                }
              }
            }
          }
        }

        if (spRes.ok) {
          const arr = await spRes.json();
          if (Array.isArray(arr)) {
            for (const item of arr) {
              if (item.word && typeof item.word === 'string') {
                const w = item.word.trim().toLowerCase();
                if (!seenWords.has(w) && !w.includes(' ') && w.length >= 2) {
                  onlineCandidates.push(w);
                }
              }
            }
          }
        }

        for (const w of onlineCandidates) {
          if (!seenWords.has(w)) {
            seenWords.add(w);
            const kbMatch = LOCAL_KNOWLEDGE_BASE[w];
            const deckMatch = deckWords.find((dw) => dw.word.toLowerCase() === w);
            const sim = stringSimilarity(q, w);
            results.push({
              word: w,
              meaningVi: kbMatch?.vi || deckMatch?.vietnameseDefinition || '',
              pos: kbMatch?.pos?.[0] || deckMatch?.pos?.[0] || 'word',
              source: deckMatch ? 'deck' : kbMatch ? 'builtin' : 'dictionary',
              score: sim,
            });
          }
          if (results.length >= 6) break;
        }
      } catch {
        // ignore network timeouts
      }
    }

    const sorted = results.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 5);
    SUGGESTION_CACHE.set(q, { results: sorted, expires: Date.now() + 5 * 60 * 1000 });
    return sorted;
  })();

  IN_FLIGHT_SUGGESTIONS.set(q, suggestionPromise);
  try {
    return await suggestionPromise;
  } finally {
    IN_FLIGHT_SUGGESTIONS.delete(q);
  }
}

/**
 * Wiktionary REST API for rich definitions and real natural examples
 */
async function fetchWiktionaryData(
  word: string,
  timeoutMs = 1200,
  externalSignal?: AbortSignal
): Promise<{
  posList: string[];
  definitions: Array<{ pos: string; definition: string; examples: string[] }>;
} | null> {
  try {
    const res = await fetchWithTimeout(
      `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`,
      { headers: { 'User-Agent': 'LexiPulse/1.0' } },
      timeoutMs,
      externalSignal
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
async function fetchDatamuseWordFamily(
  word: string,
  posList: string[],
  timeoutMs = 1500,
  externalSignal?: AbortSignal
): Promise<WordFamilyItem[]> {
  if (externalSignal?.aborted) return [{ word: word.toLowerCase(), pos: posList[0] || 'noun' }];

  // If multi-word phrase, extract real roots for constituent words
  if (word.includes(' ')) {
    const tokens = word.split(/\s+/).filter((t) => t.length > 2);
    const result: WordFamilyItem[] = [];
    const seen = new Set<string>();

    for (const token of tokens) {
      if (externalSignal?.aborted) break;
      try {
        const prefix = token.endsWith('ing') ? token.slice(0, -3) : token.replace(/e$/, '');
        const res = await fetchWithTimeout(
          `https://api.datamuse.com/words?sp=${encodeURIComponent(prefix)}*&md=p&max=4`,
          {},
          1000,
          externalSignal
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
      timeoutMs,
      externalSignal
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
async function fetchDatamuseCollocations(
  word: string,
  mainPos: string,
  timeoutMs = 1500,
  externalSignal?: AbortSignal
): Promise<string[]> {
  if (externalSignal?.aborted) return [`master the ${word}`, `practical ${word}`, `key ${word}`];

  if (word.includes(' ')) {
    return [`secure ${word}`, `require ${word}`, `provide ${word}`];
  }

  try {
    const phrases: string[] = [];
    if (mainPos === 'noun') {
      const res = await fetchWithTimeout(
        `https://api.datamuse.com/words?rel_jjb=${encodeURIComponent(word)}&max=5`,
        {},
        timeoutMs,
        externalSignal
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
      phrases.push(`master the ${word}`, `practical ${word}`, `key ${word}` );
    }
    return phrases.slice(0, 3);
  } catch {
    return [`master the ${word}`, `practical ${word}`, `key ${word}`];
  }
}



/**
 * Concurrency limiter for background enrichments (max 2 concurrent)
 */
let activeEnrichmentTasks = 0;
const enrichmentQueue: Array<() => void> = [];

async function acquireEnrichmentSlot(): Promise<void> {
  if (activeEnrichmentTasks < 2) {
    activeEnrichmentTasks++;
    return;
  }
  return new Promise<void>((resolve) => {
    enrichmentQueue.push(() => {
      activeEnrichmentTasks++;
      resolve();
    });
  });
}

function releaseEnrichmentSlot(): void {
  activeEnrichmentTasks--;
  if (enrichmentQueue.length > 0) {
    const next = enrichmentQueue.shift();
    next?.();
  }
}

/**
 * Background enrichment: collocations, examples, word family and AI
 */
async function scheduleBackgroundEnrichment(
  baseWord: WordItem,
  signal?: AbortSignal,
  onEnriched?: (word: WordItem) => void
): Promise<void> {
  if (!onEnriched || signal?.aborted) return;
  const query = normalizeWordKey(baseWord.word);

  // Run in background without blocking caller
  setTimeout(async () => {
    if (signal?.aborted) return;
    await acquireEnrichmentSlot();
    try {
      if (signal?.aborted) return;
      const mainPos = baseWord.pos[0] || 'noun';
      const isPhrase = query.includes(' ');
      const articleMatch = query.match(/^(a|an|the|to)\s+([a-z0-9-]+)$/i);
      const targetForDict = !isPhrase ? query : (articleMatch ? articleMatch[2].toLowerCase() : query);

      // 1. Concurrently fetch rich collocations & word family
      const [wfRaw, colRaw] = await Promise.allSettled([
        fetchDatamuseWordFamily(targetForDict, baseWord.pos, 1200, signal),
        fetchDatamuseCollocations(targetForDict, mainPos, 1200, signal),
      ]);

      let richCollocations = [...baseWord.collocations];
      let richWordFamily = [...baseWord.wordFamily];
      let richExamples = [...baseWord.examples];
      let richVietnameseDef = baseWord.vietnameseDefinition;
      let richUsIpa = baseWord.phonetics.us;
      let richUkIpa = baseWord.phonetics.uk;
      let tags = [...baseWord.tags];

      if (wfRaw.status === 'fulfilled' && wfRaw.value?.length > 0) {
        richWordFamily = wfRaw.value;
      }

      if (colRaw.status === 'fulfilled' && colRaw.value?.length > 0 && richCollocations.length <= 2) {
        const batchPhrases = colRaw.value;
        const transRaw = await translateToVietnamese(batchPhrases.join('\n---BREAK---\n'), 1000, signal);
        const transParts = transRaw ? transRaw.split(/\n?---BREAK---\n?/).map((s) => s.trim()) : [];
        richCollocations = batchPhrases.map((phrase, i) => ({
          phrase,
          meaningVi: transParts[i] || 'cụm từ thông dụng',
        }));
      }

      // 2. AI Enrichment if configured
      try {
        const settings = await getAppSettings();
        const apiKey = settings.aiApiKey || settings.geminiApiKey;
        if (settings.aiProvider === 'custom' || (apiKey && apiKey.trim().length >= 5)) {
          const aiData = await enrichWordWithAI(query, mainPos, {
            provider: settings.aiProvider || 'gemini',
            apiKey: (apiKey || '').trim(),
            baseUrl: settings.aiBaseUrl,
            model: settings.aiModel,
            signal,
            timeoutMs: 8000,
          });

          if (aiData) {
            if (aiData.ipaUs) richUsIpa = aiData.ipaUs;
            if (aiData.ipaUk) richUkIpa = aiData.ipaUk;
            if (!richUkIpa && richUsIpa) richUkIpa = richUsIpa;
            if (aiData.vietnameseDefinition) richVietnameseDef = aiData.vietnameseDefinition;
            if (aiData.collocations?.length) richCollocations = aiData.collocations;
            if (aiData.wordFamily?.length) richWordFamily = aiData.wordFamily;
            if (aiData.examples?.length) richExamples = aiData.examples;
            if (aiData.tags?.length) tags = aiData.tags;
          }
        }
      } catch {
        // AI failure is non-fatal
      }

      if (signal?.aborted) return;

      const enrichedWord: WordItem = {
        ...baseWord,
        phonetics: {
          ...baseWord.phonetics,
          us: richUsIpa || baseWord.phonetics.us,
          uk: richUkIpa || baseWord.phonetics.uk,
        },
        vietnameseDefinition: richVietnameseDef,
        collocations: richCollocations,
        wordFamily: richWordFamily,
        examples: richExamples,
        tags,
        updatedAt: Date.now(),
      };

      // Update LRU Cache
      WORD_LRU_CACHE.set(query, enrichedWord);

      // Sync to IndexedDB if word was already saved to deck by user
      try {
        const existingInDb = await db.words.where('word').equals(query).first();
        if (existingInDb) {
          // CRITICAL: Merge ONLY auto-generated fields; DO NOT overwrite id, createdAt, status, reviewMeta, or user tags!
          const merged: WordItem = {
            ...existingInDb,
            phonetics: {
              ...existingInDb.phonetics,
              us: existingInDb.phonetics.us || enrichedWord.phonetics.us,
              uk: existingInDb.phonetics.uk || enrichedWord.phonetics.uk,
            },
            collocations: existingInDb.collocations.length > 0 ? existingInDb.collocations : enrichedWord.collocations,
            wordFamily: existingInDb.wordFamily.length > 0 ? existingInDb.wordFamily : enrichedWord.wordFamily,
            examples: existingInDb.examples.length > 0 ? existingInDb.examples : enrichedWord.examples,
            updatedAt: Date.now(),
          };
          await db.words.put(merged);
        }
      } catch (dbErr) {
        console.warn('Background enrichment DB sync skipped:', dbErr);
      }

      if (!signal?.aborted) {
        onEnriched(enrichedWord);
      }
    } catch (err) {
      console.warn('Background enrichment error:', err);
    } finally {
      releaseEnrichmentSlot();
    }
  }, 10);
}

/**
 * Intelligent Two-Stage High-Speed Lookup Pipeline:
 * Fast Stage:
 *   Tier 0: LRU Memory Cache (<0.1ms)
 *   Tier 1: Local IndexedDB database check (<2ms)
 *   Tier 2: Built-in high-yield TOEIC knowledge base (<0.5ms)
 *   Tier 3: Parallelized Essential Multi-Source Query (<800ms, Promise.allSettled)
 * Background Stage:
 *   Non-blocking enrichment for rich collocations, examples, word family and AI.
 */
export async function lookupWord(rawWord: string, options?: LookupOptions): Promise<WordItem> {
  const query = normalizeWordKey(rawWord);
  if (!query) {
    throw new Error('Please enter a word to search');
  }

  const signal = options?.signal;
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  // Tier 0: Check in-memory LRU cache (<0.1ms)
  const cachedWord = WORD_LRU_CACHE.get(query);
  if (cachedWord) {
    if (options?.onEnriched) {
      scheduleBackgroundEnrichment(cachedWord, signal, options.onEnriched);
    }
    return cachedWord;
  }

  // Check In-Flight Lookups (deduplicate simultaneous requests for same word)
  if (IN_FLIGHT_LOOKUPS.has(query)) {
    const inFlightPromise = IN_FLIGHT_LOOKUPS.get(query)!;
    if (options?.onEnriched) {
      inFlightPromise
        .then((w) => {
          scheduleBackgroundEnrichment(w, signal, options.onEnriched);
        })
        .catch(() => {});
    }
    return inFlightPromise;
  }

  const lookupPromise = (async (): Promise<WordItem> => {
    // Tier 1: Check Local IndexedDB database (<2ms)
    try {
      const existingInDb = await db.words.where('word').equals(query).first();
      if (existingInDb) {
        WORD_LRU_CACHE.set(query, existingInDb);
        if (options?.onEnriched) {
          scheduleBackgroundEnrichment(existingInDb, signal, options.onEnriched);
        }
        return existingInDb;
      }
    } catch (dbErr) {
      console.warn('IndexedDB fast lookup skipped:', dbErr);
    }

    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    // Tier 2: Check Built-in Offline Knowledge Base (<0.5ms)
    let localMatch = LOCAL_KNOWLEDGE_BASE[query];
    if (!localMatch) {
      const articleMatch = query.match(/^(a|an|the|to)\s+([a-z0-9-]+)$/i);
      if (articleMatch) {
        const core = articleMatch[2].toLowerCase();
        if (LOCAL_KNOWLEDGE_BASE[core]) {
          localMatch = LOCAL_KNOWLEDGE_BASE[core];
        }
      }
    }

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

      WORD_LRU_CACHE.set(query, wordItem);
      if (options?.onEnriched) {
        scheduleBackgroundEnrichment(wordItem, signal, options.onEnriched);
      }
      return wordItem;
    }

    const isPhrase = query.includes(' ');
    const articleMatch = query.match(/^(a|an|the|to)\s+([a-z0-9-]+)$/i);
    const coreWord = articleMatch ? articleMatch[2].toLowerCase() : '';
    const targetForDict = !isPhrase ? query : coreWord;

    // Tier 3: Parallelized Fast Essential Sources (<800ms) with Promise.allSettled
    const [openVnRes, datamuseRes, wikiRes, directTransRes, phraseIpaRes] = await Promise.allSettled([
      targetForDict ? fetchOpenVnEnDictData(targetForDict, 800, signal) : Promise.resolve(null),
      targetForDict ? fetchDatamuseInfo(targetForDict, 800, signal) : Promise.resolve(null),
      fetchWiktionaryData(targetForDict || query, 800, signal),
      translateToVietnamese(query, 800, signal),
      isPhrase ? resolvePhraseIpa(query) : Promise.resolve(''),
    ]);

    const openVnData = openVnRes.status === 'fulfilled' ? openVnRes.value : null;
    const datamuseInfo = datamuseRes.status === 'fulfilled' ? datamuseRes.value : null;
    const wikiInfo = wikiRes.status === 'fulfilled' ? wikiRes.value : null;
    const directTrans = directTransRes.status === 'fulfilled' ? directTransRes.value : '';
    const phraseIpa = phraseIpaRes.status === 'fulfilled' ? phraseIpaRes.value : '';

    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

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

    // Phonetics
    let ipa = '';
    if (isPhrase) {
      ipa = phraseIpa || '';
    } else {
      ipa = openVnData?.ipa || datamuseInfo?.ipa || '';
    }

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

    // Check if word is not recognized in standard dictionaries and is likely a typo
    const hasReliableDef =
      (openVnData?.vietnameseDef && openVnData.vietnameseDef.length > 0) ||
      (wikiInfo?.definitions && wikiInfo.definitions.length > 0) ||
      (datamuseInfo?.defs && datamuseInfo.defs.length > 0 && datamuseInfo.isExact);

    if (!isPhrase && !hasReliableDef) {
      const suggestions = await getSpellingSuggestions(query, [], signal);
      if (suggestions.length > 0) {
        throw new WordNotFoundError(
          query,
          suggestions,
          `No definitions found for "${query}". Did you mean "${suggestions[0].word}"?`
        );
      } else if (!directTrans || directTrans.toLowerCase() === query) {
        throw new WordNotFoundError(
          query,
          [],
          `No definitions found for "${query}". Try checking the spelling!`
        );
      }
    }

    // Synthesize Vietnamese Definition
    let vietnameseDef = '';
    if (openVnData?.vietnameseDef) {
      vietnameseDef = openVnData.vietnameseDef;
      if (directTrans && directTrans.length >= 2 && !vietnameseDef.toLowerCase().includes(directTrans.toLowerCase())) {
        if (vietnameseDef.startsWith('(')) {
          vietnameseDef = vietnameseDef.replace(/^(\([^)]+\))\s*/, `$1 ${directTrans}, `);
        } else {
          vietnameseDef = `${directTrans}, ${vietnameseDef}`;
        }
      }
    } else if (directTrans) {
      vietnameseDef = directTrans;
    } else {
      vietnameseDef = `Từ vựng "${query}"`;
    }

    // Fast collocations & examples (use openVnData if available, otherwise fast local templates)
    let collocations: CollocationItem[] = [];
    if (openVnData?.collocations && openVnData.collocations.length >= 2) {
      collocations = openVnData.collocations.slice(0, 4);
    } else {
      collocations = [
        { phrase: `master the ${query}`, meaningVi: `nắm vững ${vietnameseDef}` },
        { phrase: `practical ${query}`, meaningVi: `${vietnameseDef} thực tế` },
      ];
    }

    let examples: ExampleItem[] = [];
    if (openVnData?.examples && openVnData.examples.length >= 2) {
      examples = openVnData.examples.slice(0, 2);
    } else {
      examples = [
        {
          en: `Understanding how to use "${query}" is essential in everyday communication.`,
          vi: `Hiểu cách sử dụng "${query}" là điều cần thiết trong giao tiếp hàng ngày.`,
          context: 'general',
        },
        {
          en: `The management discussed how to apply "${query}" effectively during the project review.`,
          vi: `Ban quản lý đã thảo luận cách áp dụng "${query}" hiệu quả trong đợt đánh giá dự án.`,
          context: 'toeic',
        },
      ];
    }

    const wordFamily: WordFamilyItem[] = [{ word: query, pos: mainPos }];

    const now = Date.now();
    const basicWordItem: WordItem = {
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
      tags: ['#TOEIC', '#Vocabulary'],
      status: 'new',
      createdAt: now,
      updatedAt: now,
      reviewMeta: createInitialReviewMeta(),
    };

    // Cache basic word immediately
    WORD_LRU_CACHE.set(query, basicWordItem);

    // Schedule background enrichment if caller requested
    if (options?.onEnriched) {
      scheduleBackgroundEnrichment(basicWordItem, signal, options.onEnriched);
    }

    return basicWordItem;
  })();

  IN_FLIGHT_LOOKUPS.set(query, lookupPromise);
  try {
    return await lookupPromise;
  } finally {
    IN_FLIGHT_LOOKUPS.delete(query);
  }
}

/**
 * Pre-cache words in memory for instantaneous search responses
 */
export function warmSearchCache(words: WordItem[]) {
  for (const w of words) {
    if (w?.word) {
      WORD_LRU_CACHE.set(normalizeWordKey(w.word), w);
    }
  }
}
