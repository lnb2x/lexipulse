import { db } from './schema';
import type { WordItem } from '../../types/vocab';
import { formatLocalDate } from '../../utils/dateUtils';

/**
 * Export deck to formatted JSON string (either all or provided subset)
 */
export async function exportDeckToJson(wordsToExport?: WordItem[]): Promise<string> {
  const words = wordsToExport ?? (await db.words.toArray());
  return JSON.stringify(words, null, 2);
}

/**
 * Export deck to CSV string with UTF-8 BOM for reliable Excel & Sheets display
 */
export async function exportDeckToCsv(wordsToExport?: WordItem[]): Promise<string> {
  const words = wordsToExport ?? (await db.words.toArray());

  const escapeCsv = (val: string | number | undefined | null): string => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/[\r\n]+/g, ' ').trim();
    return `"${str.replace(/"/g, '""')}"`;
  };

  const headers = [
    'Word',
    'POS',
    'Phonetic_US',
    'Phonetic_UK',
    'Vietnamese_Definition',
    'English_Definition',
    'Collocations',
    'Word_Family',
    'Tags',
    'Status',
    'Created_Date',
    'Due_Date',
    'Repetition',
    'Interval_Days',
    'Ease_Factor',
    'Example_General_EN',
    'Example_General_VI',
    'Example_TOEIC_EN',
    'Example_TOEIC_VI',
  ];

  const formatStatus = (st: string) => {
    switch (st) {
      case 'review_needed':
        return 'Cần ôn tập (Review Needed)';
      case 'learning':
        return 'Đang học (Learning)';
      case 'mastered':
        return 'Thành thạo (Mastered)';
      case 'new':
        return 'Từ mới (New)';
      default:
        return st;
    }
  };

  const rows = words.map((w) => {
    const collocations = (w.collocations || []).map((c) => `${c.phrase} (${c.meaningVi})`).join('; ');
    const wordFamily = (w.wordFamily || [])
      .map((wf) => `${wf.word} (${wf.pos}${wf.meaningVi ? `: ${wf.meaningVi}` : ''})`)
      .join('; ');
    const general = w.examples.find((e) => e.context === 'general');
    const toeic = w.examples.find((e) => e.context === 'toeic');
    const createdDateStr = formatLocalDate(w.createdAt);
    const dueDateStr = formatLocalDate(w.reviewMeta.dueDate);

    const fields = [
      escapeCsv(w.word),
      escapeCsv(w.pos.join(', ')),
      escapeCsv(w.phonetics.us || ''),
      escapeCsv(w.phonetics.uk || ''),
      escapeCsv(w.vietnameseDefinition || ''),
      escapeCsv(w.englishDefinition || ''),
      escapeCsv(collocations),
      escapeCsv(wordFamily),
      escapeCsv(w.tags.join(', ')),
      escapeCsv(formatStatus(w.status)),
      escapeCsv(createdDateStr),
      escapeCsv(dueDateStr),
      escapeCsv(w.reviewMeta.repetition),
      escapeCsv(w.reviewMeta.interval),
      escapeCsv(w.reviewMeta.easeFactor.toFixed(2)),
      escapeCsv(general?.en || ''),
      escapeCsv(general?.vi || ''),
      escapeCsv(toeic?.en || ''),
      escapeCsv(toeic?.vi || ''),
    ];

    return fields.join(',');
  });

  // \uFEFF is the UTF-8 Byte Order Mark (BOM)
  return '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows].join('\r\n');
}

/**
 * Export deck to native Microsoft Excel (.xlsx) Blob using dynamic import
 */
export async function exportDeckToXlsx(wordsToExport?: WordItem[]): Promise<Blob> {
  const words = wordsToExport ?? (await db.words.toArray());

  const formatStatus = (st: string) => {
    switch (st) {
      case 'review_needed':
        return 'Cần ôn tập (Review Needed)';
      case 'learning':
        return 'Đang học (Learning)';
      case 'mastered':
        return 'Thành thạo (Mastered)';
      case 'new':
        return 'Từ mới (New)';
      default:
        return st;
    }
  };

  const data = words.map((w) => {
    const collocations = (w.collocations || []).map((c) => `${c.phrase} (${c.meaningVi})`).join('; ');
    const wordFamily = (w.wordFamily || [])
      .map((wf) => `${wf.word} (${wf.pos}${wf.meaningVi ? `: ${wf.meaningVi}` : ''})`)
      .join('; ');
    const general = w.examples.find((e) => e.context === 'general');
    const toeic = w.examples.find((e) => e.context === 'toeic');
    const createdDateStr = formatLocalDate(w.createdAt);
    const dueDateStr = formatLocalDate(w.reviewMeta.dueDate);

    return {
      'Từ vựng (Word)': w.word,
      'Từ loại (POS)': w.pos.join(', '),
      'Phiên âm US': w.phonetics.us || '',
      'Phiên âm UK': w.phonetics.uk || '',
      'Nghĩa Tiếng Việt': w.vietnameseDefinition || '',
      'Định nghĩa Tiếng Anh': w.englishDefinition || '',
      'Cụm từ thông dụng (Collocations)': collocations,
      'Gia đình từ (Word Family)': wordFamily,
      'Thẻ phân loại (Tags)': w.tags.join(', '),
      'Trạng thái (Status)': formatStatus(w.status),
      'Ngày thêm vào (Created Date)': createdDateStr,
      'Hạn ôn tập (Due Date)': dueDateStr,
      'Số lần đã ôn (Reps)': w.reviewMeta.repetition,
      'Khoảng cách ngày (Interval)': w.reviewMeta.interval,
      'Hệ số ghi nhớ (Ease Factor)': Number(w.reviewMeta.easeFactor.toFixed(2)),
      'Ví dụ thông dụng EN': general?.en || '',
      'Dịch ví dụ thông dụng VI': general?.vi || '',
      'Ví dụ TOEIC EN': toeic?.en || '',
      'Dịch ví dụ TOEIC VI': toeic?.vi || '',
    };
  });

  const XLSX = await import('xlsx');
  const worksheet = XLSX.utils.json_to_sheet(data);

  // Set proportional column widths for comfortable reading in Excel
  worksheet['!cols'] = [
    { wch: 18 }, // Word
    { wch: 12 }, // POS
    { wch: 18 }, // US
    { wch: 18 }, // UK
    { wch: 35 }, // Vietnamese Definition
    { wch: 45 }, // English Definition
    { wch: 40 }, // Collocations
    { wch: 30 }, // Word Family
    { wch: 25 }, // Tags
    { wch: 25 }, // Status
    { wch: 16 }, // Created Date
    { wch: 16 }, // Due Date
    { wch: 12 }, // Repetition
    { wch: 14 }, // Interval
    { wch: 14 }, // Ease Factor
    { wch: 45 }, // Example Gen EN
    { wch: 45 }, // Example Gen VI
    { wch: 50 }, // Example TOEIC EN
    { wch: 50 }, // Example TOEIC VI
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'LexiPulse Vocabulary');

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
