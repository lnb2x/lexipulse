import type { LemmaCandidate, MorphologicalAnalysis, InflectionItem } from '../../types/vocab';
export type { LemmaCandidate, MorphologicalAnalysis, InflectionItem };

/**
 * Common English particles for phrasal verbs
 */
const PHRASAL_PARTICLES = new Set([
  'up', 'down', 'out', 'in', 'off', 'on', 'away', 'back',
  'over', 'through', 'about', 'across', 'along', 'around',
  'into', 'after', 'forward', 'by', 'upon', 'to', 'for', 'with', 'from',
]);

/**
 * Words ending in -s, -ss, -us, -is, etc. that MUST NEVER be stripped mechanically
 */
export const NON_STRIPPABLE_S_WORDS = new Set([
  'business', 'news', 'series', 'species', 'lens', 'physics', 'economics',
  'politics', 'mathematics', 'statistics', 'ethics', 'athletics', 'mechanics',
  'linguistics', 'genetics', 'electronics', 'robotics', 'logistics', 'diagnostics',
  'optics', 'acoustics', 'aerobics', 'diabetes', 'measles', 'rabies', 'rickets',
  'shingles', 'crossroads', 'headquarters', 'means', 'premises', 'barracks',
  'congratulations', 'clothes', 'glasses', 'scissors', 'trousers', 'pants',
  'pliers', 'tongs', 'tweezers', 'binoculars', 'headphones', 'outskirts',
  'surroundings', 'earnings', 'savings', 'thanks', 'belongings',
  // Words ending in -ss, -us, -is
  'process', 'success', 'access', 'address', 'express', 'focus', 'status',
  'canvas', 'chaos', 'crisis', 'analysis', 'basis', 'emphasis', 'oasis',
  'apparatus', 'bonus', 'bus', 'virus', 'campus', 'circus', 'syllabus',
  'census', 'consensus', 'chorus', 'fungus', 'minus', 'plus', 'radius',
  'stimulus', 'surplus', 'genus', 'hiatus', 'prospectus', 'nexus',
  'walrus', 'platypus', 'octopus', 'fetus', 'terminus', 'uterus',
  'abacus', 'citrus', 'lotus', 'mucus', 'sinus', 'genius',
  'debris', 'chassis', 'corps', 'rendezvous', 'bourgeois', 'chamois',
  'alias', 'atlas', 'compass', 'harass', 'embarrass', 'assess', 'dismiss',
  'discuss', 'possess', 'bless', 'stress', 'dress', 'press', 'guess',
  'class', 'glass', 'grass', 'mass', 'pass', 'cross', 'loss', 'toss',
  'boss', 'moss', 'gross', 'less', 'mess', 'chess', 'kiss', 'miss',
  'hiss', 'bliss', 'abyss',
]);

/**
 * Words ending in -ing that are independent established primary nouns or adjectives
 */
export const PRIMARY_ING_NOUNS: Record<string, { pos: string; vi: string }> = {
  meeting: { pos: 'noun', vi: 'cuộc họp, hội nghị' },
  building: { pos: 'noun', vi: 'tòa nhà, công trình xây dựng' },
  training: { pos: 'noun', vi: 'sự đào tạo, huấn luyện' },
  marketing: { pos: 'noun', vi: 'ngành tiếp thị, hoạt động marketing' },
  accounting: { pos: 'noun', vi: 'ngành kế toán' },
  advertising: { pos: 'noun', vi: 'ngành quảng cáo, sự quảng cáo' },
  briefing: { pos: 'noun', vi: 'buổi họp phổ biến, chỉ dẫn ngắn gọn' },
  gathering: { pos: 'noun', vi: 'cuộc tụ họp, buổi gặp mặt' },
  hearing: { pos: 'noun', vi: 'phiên điều trần, thính giác' },
  filing: { pos: 'noun', vi: 'việc nộp hồ sơ, tài liệu lưu trữ' },
  lodging: { pos: 'noun', vi: 'chỗ trọ, nơi lưu trú tạm thời' },
  opening: { pos: 'noun', vi: 'vị trí tuyển dụng còn trống, lễ khai trương' },
  saving: { pos: 'noun', vi: 'tiền tiết kiệm, khoản tiết kiệm' },
  shipping: { pos: 'noun', vi: 'việc giao nhận, vận chuyển hàng hóa' },
  warning: { pos: 'noun', vi: 'lời cảnh báo, sự báo trước' },
  ending: { pos: 'noun', vi: 'phần kết thúc, đoạn cuối' },
  beginning: { pos: 'noun', vi: 'sự khởi đầu, lúc bắt đầu' },
  feeling: { pos: 'noun', vi: 'cảm xúc, cảm giác' },
  meaning: { pos: 'noun', vi: 'ý nghĩa' },
  morning: { pos: 'noun', vi: 'buổi sáng' },
  evening: { pos: 'noun', vi: 'buổi tối' },
  ceiling: { pos: 'noun', vi: 'trần nhà' },
};

/**
 * Irregular Verbs Dictionary:
 * form -> Array of { lemma, formLabel, pos, explanationVi }
 */
export interface IrregularVerbFormEntry {
  lemma: string;
  formLabel: string;
  pos: string;
  explanationVi: string;
  isAmbiguous?: boolean;
}

const IRREGULAR_VERBS: Record<string, IrregularVerbFormEntry[]> = {
  did: [{ lemma: 'do', formLabel: 'Quá khứ đơn (V2)', pos: 'verb', explanationVi: 'Dạng quá khứ của "do" (đã làm)' }],
  done: [{ lemma: 'do', formLabel: 'Quá khứ phân từ (V3)', pos: 'verb', explanationVi: 'Dạng quá khứ phân từ của "do" (đã hoàn thành)' }],
  was: [{ lemma: 'be', formLabel: 'Quá khứ đơn số ít (V2)', pos: 'verb', explanationVi: 'Dạng quá khứ của động từ "be" (thì/là/ở)' }],
  were: [{ lemma: 'be', formLabel: 'Quá khứ đơn số nhiều (V2)', pos: 'verb', explanationVi: 'Dạng quá khứ số nhiều của "be"' }],
  been: [{ lemma: 'be', formLabel: 'Quá khứ phân từ (V3)', pos: 'verb', explanationVi: 'Dạng quá khứ phân từ của động từ "be"' }],
  am: [{ lemma: 'be', formLabel: 'Hiện tại đơn (V1 - ngôi thứ nhất)', pos: 'verb', explanationVi: 'Thì/là/ở (ngôi I)' }],
  is: [{ lemma: 'be', formLabel: 'Hiện tại đơn (V1 - ngôi thứ 3 số ít)', pos: 'verb', explanationVi: 'Thì/là/ở (ngôi he/she/it)' }],
  are: [{ lemma: 'be', formLabel: 'Hiện tại đơn (V1 - số nhiều)', pos: 'verb', explanationVi: 'Thì/là/ở (ngôi you/we/they)' }],
  had: [{ lemma: 'have', formLabel: 'Quá khứ / Quá khứ phân từ (V2/V3)', pos: 'verb', explanationVi: 'Dạng quá khứ của "have" (đã có)' }],
  has: [{ lemma: 'have', formLabel: 'Hiện tại đơn (ngôi thứ 3 số ít)', pos: 'verb', explanationVi: 'Dạng ngôi thứ 3 của "have" (có)' }],
  went: [{ lemma: 'go', formLabel: 'Quá khứ đơn (V2)', pos: 'verb', explanationVi: 'Dạng quá khứ của "go" (đi)' }],
  gone: [{ lemma: 'go', formLabel: 'Quá khứ phân từ (V3)', pos: 'verb', explanationVi: 'Dạng quá khứ phân từ của "go" (đã đi)' }],
  written: [{ lemma: 'write', formLabel: 'Quá khứ phân từ (V3)', pos: 'verb', explanationVi: 'Dạng quá khứ phân từ của "write" (được viết/đã viết)' }],
  wrote: [{ lemma: 'write', formLabel: 'Quá khứ đơn (V2)', pos: 'verb', explanationVi: 'Dạng quá khứ của "write" (đã viết)' }],
  ran: [{ lemma: 'run', formLabel: 'Quá khứ đơn (V2)', pos: 'verb', explanationVi: 'Dạng quá khứ của "run" (đã chạy/điều hành)' }],
  bought: [{ lemma: 'buy', formLabel: 'Quá khứ / Quá khứ phân từ (V2/V3)', pos: 'verb', explanationVi: 'Dạng quá khứ của "buy" (đã mua)' }],
  brought: [{ lemma: 'bring', formLabel: 'Quá khứ / Quá khứ phân từ (V2/V3)', pos: 'verb', explanationVi: 'Dạng quá khứ của "bring" (mang lại)' }],
  thought: [
    { lemma: 'think', formLabel: 'Quá khứ / Quá khứ phân từ (V2/V3)', pos: 'verb', explanationVi: 'Dạng quá khứ của "think" (đã nghĩ)' },
    { lemma: 'thought', formLabel: 'Danh từ nguyên mẫu', pos: 'noun', explanationVi: 'Suy nghĩ, ý nghĩ' },
  ],
  taught: [{ lemma: 'teach', formLabel: 'Quá khứ / Quá khứ phân từ (V2/V3)', pos: 'verb', explanationVi: 'Dạng quá khứ của "teach" (đã dạy)' }],
  caught: [{ lemma: 'catch', formLabel: 'Quá khứ / Quá khứ phân từ (V2/V3)', pos: 'verb', explanationVi: 'Dạng quá khứ của "catch" (đã bắt/kịp)' }],
  seen: [{ lemma: 'see', formLabel: 'Quá khứ phân từ (V3)', pos: 'verb', explanationVi: 'Dạng quá khứ phân từ của "see" (nhìn thấy)' }],
  saw: [
    { lemma: 'see', formLabel: 'Quá khứ đơn (V2)', pos: 'verb', explanationVi: 'Dạng quá khứ của "see" (đã nhìn thấy/hiểu)', isAmbiguous: true },
    { lemma: 'saw', formLabel: 'Từ nguyên mẫu', pos: 'noun', explanationVi: 'Cái cưa (noun) hoặc cưa gỗ (verb)', isAmbiguous: true },
  ],
  taken: [{ lemma: 'take', formLabel: 'Quá khứ phân từ (V3)', pos: 'verb', explanationVi: 'Dạng quá khứ phân từ của "take" (cầm/lấy)' }],
  took: [{ lemma: 'take', formLabel: 'Quá khứ đơn (V2)', pos: 'verb', explanationVi: 'Dạng quá khứ của "take" (đã cầm/lấy)' }],
  spoken: [{ lemma: 'speak', formLabel: 'Quá khứ phân từ (V3)', pos: 'verb', explanationVi: 'Dạng quá khứ phân từ của "speak" (nói)' }],
  spoke: [
    { lemma: 'speak', formLabel: 'Quá khứ đơn (V2)', pos: 'verb', explanationVi: 'Dạng quá khứ của "speak" (đã nói)' },
    { lemma: 'spoke', formLabel: 'Từ nguyên mẫu', pos: 'noun', explanationVi: 'Nan hoa bánh xe' },
  ],
  broken: [
    { lemma: 'break', formLabel: 'Quá khứ phân từ (V3)', pos: 'verb', explanationVi: 'Dạng quá khứ phân từ của "break"' },
    { lemma: 'broken', formLabel: 'Tính từ độc lập', pos: 'adjective', explanationVi: 'Bị vỡ, hỏng hóc' },
  ],
  broke: [{ lemma: 'break', formLabel: 'Quá khứ đơn (V2)', pos: 'verb', explanationVi: 'Dạng quá khứ của "break" (đã vỡ/hỏng)' }],
  chosen: [{ lemma: 'choose', formLabel: 'Quá khứ phân từ (V3)', pos: 'verb', explanationVi: 'Dạng quá khứ phân từ của "choose" (được chọn)' }],
  chose: [{ lemma: 'choose', formLabel: 'Quá khứ đơn (V2)', pos: 'verb', explanationVi: 'Dạng quá khứ của "choose" (đã chọn)' }],
  driven: [{ lemma: 'drive', formLabel: 'Quá khứ phân từ (V3)', pos: 'verb', explanationVi: 'Dạng quá khứ phân từ của "drive"' }],
  drove: [{ lemma: 'drive', formLabel: 'Quá khứ đơn (V2)', pos: 'verb', explanationVi: 'Dạng quá khứ của "drive" (đã lái xe)' }],
  eaten: [{ lemma: 'eat', formLabel: 'Quá khứ phân từ (V3)', pos: 'verb', explanationVi: 'Dạng quá khứ phân từ của "eat" (đã ăn)' }],
  ate: [{ lemma: 'eat', formLabel: 'Quá khứ đơn (V2)', pos: 'verb', explanationVi: 'Dạng quá khứ của "eat" (đã ăn)' }],
  fallen: [{ lemma: 'fall', formLabel: 'Quá khứ phân từ (V3)', pos: 'verb', explanationVi: 'Dạng quá khứ phân từ của "fall" (rơi xuống)' }],
  fell: [
    { lemma: 'fall', formLabel: 'Quá khứ đơn (V2)', pos: 'verb', explanationVi: 'Dạng quá khứ của "fall" (đã rơi)' },
    { lemma: 'fell', formLabel: 'Từ nguyên mẫu', pos: 'verb', explanationVi: 'Đốn hạ cây' },
  ],
  flown: [{ lemma: 'fly', formLabel: 'Quá khứ phân từ (V3)', pos: 'verb', explanationVi: 'Dạng quá khứ phân từ của "fly" (bay)' }],
  flew: [{ lemma: 'fly', formLabel: 'Quá khứ đơn (V2)', pos: 'verb', explanationVi: 'Dạng quá khứ của "fly" (đã bay)' }],
  forgotten: [{ lemma: 'forget', formLabel: 'Quá khứ phân từ (V3)', pos: 'verb', explanationVi: 'Dạng quá khứ phân từ của "forget" (đã quên)' }],
  forgot: [{ lemma: 'forget', formLabel: 'Quá khứ đơn (V2)', pos: 'verb', explanationVi: 'Dạng quá khứ của "forget" (đã quên)' }],
  forgiven: [{ lemma: 'forgive', formLabel: 'Quá khứ phân từ (V3)', pos: 'verb', explanationVi: 'Dạng quá khứ phân từ của "forgive" (tha thứ)' }],
  forgave: [{ lemma: 'forgive', formLabel: 'Quá khứ đơn (V2)', pos: 'verb', explanationVi: 'Dạng quá khứ của "forgive" (đã tha thứ)' }],
  frozen: [
    { lemma: 'freeze', formLabel: 'Quá khứ phân từ (V3)', pos: 'verb', explanationVi: 'Dạng quá khứ phân từ của "freeze"' },
    { lemma: 'frozen', formLabel: 'Tính từ độc lập', pos: 'adjective', explanationVi: 'Đông lạnh, đóng băng' },
  ],
  froze: [{ lemma: 'freeze', formLabel: 'Quá khứ đơn (V2)', pos: 'verb', explanationVi: 'Dạng quá khứ của "freeze" (đã đóng băng)' }],
  given: [{ lemma: 'give', formLabel: 'Quá khứ phân từ (V3)', pos: 'verb', explanationVi: 'Dạng quá khứ phân từ của "give" (cho/tặng)' }],
  gave: [{ lemma: 'give', formLabel: 'Quá khứ đơn (V2)', pos: 'verb', explanationVi: 'Dạng quá khứ của "give" (đã cho)' }],
  grown: [{ lemma: 'grow', formLabel: 'Quá khứ phân từ (V3)', pos: 'verb', explanationVi: 'Dạng quá khứ phân từ của "grow" (phát triển)' }],
  grew: [{ lemma: 'grow', formLabel: 'Quá khứ đơn (V2)', pos: 'verb', explanationVi: 'Dạng quá khứ của "grow" (đã lớn lên/tăng trưởng)' }],
  hidden: [
    { lemma: 'hide', formLabel: 'Quá khứ phân từ (V3)', pos: 'verb', explanationVi: 'Dạng quá khứ phân từ của "hide"' },
    { lemma: 'hidden', formLabel: 'Tính từ độc lập', pos: 'adjective', explanationVi: 'Bị ẩn giấu, tiềm ẩn' },
  ],
  hid: [{ lemma: 'hide', formLabel: 'Quá khứ đơn (V2)', pos: 'verb', explanationVi: 'Dạng quá khứ của "hide" (đã trốn/giấu)' }],
  known: [{ lemma: 'know', formLabel: 'Quá khứ phân từ (V3)', pos: 'verb', explanationVi: 'Dạng quá khứ phân từ của "know" (được biết)' }],
  knew: [{ lemma: 'know', formLabel: 'Quá khứ đơn (V2)', pos: 'verb', explanationVi: 'Dạng quá khứ của "know" (đã biết)' }],
  ridden: [{ lemma: 'ride', formLabel: 'Quá khứ phân từ (V3)', pos: 'verb', explanationVi: 'Dạng quá khứ phân từ của "ride" (cưỡi/đi xe)' }],
  rode: [{ lemma: 'ride', formLabel: 'Quá khứ đơn (V2)', pos: 'verb', explanationVi: 'Dạng quá khứ của "ride" (đã cưỡi/đi xe)' }],
  risen: [{ lemma: 'rise', formLabel: 'Quá khứ phân từ (V3)', pos: 'verb', explanationVi: 'Dạng quá khứ phân từ của "rise" (tăng lên)' }],
  rose: [
    { lemma: 'rise', formLabel: 'Quá khứ đơn (V2)', pos: 'verb', explanationVi: 'Dạng quá khứ của "rise" (đã tăng lên)' },
    { lemma: 'rose', formLabel: 'Từ nguyên mẫu', pos: 'noun', explanationVi: 'Hoa hồng' },
  ],
  shaken: [{ lemma: 'shake', formLabel: 'Quá khứ phân từ (V3)', pos: 'verb', explanationVi: 'Dạng quá khứ phân từ của "shake" (rung lắc)' }],
  shook: [{ lemma: 'shake', formLabel: 'Quá khứ đơn (V2)', pos: 'verb', explanationVi: 'Dạng quá khứ của "shake" (đã rung lắc)' }],
  stolen: [{ lemma: 'steal', formLabel: 'Quá khứ phân từ (V3)', pos: 'verb', explanationVi: 'Dạng quá khứ phân từ của "steal" (bị trộm)' }],
  stole: [{ lemma: 'steal', formLabel: 'Quá khứ đơn (V2)', pos: 'verb', explanationVi: 'Dạng quá khứ của "steal" (đã trộm)' }],
  thrown: [{ lemma: 'throw', formLabel: 'Quá khứ phân từ (V3)', pos: 'verb', explanationVi: 'Dạng quá khứ phân từ của "throw" (ném)' }],
  threw: [{ lemma: 'throw', formLabel: 'Quá khứ đơn (V2)', pos: 'verb', explanationVi: 'Dạng quá khứ của "throw" (đã ném)' }],
  woken: [{ lemma: 'wake', formLabel: 'Quá khứ phân từ (V3)', pos: 'verb', explanationVi: 'Dạng quá khứ phân từ của "wake" (thức dậy)' }],
  woke: [
    { lemma: 'wake', formLabel: 'Quá khứ đơn (V2)', pos: 'verb', explanationVi: 'Dạng quá khứ của "wake" (đã thức giấc)' },
    { lemma: 'woke', formLabel: 'Từ nguyên mẫu', pos: 'adjective', explanationVi: 'Tỉnh táo xã hội' },
  ],
  worn: [
    { lemma: 'wear', formLabel: 'Quá khứ phân từ (V3)', pos: 'verb', explanationVi: 'Dạng quá khứ phân từ của "wear" (mặc/đeo)' },
    { lemma: 'worn', formLabel: 'Tính từ độc lập', pos: 'adjective', explanationVi: 'Mòn, sờn rách' },
  ],
  wore: [{ lemma: 'wear', formLabel: 'Quá khứ đơn (V2)', pos: 'verb', explanationVi: 'Dạng quá khứ của "wear" (đã mặc)' }],
  built: [{ lemma: 'build', formLabel: 'Quá khứ / Quá khứ phân từ (V2/V3)', pos: 'verb', explanationVi: 'Dạng quá khứ của "build" (xây dựng)' }],
  lent: [{ lemma: 'lend', formLabel: 'Quá khứ / Quá khứ phân từ (V2/V3)', pos: 'verb', explanationVi: 'Dạng quá khứ của "lend" (cho mượn)' }],
  sent: [{ lemma: 'send', formLabel: 'Quá khứ / Quá khứ phân từ (V2/V3)', pos: 'verb', explanationVi: 'Dạng quá khứ của "send" (gửi đi)' }],
  spent: [{ lemma: 'spend', formLabel: 'Quá khứ / Quá khứ phân từ (V2/V3)', pos: 'verb', explanationVi: 'Dạng quá khứ của "spend" (chi tiêu/dành ra)' }],
  dealt: [{ lemma: 'deal', formLabel: 'Quá khứ / Quá khứ phân từ (V2/V3)', pos: 'verb', explanationVi: 'Dạng quá khứ của "deal" (giải quyết/giao dịch)' }],
  felt: [{ lemma: 'feel', formLabel: 'Quá khứ / Quá khứ phân từ (V2/V3)', pos: 'verb', explanationVi: 'Dạng quá khứ của "feel" (cảm thấy)' }],
  kept: [{ lemma: 'keep', formLabel: 'Quá khứ / Quá khứ phân từ (V2/V3)', pos: 'verb', explanationVi: 'Dạng quá khứ của "keep" (giữ gìn/duy trì)' }],
  left: [
    { lemma: 'leave', formLabel: 'Quá khứ / Quá khứ phân từ (V2/V3)', pos: 'verb', explanationVi: 'Dạng quá khứ của "leave" (rời đi/để lại)' },
    { lemma: 'left', formLabel: 'Từ nguyên mẫu', pos: 'adjective', explanationVi: 'Bên trái' },
  ],
  slept: [{ lemma: 'sleep', formLabel: 'Quá khứ / Quá khứ phân từ (V2/V3)', pos: 'verb', explanationVi: 'Dạng quá khứ của "sleep" (ngủ)' }],
  met: [{ lemma: 'meet', formLabel: 'Quá khứ / Quá khứ phân từ (V2/V3)', pos: 'verb', explanationVi: 'Dạng quá khứ của "meet" (đã gặp gỡ)' }],
  lost: [
    { lemma: 'lose', formLabel: 'Quá khứ / Quá khứ phân từ (V2/V3)', pos: 'verb', explanationVi: 'Dạng quá khứ của "lose" (đã mất/thua)' },
    { lemma: 'lost', formLabel: 'Tính từ độc lập', pos: 'adjective', explanationVi: 'Bị lạc, thất lạc' },
  ],
  won: [{ lemma: 'win', formLabel: 'Quá khứ / Quá khứ phân từ (V2/V3)', pos: 'verb', explanationVi: 'Dạng quá khứ của "win" (đã chiến thắng)' }],
  understood: [{ lemma: 'understand', formLabel: 'Quá khứ / Quá khứ phân từ (V2/V3)', pos: 'verb', explanationVi: 'Dạng quá khứ của "understand" (đã hiểu)' }],
  stood: [{ lemma: 'stand', formLabel: 'Quá khứ / Quá khứ phân từ (V2/V3)', pos: 'verb', explanationVi: 'Dạng quá khứ của "stand" (đã đứng)' }],
  held: [{ lemma: 'hold', formLabel: 'Quá khứ / Quá khứ phân từ (V2/V3)', pos: 'verb', explanationVi: 'Dạng quá khứ của "hold" (cầm nắm/tổ chức)' }],
  found: [
    { lemma: 'find', formLabel: 'Quá khứ / Quá khứ phân từ (V2/V3)', pos: 'verb', explanationVi: 'Dạng quá khứ của "find" (tìm thấy)' },
    { lemma: 'found', formLabel: 'Từ nguyên mẫu', pos: 'verb', explanationVi: 'Thành lập, sáng lập (tổ chức, công ty)' },
  ],
  led: [{ lemma: 'lead', formLabel: 'Quá khứ / Quá khứ phân từ (V2/V3)', pos: 'verb', explanationVi: 'Dạng quá khứ của "lead" (dẫn dắt/lãnh đạo)' }],
  read: [
    { lemma: 'read', formLabel: 'Nguyên mẫu hoặc Quá khứ (V1/V2/V3)', pos: 'verb', explanationVi: 'Đọc sách / đã đọc (phát âm /red/ ở quá khứ)' },
  ],
  paid: [{ lemma: 'pay', formLabel: 'Quá khứ / Quá khứ phân từ (V2/V3)', pos: 'verb', explanationVi: 'Dạng quá khứ của "pay" (thanh toán/chi trả)' }],
  laid: [{ lemma: 'lay', formLabel: 'Quá khứ / Quá khứ phân từ (V2/V3)', pos: 'verb', explanationVi: 'Dạng quá khứ của "lay" (đặt/để)' }],
  said: [{ lemma: 'say', formLabel: 'Quá khứ / Quá khứ phân từ (V2/V3)', pos: 'verb', explanationVi: 'Dạng quá khứ của "say" (đã nói)' }],
  sold: [{ lemma: 'sell', formLabel: 'Quá khứ / Quá khứ phân từ (V2/V3)', pos: 'verb', explanationVi: 'Dạng quá khứ của "sell" (đã bán)' }],
  told: [{ lemma: 'tell', formLabel: 'Quá khứ / Quá khứ phân từ (V2/V3)', pos: 'verb', explanationVi: 'Dạng quá khứ của "tell" (đã kể/bảo)' }],
  heard: [{ lemma: 'hear', formLabel: 'Quá khứ / Quá khứ phân từ (V2/V3)', pos: 'verb', explanationVi: 'Dạng quá khứ của "hear" (đã nghe thấy)' }],
  meant: [{ lemma: 'mean', formLabel: 'Quá khứ / Quá khứ phân từ (V2/V3)', pos: 'verb', explanationVi: 'Dạng quá khứ của "mean" (có ý định/có nghĩa là)' }],
  made: [{ lemma: 'make', formLabel: 'Quá khứ / Quá khứ phân từ (V2/V3)', pos: 'verb', explanationVi: 'Dạng quá khứ của "make" (đã làm/tạo ra)' }],
  became: [{ lemma: 'become', formLabel: 'Quá khứ đơn (V2)', pos: 'verb', explanationVi: 'Dạng quá khứ của "become" (trở thành)' }],
  began: [{ lemma: 'begin', formLabel: 'Quá khứ đơn (V2)', pos: 'verb', explanationVi: 'Dạng quá khứ của "begin" (bắt đầu)' }],
  begun: [{ lemma: 'begin', formLabel: 'Quá khứ phân từ (V3)', pos: 'verb', explanationVi: 'Dạng quá khứ phân từ của "begin"' }],
  swam: [{ lemma: 'swim', formLabel: 'Quá khứ đơn (V2)', pos: 'verb', explanationVi: 'Dạng quá khứ của "swim" (bơi)' }],
  swum: [{ lemma: 'swim', formLabel: 'Quá khứ phân từ (V3)', pos: 'verb', explanationVi: 'Dạng quá khứ phân từ của "swim"' }],
  sang: [{ lemma: 'sing', formLabel: 'Quá khứ đơn (V2)', pos: 'verb', explanationVi: 'Dạng quá khứ của "sing" (hát)' }],
  sung: [{ lemma: 'sing', formLabel: 'Quá khứ phân từ (V3)', pos: 'verb', explanationVi: 'Dạng quá khứ phân từ của "sing"' }],
  rang: [{ lemma: 'ring', formLabel: 'Quá khứ đơn (V2)', pos: 'verb', explanationVi: 'Dạng quá khứ của "ring" (rung chuông)' }],
  rung: [{ lemma: 'ring', formLabel: 'Quá khứ phân từ (V3)', pos: 'verb', explanationVi: 'Dạng quá khứ phân từ của "ring"' }],
  sank: [{ lemma: 'sink', formLabel: 'Quá khứ đơn (V2)', pos: 'verb', explanationVi: 'Dạng quá khứ của "sink" (chìm)' }],
  sunk: [{ lemma: 'sink', formLabel: 'Quá khứ phân từ (V3)', pos: 'verb', explanationVi: 'Dạng quá khứ phân từ của "sink"' }],
  drank: [{ lemma: 'drink', formLabel: 'Quá khứ đơn (V2)', pos: 'verb', explanationVi: 'Dạng quá khứ của "drink" (uống)' }],
  drunk: [
    { lemma: 'drink', formLabel: 'Quá khứ phân từ (V3)', pos: 'verb', explanationVi: 'Dạng quá khứ phân từ của "drink"' },
    { lemma: 'drunk', formLabel: 'Tính từ độc lập', pos: 'adjective', explanationVi: 'Say xỉn' },
  ],
  shone: [{ lemma: 'shine', formLabel: 'Quá khứ / Quá khứ phân từ (V2/V3)', pos: 'verb', explanationVi: 'Dạng quá khứ của "shine" (tỏa sáng)' }],
  struck: [{ lemma: 'strike', formLabel: 'Quá khứ / Quá khứ phân từ (V2/V3)', pos: 'verb', explanationVi: 'Dạng quá khứ của "strike" (đình công/đánh)' }],
  hung: [{ lemma: 'hang', formLabel: 'Quá khứ / Quá khứ phân từ (V2/V3)', pos: 'verb', explanationVi: 'Dạng quá khứ của "hang" (treo lên)' }],
};

/**
 * Irregular Plurals Dictionary:
 * form -> Array of { lemma, formLabel, pos, explanationVi }
 */
const IRREGULAR_PLURALS: Record<string, { lemma: string; pos: string; explanationVi: string }> = {
  children: { lemma: 'child', pos: 'noun', explanationVi: 'Dạng số nhiều của "child" (trẻ em)' },
  criteria: { lemma: 'criterion', pos: 'noun', explanationVi: 'Dạng số nhiều của "criterion" (tiêu chí)' },
  phenomena: { lemma: 'phenomenon', pos: 'noun', explanationVi: 'Dạng số nhiều của "phenomenon" (hiện tượng)' },
  analyses: { lemma: 'analysis', pos: 'noun', explanationVi: 'Dạng số nhiều của "analysis" (các bài phân tích)' },
  crises: { lemma: 'crisis', pos: 'noun', explanationVi: 'Dạng số nhiều của "crisis" (các cuộc khủng hoảng)' },
  hypotheses: { lemma: 'hypothesis', pos: 'noun', explanationVi: 'Dạng số nhiều của "hypothesis" (các giả thuyết)' },
  theses: { lemma: 'thesis', pos: 'noun', explanationVi: 'Dạng số nhiều của "thesis" (các luận văn)' },
  diagnoses: { lemma: 'diagnosis', pos: 'noun', explanationVi: 'Dạng số nhiều của "diagnosis" (các chẩn đoán)' },
  bases: { lemma: 'basis', pos: 'noun', explanationVi: 'Số nhiều của "basis" (nền tảng) hoặc "base"' },
  indices: { lemma: 'index', pos: 'noun', explanationVi: 'Dạng số nhiều của "index" (các chỉ số)' },
  matrices: { lemma: 'matrix', pos: 'noun', explanationVi: 'Dạng số nhiều của "matrix" (ma trận)' },
  appendices: { lemma: 'appendix', pos: 'noun', explanationVi: 'Dạng số nhiều của "appendix" (phụ lục)' },
  vertebrae: { lemma: 'vertebra', pos: 'noun', explanationVi: 'Dạng số nhiều của "vertebra" (đốt sống)' },
  alumni: { lemma: 'alumnus', pos: 'noun', explanationVi: 'Dạng số nhiều của "alumnus" (cựu sinh viên)' },
  stimuli: { lemma: 'stimulus', pos: 'noun', explanationVi: 'Dạng số nhiều của "stimulus" (tác nhân kích thích)' },
  fungi: { lemma: 'fungus', pos: 'noun', explanationVi: 'Dạng số nhiều của "fungus" (nấm)' },
  cacti: { lemma: 'cactus', pos: 'noun', explanationVi: 'Dạng số nhiều của "cactus" (cây xương rồng)' },
  media: { lemma: 'medium', pos: 'noun', explanationVi: 'Dạng số nhiều của "medium" (phương tiện truyền thông)' },
  data: { lemma: 'datum', pos: 'noun', explanationVi: 'Số nhiều/tập hợp của "datum" (dữ liệu)' },
  curricula: { lemma: 'curriculum', pos: 'noun', explanationVi: 'Dạng số nhiều của "curriculum" (chương trình học)' },
  bacteria: { lemma: 'bacterium', pos: 'noun', explanationVi: 'Dạng số nhiều của "bacterium" (vi khuẩn)' },
  mice: { lemma: 'mouse', pos: 'noun', explanationVi: 'Dạng số nhiều của "mouse" (chuột)' },
  teeth: { lemma: 'tooth', pos: 'noun', explanationVi: 'Dạng số nhiều của "tooth" (răng)' },
  feet: { lemma: 'foot', pos: 'noun', explanationVi: 'Dạng số nhiều của "foot" (bàn chân / bộ)' },
  men: { lemma: 'man', pos: 'noun', explanationVi: 'Dạng số nhiều của "man" (đàn ông)' },
  women: { lemma: 'woman', pos: 'noun', explanationVi: 'Dạng số nhiều của "woman" (phụ nữ)' },
  people: { lemma: 'person', pos: 'noun', explanationVi: 'Dạng số nhiều của "person" (người)' },
  geese: { lemma: 'goose', pos: 'noun', explanationVi: 'Dạng số nhiều của "goose" (ngỗng)' },
  oxen: { lemma: 'ox', pos: 'noun', explanationVi: 'Dạng số nhiều của "ox" (bò đực)' },
};

/**
 * Irregular Comparatives / Superlatives
 */
const IRREGULAR_DEGREES: Record<string, LemmaCandidate[]> = {
  better: [
    {
      lemma: 'better',
      pos: 'verb/noun',
      formLabel: 'Từ nguyên mẫu độc lập',
      explanationVi: 'Động từ "cải thiện bản thân" hoặc danh từ "người giỏi hơn"',
      isAmbiguous: true,
    },
    {
      lemma: 'good',
      pos: 'adjective',
      formLabel: 'Dạng so sánh hơn',
      explanationVi: 'So sánh hơn của tính từ "good" (tốt hơn)',
      isAmbiguous: true,
    },
    {
      lemma: 'well',
      pos: 'adverb',
      formLabel: 'Dạng so sánh hơn',
      explanationVi: 'So sánh hơn của trạng từ "well" (tốt hơn, khỏe hơn)',
      isAmbiguous: true,
    },
  ],
  best: [
    {
      lemma: 'best',
      pos: 'adjective/noun',
      formLabel: 'Từ nguyên mẫu độc lập',
      explanationVi: 'Điều tốt nhất, nỗ lực cao nhất',
      isAmbiguous: true,
    },
    {
      lemma: 'good',
      pos: 'adjective',
      formLabel: 'Dạng so sánh nhất',
      explanationVi: 'So sánh nhất của tính từ "good" (tốt nhất)',
      isAmbiguous: true,
    },
    {
      lemma: 'well',
      pos: 'adverb',
      formLabel: 'Dạng so sánh nhất',
      explanationVi: 'So sánh nhất của trạng từ "well" (giỏi nhất, hiệu quả nhất)',
      isAmbiguous: true,
    },
  ],
  worse: [
    {
      lemma: 'bad',
      pos: 'adjective',
      formLabel: 'Dạng so sánh hơn',
      explanationVi: 'So sánh hơn của tính từ "bad" (tệ hơn)',
      isAmbiguous: true,
    },
    {
      lemma: 'worse',
      pos: 'adverb/noun',
      formLabel: 'Từ nguyên mẫu',
      explanationVi: 'Tồi tệ hơn',
      isAmbiguous: true,
    },
  ],
  worst: [
    {
      lemma: 'bad',
      pos: 'adjective',
      formLabel: 'Dạng so sánh nhất',
      explanationVi: 'So sánh nhất của tính từ "bad" (tệ nhất)',
      isAmbiguous: true,
    },
    {
      lemma: 'worst',
      pos: 'noun',
      formLabel: 'Từ nguyên mẫu',
      explanationVi: 'Điều tồi tệ nhất',
      isAmbiguous: true,
    },
  ],
};

/**
 * Contextual disambiguation helper using a context sentence
 */
function disambiguateWithContext(
  word: string,
  candidates: LemmaCandidate[],
  contextSentence?: string
): { selectedLemma: string; filteredCandidates: LemmaCandidate[]; reason?: string } {
  if (!contextSentence || !contextSentence.trim()) {
    return {
      selectedLemma: candidates[0]?.lemma || word,
      filteredCandidates: candidates,
    };
  }

  const sLower = contextSentence.toLowerCase();
  const wLower = word.toLowerCase();

  // 1. Check for "saw": "saw a/the movie/car/accident" -> see (verb); "cut ... saw / with a saw" -> saw (noun)
  if (wLower === 'saw') {
    if (/(cut|wood|sharp|tool|blade|carpenter|teeth of|chain)/.test(sLower) ||
        /\b(a|the|sharp|electric|hand)\s+saw\b/.test(sLower) ||
        /\bwith\s+a\s+(sharp\s+)?saw\b/.test(sLower)) {
      return {
        selectedLemma: 'saw',
        filteredCandidates: candidates.filter((c) => c.lemma === 'saw'),
        reason: 'Ngữ cảnh chỉ dụng cụ cắt/cưa gỗ',
      };
    }
    if (/\b(i|he|she|they|we|you|who)\s+saw\b/.test(sLower) || /(yesterday|movie|film|accident|doctor|him|her|them)/.test(sLower)) {
      return {
        selectedLemma: 'see',
        filteredCandidates: candidates.filter((c) => c.lemma === 'see'),
        reason: 'Ngữ cảnh chỉ hành động nhìn thấy/xem trong quá khứ',
      };
    }
  }

  // 2. Check for "studies": "studies English" -> study (verb); "clinical studies / recent studies" -> study (noun)
  if (wLower === 'studies') {
    if (/\b(he|she|it|student|who)\s+studies\b/.test(sLower) || /\bstudies\s+(english|math|hard|abroad|at|in|for|late)\b/.test(sLower)) {
      return {
        selectedLemma: 'study',
        filteredCandidates: [{
          lemma: 'study',
          pos: 'verb',
          formLabel: 'Ngôi thứ 3 số ít hiện tại đơn',
          explanationVi: 'Hành động học tập/nghiên cứu',
        }],
        reason: 'Ngữ cảnh chủ ngữ số ít thực hiện hành động học',
      };
    }
    if (/\b(recent|clinical|case|scientific|these|those|many|several|our|new)\s+studies\b/.test(sLower) ||
        /\bstudies\s+(show|indicate|suggest|found|reveal|were|are)\b/.test(sLower)) {
      return {
        selectedLemma: 'study',
        filteredCandidates: [{
          lemma: 'study',
          pos: 'noun',
          formLabel: 'Danh từ số nhiều',
          explanationVi: 'Các công trình nghiên cứu / phòng học',
        }],
        reason: 'Ngữ cảnh danh từ số nhiều làm chủ ngữ hoặc bổ ngữ',
      };
    }
  }

  // 3. Check for "meeting": "at the meeting" -> meeting (noun); "meeting with clients" -> meet (verb) / meeting (noun)
  if (wLower === 'meeting') {
    if (/\b(a|the|this|annual|team|board|staff|emergency|schedule|cancel|attend|hold|urgent|budget)\s+(budget\s+|urgent\s+)?meeting\b/.test(sLower) ||
        /\bmeeting\s+(was|is|starts|ends|took place|this morning)\b/.test(sLower) ||
        /\b(at|in)\s+the\s+meeting\b/.test(sLower)) {
      return {
        selectedLemma: 'meeting',
        filteredCandidates: [{
          lemma: 'meeting',
          pos: 'noun',
          formLabel: 'Danh từ độc lập',
          explanationVi: 'Cuộc họp, phiên họp',
        }],
        reason: 'Ngữ cảnh danh từ chỉ sự kiện cuộc họp',
      };
    }
    if (/\b(am|is|are|was|were|been)\s+meeting\b/.test(sLower)) {
      return {
        selectedLemma: 'meet',
        filteredCandidates: [{
          lemma: 'meet',
          pos: 'verb',
          formLabel: 'Dạng tiếp diễn (V-ing)',
          explanationVi: 'Đang gặp gỡ ai đó',
        }],
        reason: 'Ngữ cảnh thì tiếp diễn của động từ meet',
      };
    }
  }

  // 4. Check for "better": "get better", "feel better", "better than" -> good/well; "better your skills" -> better (verb)
  if (wLower === 'better') {
    if (/\b(to|will|can|should|help)\s+better\b/.test(sLower) || /\bbetter\s+(oneself|your|his|her|skills|condition)\b/.test(sLower)) {
      return {
        selectedLemma: 'better',
        filteredCandidates: [{
          lemma: 'better',
          pos: 'verb',
          formLabel: 'Động từ nguyên mẫu',
          explanationVi: 'Cải thiện, làm cho tốt hơn',
        }],
        reason: 'Ngữ cảnh động từ chỉ hành động cải thiện',
      };
    }
    if (/\b(feel|feels|feeling|felt)\s+better\b/.test(sLower) || /\b(getting|become|became)\s+better\b/.test(sLower)) {
      return {
        selectedLemma: 'well',
        filteredCandidates: [
          {
            lemma: 'well',
            pos: 'adverb/adjective',
            formLabel: 'Dạng so sánh hơn',
            explanationVi: 'Khỏe hơn, hồi phục tốt hơn (từ "well")',
          },
          {
            lemma: 'good',
            pos: 'adjective',
            formLabel: 'Dạng so sánh hơn',
            explanationVi: 'Tốt hơn, cảm thấy ổn hơn (từ "good")',
          },
        ],
        reason: 'Ngữ cảnh cảm giác / sức khỏe hồi phục',
      };
    }
    if (/\b(much|far|even|looks|is|are|was|were)\s+better\b/.test(sLower) || /\bbetter\s+(than|results?|quality|option|choice|offer)\b/.test(sLower)) {
      return {
        selectedLemma: 'good',
        filteredCandidates: [{
          lemma: 'good',
          pos: 'adjective',
          formLabel: 'Dạng so sánh hơn',
          explanationVi: 'Tốt hơn, ưu việt hơn (từ "good")',
        }],
        reason: 'Ngữ cảnh so sánh tính từ (tốt hơn)',
      };
    }
  }

  // 4b. Check for "best": "best results" -> good; "do your best" -> best (noun); "works best" -> well (adverb)
  if (wLower === 'best') {
    if (/\b(do|does|did|done|try|tried|trying|his|her|my|your|our|their)\s+best\b/.test(sLower)) {
      return {
        selectedLemma: 'best',
        filteredCandidates: [{
          lemma: 'best',
          pos: 'noun',
          formLabel: 'Từ nguyên mẫu (danh từ)',
          explanationVi: 'Nỗ lực cao nhất, điều tốt nhất',
        }],
        reason: 'Ngữ cảnh nỗ lực hết mình (do one\'s best)',
      };
    }
    if (/\b(works|performed|suited|fits?)\s+best\b/.test(sLower)) {
      return {
        selectedLemma: 'well',
        filteredCandidates: [{
          lemma: 'well',
          pos: 'adverb',
          formLabel: 'Dạng so sánh nhất (trạng từ)',
          explanationVi: 'Hiệu quả nhất, giỏi nhất (từ "well")',
        }],
        reason: 'Ngữ cảnh trạng từ chỉ cách thức tốt nhất',
      };
    }
    if (/\b(the\s+)?best\s+(results?|way|option|choice|quality|student|practice)\b/.test(sLower) || /\b(is|are|was|were)\s+(the\s+)?best\b/.test(sLower)) {
      return {
        selectedLemma: 'good',
        filteredCandidates: [{
          lemma: 'good',
          pos: 'adjective',
          formLabel: 'Dạng so sánh nhất (tính từ)',
          explanationVi: 'Tốt nhất, xuất sắc nhất (từ "good")',
        }],
        reason: 'Ngữ cảnh tính từ so sánh nhất',
      };
    }
  }

  // 5. Check for "working": "she is working" -> work (verb); "working hours / working conditions" -> working (adj)
  if (wLower === 'working') {
    if (/\b(am|is|are|was|were|been|started|keeps)\s+working\b/.test(sLower) ||
        /\bworking\s+(on|at|for|with|hard|late|remotely)\b/.test(sLower)) {
      return {
        selectedLemma: 'work',
        filteredCandidates: [{
          lemma: 'work',
          pos: 'verb',
          formLabel: 'Dạng -ing (Hiện tại phân từ)',
          explanationVi: 'Hành động đang làm việc / hoạt động',
        }],
        reason: 'Ngữ cảnh động từ hành động đang làm việc',
      };
    }
    if (/\bworking\s+(hours|days|conditions|environment|capital|class|group|title|draft|permit)\b/.test(sLower) ||
        /\b(flexible|long|good|bad)\s+working\b/.test(sLower)) {
      return {
        selectedLemma: 'working',
        filteredCandidates: [{
          lemma: 'working',
          pos: 'adjective',
          formLabel: 'Tính từ ghép / định ngữ',
          explanationVi: 'Thuộc về công việc (giờ làm việc, điều kiện làm việc)',
        }],
        reason: 'Ngữ cảnh tính từ bổ nghĩa cho danh từ',
      };
    }
  }

  return {
    selectedLemma: candidates[0]?.lemma || word,
    filteredCandidates: candidates,
  };
}

/**
 * Parses phrasal verbs into [verbPart, particlePart]
 * E.g. "looked up" -> ["looked", "up"]
 * "ran out of" -> ["ran", "out of"]
 */
function parsePhrasalVerb(phrase: string): { verbPart: string; particlePart: string } | null {
  const parts = phrase.trim().toLowerCase().split(/\s+/);
  if (parts.length < 2) return null;

  const first = parts[0];
  const rest = parts.slice(1).join(' ');

  // Check if rest starts with a particle
  if (PHRASAL_PARTICLES.has(parts[1])) {
    return {
      verbPart: first,
      particlePart: rest,
    };
  }

  return null;
}

/**
 * Comprehensive English verbs ending in silent -e that drop -e before -ing and -ed
 */
export const KNOWN_SILENT_E_VERBS = new Set([
  'postpone', 'make', 'take', 'use', 'write', 'drive', 'hope', 'come', 'give', 'live',
  'move', 'ride', 'change', 'create', 'decide', 'provide', 'include', 'reduce', 'produce',
  'introduce', 'require', 'acquire', 'inquire', 'manage', 'improve', 'schedule', 'promote',
  'continue', 'receive', 'believe', 'achieve', 'agree', 'base', 'like', 'love', 'save',
  'wave', 'share', 'care', 'stare', 'note', 'vote', 'quote', 'prepare', 'compare',
  'declare', 'ensure', 'insure', 'assure', 'secure', 'organize', 'realize', 'recognize',
  'analyze', 'notice', 'practice', 'experience', 'influence', 'increase', 'decrease',
  'release', 'please', 'involve', 'evolve', 'resolve', 'solve', 'survive', 'arrive',
  'remove', 'approve', 'arrange', 'charge', 'damage', 'challenge', 'encourage', 'indicate',
  'operate', 'estimate', 'communicate', 'translate', 'collaborate', 'participate',
  'generate', 'celebrate', 'activate', 'motivate', 'navigate', 'allocate', 'dedicate',
  'evaluate', 'fluctuate', 'illustrate', 'migrate', 'terminate', 'dominate', 'execute',
  'distribute', 'contribute', 'substitute', 'institute', 'constitute', 'pollute',
  'compose', 'propose', 'expose', 'dispose', 'oppose', 'suppose', 'impose',
  'waste', 'taste', 'paste', 'chase', 'raise', 'praise', 'browse', 'arise', 'choose',
  'close', 'lose', 'cause', 'pause', 'refuse', 'excuse', 'amuse', 'abuse',
  'advise', 'revise', 'devise', 'surprise', 'enterprise', 'compromise', 'promise',
  'advertise', 'exercise', 'supervise', 'guarantee', 'disagree', 'see', 'flee', 'free',
  'breathe', 'bathe', 'clothe', 'soothe', 'scale', 'rule', 'file', 'smile', 'pile',
  'compile', 'profile', 'reconcile', 'bake', 'shake', 'wake', 'choke', 'smoke',
  'strike', 'type', 'wipe', 'cope', 'slope', 'shape', 'escape', 'scrape',
  'date', 'state', 'update', 'upgrade', 'trade', 'fade', 'shade', 'guide', 'hide',
  'slide', 'glide', 'collide', 'divide', 'reside', 'preside', 'abide', 'confide',
  'negotiate', 'appreciate', 'differentiate', 'initiate', 'hesitate',
  'facilitate', 'accommodate', 'consolidate', 'anticipate', 'compensate',
  'concentrate', 'demonstrate', 'frustrate', 'penetrate',
  'elaborate', 'incorporate', 'tolerate', 'accelerate', 'reiterate',
]);

/**
 * English base verbs that do NOT end in silent -e and must NEVER have -e artificially appended
 * (e.g. work -> working [NEVER worke], read -> reading [NEVER reade], meet -> meeting [NEVER meete])
 */
export const KNOWN_NON_E_VERBS = new Set([
  'work', 'read', 'meet', 'sleep', 'wait', 'speak', 'look', 'cool', 'hear', 'feel',
  'train', 'rain', 'point', 'float', 'help', 'jump', 'ask', 'send', 'hold', 'start',
  'park', 'hunt', 'talk', 'walk', 'wish', 'watch', 'teach', 'laugh', 'mark', 'thank',
  'drink', 'sing', 'bring', 'ring', 'build', 'stand', 'end', 'spend', 'bend', 'lend',
  'open', 'listen', 'happen', 'threaten', 'fasten', 'soften', 'weaken', 'strengthen',
  'shorten', 'worsen', 'quicken', 'thicken', 'visit', 'limit', 'benefit', 'develop',
  'edit', 'credit', 'exhibit', 'prohibit', 'inhibit', 'deposit', 'gather', 'order',
  'deliver', 'remember', 'consider', 'discover', 'recover', 'wonder', 'enter', 'center',
  'suffer', 'offer', 'differ', 'answer', 'focus', 'alter', 'bother', 'shiver', 'whisper',
  'shatter', 'scatter', 'matter', 'flutter', 'master', 'foster', 'bolster', 'shelter',
  'filter', 'water', 'murder', 'border', 'harbor', 'labor', 'favor', 'honor',
]);

/**
 * Resolves the canonical dictionary lemma of an -ing verb using English phonotactic morphology
 */
export function resolveBaseVerbFromIng(normalized: string): string {
  if (!normalized.endsWith('ing') || normalized.length <= 4) return normalized;

  // 1. Primary nouns mapping to base verbs
  if (normalized === 'meeting') return 'meet';
  if (normalized === 'writing') return 'write';
  if (normalized === 'building') return 'build';
  if (normalized === 'training') return 'train';
  if (normalized === 'feeling') return 'feel';
  if (normalized === 'meaning') return 'mean';
  if (normalized === 'beginning') return 'begin';

  // 2. -ying -> -ie (dying -> die, lying -> lie, tying -> tie, vying -> vie)
  if (normalized.endsWith('ying')) {
    const yStem = normalized.slice(0, -4);
    if (['d', 'l', 't', 'v'].includes(yStem)) {
      return `${yStem}ie`;
    }
  }

  const stem = normalized.slice(0, -3);

  // 3. Double consonant doubling: running -> run, swimming -> swim, planning -> plan, stopping -> stop
  // Preserve single consonant if doubled (never strip 'ss' e.g. cross, pass, dress)
  if (/(.)\1$/.test(stem) && !/ss$/.test(stem)) {
    return stem.slice(0, -1);
  }

  // 4. Known silent-e verbs (e.g. postponing -> postpone, making -> make, using -> use)
  const withE = `${stem}e`;
  if (KNOWN_SILENT_E_VERBS.has(withE) || stem === 'postpon') {
    return withE;
  }

  // 5. Known non-e verbs (e.g. working -> work, reading -> read, meeting -> meet)
  if (KNOWN_NON_E_VERBS.has(stem)) {
    return stem;
  }

  // 6. Phonotactic rules:
  // 6a. Vowel digraph + single consonant (e.g. read, meet, sleep, speak, look, cool, hear, feel, train, rain)
  // NEVER append 'e' to vowel digraphs!
  if (/[aeiou]{2}[bcdfghjklmnpqrstvwxyz]$/.test(stem)) {
    return stem;
  }

  // 6b. Standard consonant clusters ending in non-silent-e consonants:
  // e.g. rk (work), lp (help), mp (jump), sk (ask), nd (send), ld (hold), rt (start), nt (plant),
  // lk (talk/walk), sh (wish), tch (watch), ch (teach), gh (laugh), nk (thank)
  if (/(rk|lp|mp|sk|nd|ld|rt|nt|lk|sh|tch|ch|gh|nk|ct|pt|ft)$/.test(stem)) {
    return stem;
  }

  // 6c. Suffixes that phonotactically REQUIRE silent 'e':
  // - Soft c: -ce (e.g. producing -> produce, noticing -> notice, practicing -> practice, dancing -> dance)
  // - Soft g: -ge (e.g. managing -> manage, changing -> change, judging -> judge, charging -> charge)
  // - v: English words never end in v (improving -> improve, moving -> move, living -> live, giving -> give, driving -> drive)
  // - z: -ze (organizing -> organize, realizing -> realize)
  // - ate, ute, ude, use, ire, ore, ure, ive, ave, ove, ise, oze
  if (
    stem.endsWith('c') ||
    stem.endsWith('g') ||
    stem.endsWith('v') ||
    stem.endsWith('z') ||
    stem.endsWith('us') ||
    stem.endsWith('postpon') ||
    /(at|ut|ud|ir|or|ur|iv|av|ov|is|oz|ul|os|clos|pos|clud|sid|vid|cid)$/.test(stem)
  ) {
    return `${stem}e`;
  }

  // 6d. Suspicious truncated stems protection (never output worke, reade, meete, postpon)
  if (stem === 'postpon') return 'postpone';
  if (stem === 'worke') return 'work';
  if (stem === 'reade') return 'read';
  if (stem === 'meete') return 'meet';

  // 7. Open single syllable / multi-syllable V-C verbs take e (e.g. write, take, make, hope, vote)
  if (!/[aeiou]/.test(stem.slice(-1)) && /[aeiou]/.test(stem.slice(-2, -1))) {
    return `${stem}e`;
  }

  return stem;
}

/**
 * Resolves the canonical dictionary lemma of an -ed verb using English phonotactic morphology
 */
export function resolveBaseVerbFromEd(normalized: string): string {
  if (!normalized.endsWith('ed') || normalized.length <= 3) return normalized;

  // 1. -ied -> -y (studied -> study, tried -> try, carried -> carry, copied -> copy)
  if (normalized.endsWith('ied') && normalized.length > 4) {
    return `${normalized.slice(0, -3)}y`;
  }

  const stem = normalized.slice(0, -2);

  // 2. Double consonant: stopped -> stop, planned -> plan, dropped -> drop
  if (/(.)\1$/.test(stem) && !/ss$/.test(stem)) {
    return stem.slice(0, -1);
  }

  // 3. If stem is already ending in 'e': e.g. decided -> decide, included -> include
  if (stem.endsWith('e')) {
    return stem;
  }

  // 4. Known silent-e verbs: postponed -> postpone, used -> use, liked -> like, moved -> move
  const withE = `${stem}e`;
  if (KNOWN_SILENT_E_VERBS.has(withE) || stem === 'postpon') {
    return withE;
  }

  // 5. Known non-e verbs: worked -> work, looked -> look, helped -> help
  if (KNOWN_NON_E_VERBS.has(stem)) {
    return stem;
  }

  // 6. Phonotactics:
  if (/[aeiou]{2}[bcdfghjklmnpqrstvwxyz]$/.test(stem)) {
    return stem;
  }
  if (/(rk|lp|mp|sk|nd|ld|rt|nt|lk|sh|tch|ch|gh|nk|ct|pt|ft)$/.test(stem)) {
    return stem;
  }
  if (
    stem.endsWith('c') ||
    stem.endsWith('g') ||
    stem.endsWith('v') ||
    stem.endsWith('z') ||
    stem.endsWith('us') ||
    /(at|ut|ud|ir|or|ur|iv|av|ov|is|oz|ul|os|clos|pos|clud|sid|vid|cid)$/.test(stem)
  ) {
    return `${stem}e`;
  }

  return stem;
}

/**
 * Main Morphological Analysis & Lemmatizer function
 */
export function analyzeMorphology(
  rawWord: string,
  contextSentence?: string
): MorphologicalAnalysis {
  const inputTrimmed = rawWord.trim();
  const normalized = inputTrimmed.toLowerCase();

  // Initialize base structure
  const result: MorphologicalAnalysis = {
    originalInput: inputTrimmed,
    lemmaCandidates: [],
    selectedLemma: normalized,
    partOfSpeech: [],
    formLabels: [],
    contextSentence: contextSentence?.trim() || undefined,
    senses: [],
    inflections: [],
    examples: [],
    source: 'rule-based',
    needsDisambiguation: false,
  };

  if (!normalized) {
    return result;
  }

  // 1. Phrasal Verbs with Particles (e.g. "looked up" -> "look up")
  const phrasal = parsePhrasalVerb(normalized);
  if (phrasal) {
    const verbAnalysis = analyzeMorphology(phrasal.verbPart, contextSentence);
    const candidateLemma = `${verbAnalysis.selectedLemma} ${phrasal.particlePart}`;
    result.lemmaCandidates = [
      {
        lemma: candidateLemma,
        pos: 'phrasal verb',
        formLabel: verbAnalysis.formLabels[0]
          ? `Cụm động từ (${verbAnalysis.formLabels[0]})`
          : 'Cụm động từ',
        explanationVi: `Cụm động từ nguyên mẫu: "${candidateLemma}"`,
      },
    ];
    result.selectedLemma = candidateLemma;
    result.partOfSpeech = ['phrasal verb'];
    result.formLabels = verbAnalysis.formLabels;
    result.inflections = [
      { form: `${verbAnalysis.selectedLemma} ${phrasal.particlePart}`, label: 'Nguyên mẫu' },
      { form: normalized, label: 'Dạng đã nhập' },
    ];
    return result;
  }

  // 2. Protected Words ending in -s (DO NOT mechanically strip: business, news, series, lens...)
  if (NON_STRIPPABLE_S_WORDS.has(normalized)) {
    result.selectedLemma = normalized;
    result.partOfSpeech = ['noun'];
    result.formLabels = ['Từ nguyên mẫu kết thúc bằng -s'];
    result.lemmaCandidates = [
      {
        lemma: normalized,
        pos: 'noun',
        formLabel: 'Từ nguyên mẫu (không cắt đuôi -s)',
        explanationVi: `Từ vựng nguyên mẫu: "${normalized}"`,
      },
    ];
    return result;
  }

  // 3. Established primary -ing nouns (e.g. "meeting", "building", "training")
  if (PRIMARY_ING_NOUNS[normalized]) {
    const info = PRIMARY_ING_NOUNS[normalized];
    const baseVerb = normalized.endsWith('ing') ? normalized.slice(0, -3) : normalized;
    const candidates: LemmaCandidate[] = [
      {
        lemma: normalized,
        pos: info.pos,
        formLabel: 'Danh từ độc lập',
        explanationVi: info.vi,
        isAmbiguous: true,
      },
      {
        lemma: baseVerb,
        pos: 'verb',
        formLabel: 'Dạng -ing của động từ',
        explanationVi: `Dạng hiện tại phân từ của động từ "${baseVerb}"`,
        isAmbiguous: true,
      },
    ];

    const disambiguated = disambiguateWithContext(normalized, candidates, contextSentence);
    result.selectedLemma = disambiguated.selectedLemma;
    result.lemmaCandidates = disambiguated.filteredCandidates;
    result.partOfSpeech = [info.pos, 'verb'];
    result.formLabels = disambiguated.filteredCandidates.map((c) => c.formLabel);
    result.needsDisambiguation = disambiguated.filteredCandidates.length > 1;
    result.confidenceReason = disambiguated.reason;
    return result;
  }

  // 4. Irregular Degrees (e.g. "better", "best", "worse", "worst")
  if (IRREGULAR_DEGREES[normalized]) {
    const candidates = IRREGULAR_DEGREES[normalized];
    const disambiguated = disambiguateWithContext(normalized, candidates, contextSentence);
    result.selectedLemma = disambiguated.selectedLemma;
    result.lemmaCandidates = disambiguated.filteredCandidates;
    result.partOfSpeech = Array.from(new Set(disambiguated.filteredCandidates.map((c) => c.pos)));
    result.formLabels = disambiguated.filteredCandidates.map((c) => c.formLabel);
    result.needsDisambiguation = disambiguated.filteredCandidates.length > 1;
    result.confidenceReason = disambiguated.reason;
    return result;
  }

  // 5. Irregular Verbs (e.g. "went" -> "go", "written" -> "write", "saw" -> "see"/"saw")
  if (IRREGULAR_VERBS[normalized]) {
    const rawCandidates: LemmaCandidate[] = IRREGULAR_VERBS[normalized].map((item) => ({
      lemma: item.lemma,
      pos: item.pos,
      formLabel: item.formLabel,
      explanationVi: item.explanationVi,
      isAmbiguous: item.isAmbiguous,
    }));

    const disambiguated = disambiguateWithContext(normalized, rawCandidates, contextSentence);
    result.selectedLemma = disambiguated.selectedLemma;
    result.lemmaCandidates = disambiguated.filteredCandidates;
    result.partOfSpeech = Array.from(new Set(disambiguated.filteredCandidates.map((c) => c.pos)));
    result.formLabels = disambiguated.filteredCandidates.map((c) => c.formLabel);
    result.needsDisambiguation = disambiguated.filteredCandidates.length > 1;
    result.confidenceReason = disambiguated.reason;
    result.inflections = [
      { form: disambiguated.selectedLemma, label: 'Nguyên mẫu (V1)' },
      { form: normalized, label: disambiguated.filteredCandidates[0]?.formLabel || 'Dạng biến thể' },
    ];
    return result;
  }

  // 6. Irregular Plurals (e.g. "children" -> "child", "criteria" -> "criterion")
  if (IRREGULAR_PLURALS[normalized]) {
    const item = IRREGULAR_PLURALS[normalized];
    result.selectedLemma = item.lemma;
    result.partOfSpeech = [item.pos];
    result.formLabels = ['Danh từ số nhiều bất quy tắc'];
    result.lemmaCandidates = [
      {
        lemma: item.lemma,
        pos: item.pos,
        formLabel: 'Danh từ số nhiều bất quy tắc',
        explanationVi: item.explanationVi,
      },
    ];
    result.inflections = [
      { form: item.lemma, label: 'Số ít' },
      { form: normalized, label: 'Số nhiều' },
    ];
    return result;
  }

  // 7. Regular Inflection Rules: -ies / -sses / -shes / -ches / -xes / -zes / -ves
  if (normalized.endsWith('ies') && normalized.length > 4) {
    const base = `${normalized.slice(0, -3)}y`;
    const candidates: LemmaCandidate[] = [
      {
        lemma: base,
        pos: 'verb',
        formLabel: 'Ngôi thứ 3 số ít hiện tại đơn',
        explanationVi: `Động từ nguyên mẫu: "${base}" (chia ngôi 3 số ít)`,
        isAmbiguous: true,
      },
      {
        lemma: base,
        pos: 'noun',
        formLabel: 'Danh từ số nhiều',
        explanationVi: `Danh từ nguyên mẫu: "${base}" (dạng số nhiều)`,
        isAmbiguous: true,
      },
    ];
    const disambiguated = disambiguateWithContext(normalized, candidates, contextSentence);
    result.selectedLemma = disambiguated.selectedLemma;
    result.lemmaCandidates = disambiguated.filteredCandidates;
    result.partOfSpeech = Array.from(new Set(disambiguated.filteredCandidates.map((c) => c.pos)));
    result.formLabels = disambiguated.filteredCandidates.map((c) => c.formLabel);
    result.needsDisambiguation = disambiguated.filteredCandidates.length > 1;
    result.confidenceReason = disambiguated.reason;
    result.inflections = [
      { form: base, label: 'Nguyên mẫu' },
      { form: normalized, label: 'Đuôi -ies' },
    ];
    return result;
  }

  // Words ending in -sses (e.g. businesses -> business, processes -> process, classes -> class)
  if (normalized.endsWith('sses') && normalized.length > 5) {
    const base = normalized.slice(0, -2);
    const candidates: LemmaCandidate[] = [
      {
        lemma: base,
        pos: 'noun',
        formLabel: 'Danh từ số nhiều (-es)',
        explanationVi: `Danh từ nguyên mẫu: "${base}" (dạng số nhiều)`,
      },
      {
        lemma: base,
        pos: 'verb',
        formLabel: 'Động từ ngôi 3 số ít (-es)',
        explanationVi: `Động từ nguyên mẫu: "${base}" (chia ngôi 3 số ít)`,
        isAmbiguous: true,
      },
    ];
    const disambiguated = disambiguateWithContext(normalized, candidates, contextSentence);
    result.selectedLemma = disambiguated.selectedLemma;
    result.lemmaCandidates = disambiguated.filteredCandidates;
    result.partOfSpeech = Array.from(new Set(disambiguated.filteredCandidates.map((c) => c.pos)));
    result.formLabels = disambiguated.filteredCandidates.map((c) => c.formLabel);
    result.needsDisambiguation = disambiguated.filteredCandidates.length > 1;
    result.confidenceReason = disambiguated.reason;
    result.inflections = [
      { form: base, label: 'Nguyên mẫu' },
      { form: normalized, label: 'Dạng số nhiều / chia ngôi' },
    ];
    return result;
  }

  // Words ending in -shes, -ches, -xes, -zes (e.g. watches -> watch, boxes -> box, wishes -> wish)
  if (/(shes|ches|xes|zes)$/.test(normalized) && normalized.length > 4) {
    const base = normalized.slice(0, -2);
    result.selectedLemma = base;
    result.lemmaCandidates = [
      {
        lemma: base,
        pos: 'noun',
        formLabel: 'Số nhiều / Ngôi thứ 3 (-es)',
        explanationVi: `Từ nguyên mẫu: "${base}"`,
      },
    ];
    result.partOfSpeech = ['noun', 'verb'];
    result.formLabels = ['Dạng đuôi -es'];
    result.inflections = [
      { form: base, label: 'Nguyên mẫu' },
      { form: normalized, label: 'Dạng -es' },
    ];
    return result;
  }

  // Words ending in -ves (e.g. knives -> knife, lives -> life/live, leaves -> leaf/leave)
  if (normalized.endsWith('ves') && normalized.length > 4) {
    const baseV = normalized.slice(0, -3);
    const candidateFe = `${baseV}fe`;
    const candidateF = `${baseV}f`;
    const candidateLemma = ['knife', 'wife', 'life'].includes(candidateFe) ? candidateFe : candidateF;
    result.selectedLemma = candidateLemma;
    result.lemmaCandidates = [
      {
        lemma: candidateLemma,
        pos: 'noun',
        formLabel: 'Danh từ số nhiều (-ves)',
        explanationVi: `Dạng số nhiều của danh từ "${candidateLemma}"`,
      },
    ];
    result.partOfSpeech = ['noun'];
    result.formLabels = ['Danh từ số nhiều (-ves)'];
    result.inflections = [
      { form: candidateLemma, label: 'Số ít' },
      { form: normalized, label: 'Số nhiều' },
    ];
    return result;
  }

  // 8. Regular -ing (e.g. "postponing" -> "postpone", "working" -> "work", "planning" -> "plan", "writing" -> "write")
  if (normalized.endsWith('ing') && normalized.length > 4) {
    const candidateBase = resolveBaseVerbFromIng(normalized);

    const candidates: LemmaCandidate[] = [
      {
        lemma: candidateBase,
        pos: 'verb',
        formLabel: 'Dạng -ing (Hiện tại phân từ)',
        explanationVi: `Dạng -ing của động từ "${candidateBase}"`,
      },
      {
        lemma: normalized,
        pos: 'adjective',
        formLabel: 'Tính từ ghép / định ngữ',
        explanationVi: `Dạng tính từ / danh động từ của "${normalized}"`,
        isAmbiguous: true,
      },
    ];
    const disambiguated = disambiguateWithContext(normalized, candidates, contextSentence);
    result.selectedLemma = disambiguated.selectedLemma;
    result.lemmaCandidates = disambiguated.filteredCandidates;
    result.partOfSpeech = Array.from(new Set(disambiguated.filteredCandidates.map((c) => c.pos)));
    result.formLabels = disambiguated.filteredCandidates.map((c) => c.formLabel);
    result.needsDisambiguation = disambiguated.filteredCandidates.length > 1;
    result.confidenceReason = disambiguated.reason;
    result.inflections = [
      { form: candidateBase, label: 'Nguyên mẫu' },
      { form: normalized, label: 'Dạng -ing' },
    ];
    return result;
  }

  // 9. Regular -ed (e.g. "postponed" -> "postpone", "worked" -> "work", "studied" -> "study", "stopped" -> "stop")
  if (normalized.endsWith('ed') && normalized.length > 3) {
    const candidateBase = resolveBaseVerbFromEd(normalized);

    result.selectedLemma = candidateBase;
    result.lemmaCandidates = [
      {
        lemma: candidateBase,
        pos: 'verb',
        formLabel: 'Quá khứ / Quá khứ phân từ (-ed)',
        explanationVi: `Dạng quá khứ có quy tắc của "${candidateBase}"`,
      },
    ];
    result.partOfSpeech = ['verb'];
    result.formLabels = ['Quá khứ có quy tắc (-ed)'];
    result.inflections = [
      { form: candidateBase, label: 'Nguyên mẫu' },
      { form: normalized, label: 'Quá khứ (-ed)' },
    ];
    return result;
  }

  // 10. Regular Plural / 3rd Person Singular -s (e.g. "books" -> "book", "requires" -> "require")
  if (
    normalized.endsWith('s') &&
    normalized.length > 3 &&
    !NON_STRIPPABLE_S_WORDS.has(normalized) &&
    !/(ss|us|is|as|os)$/.test(normalized)
  ) {
    const candidateBase = normalized.slice(0, -1);
    result.selectedLemma = candidateBase;
    result.lemmaCandidates = [
      {
        lemma: candidateBase,
        pos: 'noun/verb',
        formLabel: 'Số nhiều / Ngôi thứ 3 số ít (-s)',
        explanationVi: `Dạng số nhiều hoặc chia ngôi 3 số ít của "${candidateBase}"`,
      },
    ];
    result.partOfSpeech = ['noun', 'verb'];
    result.formLabels = ['Dạng thêm -s'];
    result.inflections = [
      { form: candidateBase, label: 'Nguyên mẫu' },
      { form: normalized, label: 'Dạng đuôi -s' },
    ];
    return result;
  }

  // 11. Default: Base word (preserve original input)
  result.selectedLemma = normalized;
  result.lemmaCandidates = [
    {
      lemma: normalized,
      pos: 'word',
      formLabel: 'Từ nguyên mẫu',
      explanationVi: `Từ vựng "${normalized}"`,
    },
  ];
  result.partOfSpeech = ['word'];
  result.formLabels = ['Từ nguyên mẫu'];
  return result;
}
