export interface ParsedImportItem {
  rawWord: string;
  word: string;
  userMeaning?: string;
  userPos?: string;
}

export interface ParseImportOptions {
  existingDeckWords?: Set<string>;
}

export interface ParseImportResult {
  items: ParsedImportItem[];
  duplicatesInBatch: number;
  duplicatesWithDeck: number;
  skippedEmpty: number;
}

/**
 * Parses a single CSV line according to RFC 4180 rules, preserving commas inside quoted fields.
 */
function parseCsvLine(line: string): string[] | null {
  if (!line.includes(',') && !line.includes('"')) {
    return null;
  }

  const fields: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped double quote
        currentField += '"';
        i++;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      fields.push(currentField.trim());
      currentField = '';
    } else {
      currentField += char;
    }
  }

  fields.push(currentField.trim());

  if (fields.length > 1) {
    return fields;
  }
  return null;
}

/**
 * Strips leading numbering or bullet prefixes:
 * e.g. "1. ", "2) ", "- ", "• ", "* "
 */
function stripBulletPrefix(str: string): string {
  return str
    .replace(/^[\d]+[.)]\s+/, '')
    .replace(/^[-*•]\s+/, '')
    .trim();
}

/**
 * Pure bulk import parser supporting:
 * - Hyphenated words (e.g. "cost-effective", "state-of-the-art", "up-to-date") without splitting
 * - Space-hyphen-space (" - ") or space-colon-space (" : ") for word - meaning
 * - Tab-separated values (TSV)
 * - Standard RFC 4180 CSV lines
 * - Automatic Unicode (NFC) & whitespace normalization
 * - Deduplication in batch and against existing deck
 */
export function parseBulkImportInput(
  input: string,
  options: ParseImportOptions = {}
): ParseImportResult {
  const existingDeck = options.existingDeckWords || new Set<string>();
  const normalizedExisting = new Set<string>();
  for (const word of existingDeck) {
    normalizedExisting.add(word.trim().toLowerCase().normalize('NFC'));
  }

  const lines = input.split(/[\r\n]+/);
  const seenInBatch = new Set<string>();

  const items: ParsedImportItem[] = [];
  let duplicatesInBatch = 0;
  let duplicatesWithDeck = 0;
  let skippedEmpty = 0;

  for (let line of lines) {
    line = line.trim();
    if (!line) {
      skippedEmpty++;
      continue;
    }

    let rawWord = '';
    let userMeaning: string | undefined;

    // 1. Try TSV (Tab Separated)
    if (line.includes('\t')) {
      const parts = line.split('\t');
      rawWord = parts[0].trim();
      userMeaning = parts.slice(1).join(' ').trim() || undefined;
    }
    // 2. Try quoted CSV line if it starts with quote or has quotes and commas
    else if (line.startsWith('"') && line.includes(',')) {
      const csvParts = parseCsvLine(line);
      if (csvParts && csvParts.length >= 1) {
        rawWord = csvParts[0];
        userMeaning = csvParts.slice(1).join('; ').trim() || undefined;
      }
    }
    // 3. Safe spaced separator: "word - meaning"
    else if (line.includes(' - ')) {
      const parts = line.split(' - ');
      rawWord = parts[0].trim();
      userMeaning = parts.slice(1).join(' - ').trim() || undefined;
    }
    // 4. Safe spaced colon: "word : meaning"
    else if (line.includes(' : ')) {
      const parts = line.split(' : ');
      rawWord = parts[0].trim();
      userMeaning = parts.slice(1).join(' : ').trim() || undefined;
    }
    // 5. Fallback single word / phrase per line (preserves inner hyphens and colons)
    else {
      rawWord = line;
    }

    // Strip bullet numbering on the word
    rawWord = stripBulletPrefix(rawWord);

    // Normalize word
    const normalizedWord = rawWord.toLowerCase().trim().normalize('NFC');
    if (!normalizedWord) {
      skippedEmpty++;
      continue;
    }

    // Check duplicate with existing deck
    if (normalizedExisting.has(normalizedWord)) {
      duplicatesWithDeck++;
      continue;
    }

    // Check duplicate within batch
    if (seenInBatch.has(normalizedWord)) {
      duplicatesInBatch++;
      continue;
    }

    seenInBatch.add(normalizedWord);

    items.push({
      rawWord,
      word: normalizedWord,
      userMeaning: userMeaning && userMeaning.normalize('NFC'),
    });
  }

  return {
    items,
    duplicatesInBatch,
    duplicatesWithDeck,
    skippedEmpty,
  };
}
