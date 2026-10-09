import type { ReviewRating } from '../types/vocab';

export type DiffStatus = 'correct' | 'wrong' | 'missing' | 'extra';

export interface DiffToken {
  id: string;
  status: DiffStatus;
  inputChar: string; // Ký tự người học đã gõ (hoặc '' nếu thiếu)
  targetChar: string; // Ký tự đúng trong đáp án (hoặc '' nếu thừa)
  inputIndex?: number; // Chỉ số trong chuỗi input
  targetIndex?: number; // Chỉ số trong chuỗi target
  isRevealed?: boolean; // Đã được hiển thị qua gợi ý hay chưa
}

export interface AlignmentResult {
  tokens: DiffToken[];
  isExactMatch: boolean;
  correctCount: number;
  wrongCount: number;
  missingCount: number;
  extraCount: number;
  editDistance: number;
  firstErrorTokenIndex: number; // Chỉ số token đầu tiên có lỗi (wrong hoặc missing hoặc extra)
}

export interface DictationAttemptStats {
  firstAttemptCorrect: boolean;
  firstAttemptEditDistance: number;
  incorrectSubmissionCount: number;
  hintsUsedCount: number;
  revealedAnswer: boolean;
  audioPlayCount: number;
}

/**
 * Chuẩn hóa chuỗi nhập liệu:
 * - Chuẩn hóa Unicode NFC (bảo lưu dấu tiếng Việt và dấu ngữ nghĩa như café).
 * - Chuẩn hóa dấu nháy cong (‘ ’ “ ”) thành dấu nháy chuẩn (' ").
 * - Cắt khoảng trắng đầu cuối, gộp các khoảng trắng liên tiếp thành 1 khoảng trắng đơn.
 */
export function normalizeDictationInput(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFC')
    .trim()
    .replace(/[\u2018\u2019\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201F\u2033]/g, '"')
    .replace(/\s+/g, ' ');
}

/**
 * Xử lý thông minh dấu câu gõ nhầm trên bàn phím di động (ví dụ nhấp đúp space sinh dấu chấm):
 * Nếu từ mục tiêu không có dấu câu ở cuối nhưng người dùng gõ thêm dấu chấm/phẩy ở cuối thì bỏ qua.
 */
export function cleanPunctuationForComparison(input: string, target: string): string {
  let cleaned = normalizeDictationInput(input);
  const normTarget = normalizeDictationInput(target);

  if (!normTarget.endsWith('.') && cleaned.endsWith('.')) {
    cleaned = cleaned.replace(/\.+$/, '');
  }
  if (!normTarget.endsWith(',') && cleaned.endsWith(',')) {
    cleaned = cleaned.replace(/,+$/, '');
  }
  return cleaned;
}

/**
 * Thuật toán căn chỉnh chuỗi (Needleman-Wunsch / Levenshtein Sequence Alignment):
 * Tìm cách căn chỉnh tối ưu giữa input và target để phân biệt:
 * - 'correct': ký tự gõ đúng.
 * - 'missing': ký tự bị thiếu từ target (cần bổ sung).
 * - 'extra': ký tự gõ thừa trong input (cần xóa).
 * - 'wrong': ký tự gõ sai (thay thế).
 *
 * Nhờ căn chỉnh, 1 ký tự thiếu (ví dụ: aple vs apple) KHÔNG làm lệch toàn bộ phần phía sau.
 */
export function alignDictationStrings(
  rawInput: string,
  rawTarget: string,
  revealedTargetIndices: Set<number> = new Set()
): AlignmentResult {
  const normInput = cleanPunctuationForComparison(rawInput, rawTarget).toLowerCase();
  const normTarget = normalizeDictationInput(rawTarget).toLowerCase();

  const M = normInput.length;
  const N = normTarget.length;

  // Bảng quy hoạch động tính khoảng cách sửa đổi
  const dp: number[][] = Array.from({ length: M + 1 }, () => Array(N + 1).fill(0));

  for (let i = 0; i <= M; i++) {
    dp[i][0] = i; // chi phí xóa ký tự thừa
  }
  for (let j = 0; j <= N; j++) {
    dp[0][j] = j; // chi phí chèn ký tự thiếu
  }

  for (let i = 1; i <= M; i++) {
    for (let j = 1; j <= N; j++) {
      const match = normInput[i - 1] === normTarget[j - 1];
      const costMatch = match ? 0 : 1;

      const subCost = dp[i - 1][j - 1] + costMatch;
      const delCost = dp[i - 1][j] + 1; // xóa từ input (extra)
      const insCost = dp[i][j - 1] + 1; // chèn từ target (missing)

      dp[i][j] = Math.min(subCost, delCost, insCost);
    }
  }

  // Truy vết ngược (backtracking) từ (M, N) về (0, 0)
  // Ưu tiên đường dẫn có chi phí tiền tố (prevCost) nhỏ nhất để giữ khớp đúng từ trái sang phải
  let i = M;
  let j = N;
  const rawTokens: Array<{
    status: DiffStatus;
    inputChar: string;
    targetChar: string;
    inputIndex?: number;
    targetIndex?: number;
  }> = [];

  interface Candidate {
    status: DiffStatus;
    prevI: number;
    prevJ: number;
    prevCost: number;
    priority: number;
    inputChar: string;
    targetChar: string;
    inputIndex?: number;
    targetIndex?: number;
  }

  while (i > 0 || j > 0) {
    const candidates: Candidate[] = [];
    const currentVal = dp[i][j];

    // 1. Khớp đúng (match)
    if (i > 0 && j > 0 && normInput[i - 1] === normTarget[j - 1] && currentVal === dp[i - 1][j - 1]) {
      candidates.push({
        status: 'correct',
        prevI: i - 1,
        prevJ: j - 1,
        prevCost: dp[i - 1][j - 1],
        priority: 4,
        inputChar: normInput[i - 1],
        targetChar: normTarget[j - 1],
        inputIndex: i - 1,
        targetIndex: j - 1,
      });
    }

    // 2. Thiếu ký tự (insertion từ target)
    if (j > 0 && currentVal === dp[i][j - 1] + 1) {
      candidates.push({
        status: 'missing',
        prevI: i,
        prevJ: j - 1,
        prevCost: dp[i][j - 1],
        priority: 3,
        inputChar: '',
        targetChar: normTarget[j - 1],
        targetIndex: j - 1,
      });
    }

    // 3. Thừa ký tự (deletion từ input)
    if (i > 0 && currentVal === dp[i - 1][j] + 1) {
      candidates.push({
        status: 'extra',
        prevI: i - 1,
        prevJ: j,
        prevCost: dp[i - 1][j],
        priority: 2,
        inputChar: normInput[i - 1],
        targetChar: '',
        inputIndex: i - 1,
      });
    }

    // 4. Sai ký tự (substitution)
    if (i > 0 && j > 0 && currentVal === dp[i - 1][j - 1] + 1) {
      candidates.push({
        status: 'wrong',
        prevI: i - 1,
        prevJ: j - 1,
        prevCost: dp[i - 1][j - 1],
        priority: 1,
        inputChar: normInput[i - 1],
        targetChar: normTarget[j - 1],
        inputIndex: i - 1,
        targetIndex: j - 1,
      });
    }

    // Sắp xếp: Ưu tiên prevCost nhỏ nhất (giữ chuỗi tiền tố chính xác tối đa), sau đó ưu tiên độ ưu tiên phép toán
    candidates.sort((a, b) => {
      if (a.prevCost !== b.prevCost) return a.prevCost - b.prevCost;
      return b.priority - a.priority;
    });

    const chosen = candidates[0];
    rawTokens.push({
      status: chosen.status,
      inputChar: chosen.inputChar,
      targetChar: chosen.targetChar,
      inputIndex: chosen.inputIndex,
      targetIndex: chosen.targetIndex,
    });
    i = chosen.prevI;
    j = chosen.prevJ;
  }

  rawTokens.reverse();

  let correctCount = 0;
  let wrongCount = 0;
  let missingCount = 0;
  let extraCount = 0;
  let firstErrorTokenIndex = -1;

  const tokens: DiffToken[] = rawTokens.map((t, idx) => {
    if (t.status === 'correct') correctCount++;
    if (t.status === 'wrong') {
      wrongCount++;
      if (firstErrorTokenIndex === -1) firstErrorTokenIndex = idx;
    }
    if (t.status === 'missing') {
      missingCount++;
      if (firstErrorTokenIndex === -1) firstErrorTokenIndex = idx;
    }
    if (t.status === 'extra') {
      extraCount++;
      if (firstErrorTokenIndex === -1) firstErrorTokenIndex = idx;
    }

    const isRevealed =
      t.targetIndex !== undefined ? revealedTargetIndices.has(t.targetIndex) : false;

    return {
      id: `diff-${idx}-${t.status}-${t.inputIndex ?? 'x'}-${t.targetIndex ?? 'y'}`,
      status: t.status,
      inputChar: t.inputChar,
      targetChar: t.targetChar,
      inputIndex: t.inputIndex,
      targetIndex: t.targetIndex,
      isRevealed,
    };
  });

  const editDistance = wrongCount + missingCount + extraCount;
  const isExactMatch = editDistance === 0;

  return {
    tokens,
    isExactMatch,
    correctCount,
    wrongCount,
    missingCount,
    extraCount,
    editDistance,
    firstErrorTokenIndex,
  };
}

/**
 * Tìm vị trí ký tự đầu tiên bị lỗi (sai hoặc thiếu) mà chưa được tiết lộ để gợi ý.
 */
export function findNextHintTargetIndex(
  tokens: DiffToken[],
  revealedIndices: Set<number>
): { tokenIndex: number; targetIndex: number; targetChar: string } | null {
  for (let idx = 0; idx < tokens.length; idx++) {
    const token = tokens[idx];
    if (
      (token.status === 'wrong' || token.status === 'missing') &&
      token.targetIndex !== undefined &&
      token.targetChar &&
      !revealedIndices.has(token.targetIndex)
    ) {
      return {
        tokenIndex: idx,
        targetIndex: token.targetIndex,
        targetChar: token.targetChar,
      };
    }
  }
  return null;
}

/**
 * Tính toán mức độ ghi nhớ và ánh xạ chuẩn xác vào thuật toán FSRS v5 (ReviewRating):
 * - 4: Easy (Mức nhớ cao) -> Đúng ngay lần đầu tiên, không dùng gợi ý.
 * - 3: Good (Mức nhớ khá) -> Sai sót nhỏ (khoảng cách <= 1-2 ký tự) và tự sửa đúng ngay lần 2 (không dùng gợi ý).
 * - 2: Hard (Mức nhớ thấp) -> Cần dùng gợi ý chữ cái, hoặc sai nhiều lần (>= 2 lần) mới sửa đúng.
 * - 1: Again (Quên) -> Bấm xem đáp án hoặc bỏ qua. Sau khi xem đáp án, việc nhập lại chỉ là luyện tập củng cố.
 *
 * *Lưu ý*: Số lần nghe lại không làm giảm điểm nhớ.
 */
export function calculateDictationRating(
  stats: DictationAttemptStats,
  targetLength: number
): ReviewRating {
  // 1. Nếu đã bấm "Xem đáp án" -> Chắc chắn tính là Again (1)
  if (stats.revealedAnswer) {
    return 1;
  }

  // 2. Đúng ngay lần kiểm tra đầu tiên, không dùng gợi ý -> Easy (4)
  if (stats.firstAttemptCorrect && stats.hintsUsedCount === 0) {
    return 4;
  }

  // 3. Phải dùng gợi ý chữ cái mới làm đúng -> Hard (2)
  if (stats.hintsUsedCount > 0) {
    return 2;
  }

  // 4. Sai nhẹ và tự sửa đúng trong 1 lần thử tiếp theo:
  // Sai nhẹ: khoảng cách sửa đổi lần 1 <= 1 (hoặc <= 2 với từ dài >= 7 ký tự)
  const isMinorError = stats.firstAttemptEditDistance <= (targetLength >= 7 ? 2 : 1);
  const isQuickSelfCorrection = stats.incorrectSubmissionCount === 1;

  if (isMinorError && isQuickSelfCorrection) {
    return 3; // Good
  }

  // 5. Sai nhiều lần (>= 2 lần sai) hoặc lỗi lần đầu quá lớn nhưng tự sửa thành công
  return 2; // Hard
}
