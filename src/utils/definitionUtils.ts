/**
 * Definition utilities for parsing and displaying multi-sense vocabulary definitions.
 */

export interface ParsedSense {
  index: number;
  pos?: string;
  text: string;
}

const EXAMPLE_LABEL = /^(?:ví dụ|v[íi]\s*dụ|vd\.?|example(?:s)?|e\.g\.)\s*(?:[:：]|["“]|$)/i;
const POS_LABEL = /^(?:\((?:danh từ(?: trừu tượng)?|động từ|tính từ|trạng từ|noun|verb|adjective|adverb|n\.?|v\.?|adj\.?|adv\.?)\)\s*:?|(?:danh từ(?: trừu tượng)?|động từ|tính từ|trạng từ|noun|verb|adjective|adverb)\s*:)\s*/i;

/** Remove labelled examples, keeping short sense qualifiers and every numbered sense. */
export function normalizeVietnameseDefinition(raw: string): string {
  let withoutExamples = '';
  for (let index = 0; index < raw.length; index++) {
    if (raw[index] !== '(') {
      withoutExamples += raw[index];
      continue;
    }
    let end = index + 1;
    let depth = 1;
    while (end < raw.length && depth > 0) {
      if (raw[end] === '(') depth++;
      else if (raw[end] === ')') depth--;
      end++;
    }
    const group = raw.slice(index, end);
    if (!EXAMPLE_LABEL.test(group.slice(1).trimStart())) withoutExamples += group;
    index = end - 1;
  }

  return withoutExamples.trim().split(/(?:^|\s+)(?=\d+[.)]\s+)|\n+|;\s*(?=(?:\(|danh từ|động từ|tính từ|trạng từ|noun|verb|adjective|adverb))/i)
    .map(part => {
      part = part.replace(/^\s*[-•]\s+/, '').trim();
      const number = part.match(/^\d+[.)]\s+/)?.[0] ?? '';
      const meaning = part.slice(number.length)
        .replace(POS_LABEL, '')
        .replace(/(?:^|[\s;.!])(?:ví dụ|vd\.?|examples?|e\.g\.)\s*[:：][\s\S]*$/i, '')
        .replace(/\s+/g, ' ')
        .replace(/\s+([;,])/g, '$1')
        .replace(/[\s;,.]+$/, '').trim();
      return meaning ? number + meaning : '';
    }).filter(Boolean).join('; ');
}

/**
 * Parses raw definition string into distinct senses (e.g. 1. Bể bơi; 2. Nhóm người...)
 */
export function parseMultipleMeanings(raw: string): ParsedSense[] {
  if (!raw) return [];
  const text = raw.trim();

  // 1. Numbered pattern: "1. meaning A 2. meaning B" or "1. meaning A; 2. meaning B"
  if (/(?:^|\s)\d+[\.\)]\s+/.test(text)) {
    const parts = text
      .split(/(?:^|\s+)(?=\d+[\.\)]\s+)/)
      .map((s) => s.replace(/^\d+[\.\)]\s*/, '').replace(/^[;,]\s*/, '').replace(/[;,]\s*$/, '').trim())
      .filter(Boolean);
    if (parts.length > 1) {
      return parts.map((t, idx) => ({ index: idx + 1, text: t }));
    }
  }

  // 2. Newline separated
  if (text.includes('\n')) {
    const parts = text
      .split(/\n+/)
      .map((s) => s.replace(/^\d+[\.\)]\s*/, '').trim())
      .filter(Boolean);
    if (parts.length > 1) {
      return parts.map((t, idx) => ({ index: idx + 1, text: t }));
    }
  }

  // 3. Semicolon separated (e.g. "(danh từ) hồ bơi, vũng nước; (động từ) gom góp vốn")
  if (text.includes(';')) {
    const parts = text
      .split(';')
      .map((s) => s.replace(/^\d+[\.\)]\s*/, '').trim())
      .filter(Boolean);
    if (parts.length > 1) {
      return parts.map((t, idx) => ({ index: idx + 1, text: t }));
    }
  }

  return [{ index: 1, text }];
}
