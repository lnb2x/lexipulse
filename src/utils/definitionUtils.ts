/**
 * Definition utilities for parsing and displaying multi-sense vocabulary definitions.
 */

export interface ParsedSense {
  index: number;
  pos?: string;
  text: string;
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
