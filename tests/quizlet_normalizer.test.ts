import { describe, it, expect } from 'vitest';
import {
  cleanQuizletTerm,
  normalizeQuizletCard,
  extractIpaFromText,
  cleanDefinitionPosPrefix,
  isPlaceholderDefinition,
} from '../src/services/quizlet/quizletNormalizer';

describe('Quizlet Normalizer', () => {
  describe('cleanQuizletTerm', () => {
    it('removes parentheticals at the end: international tax preparation (np) -> international tax preparation', () => {
      expect(cleanQuizletTerm('international tax preparation (np)')).toBe('international tax preparation');
    });

    it('removes POS parenthetical: founder (n) -> founder', () => {
      expect(cleanQuizletTerm('founder (n)')).toBe('founder');
    });

    it('removes multiple groups of parentheses including middle and trailing: take (something) into account (vp)', () => {
      expect(cleanQuizletTerm('take (something) into account (vp)')).toBe('take into account');
    });

    it('removes parentheses in the middle of a term', () => {
      expect(cleanQuizletTerm('take (something) into account')).toBe('take into account');
      expect(cleanQuizletTerm('make (one\'s) way')).toBe('make way');
      expect(cleanQuizletTerm('turn (sth) off')).toBe('turn off');
    });

    it('keeps term unchanged when there are no parentheses', () => {
      expect(cleanQuizletTerm('feasible')).toBe('feasible');
      expect(cleanQuizletTerm('international tax preparation')).toBe('international tax preparation');
    });

    it('collapses multiple consecutive spaces and trims leading/trailing spaces', () => {
      expect(cleanQuizletTerm('   take   (something)   into   account (vp)   ')).toBe('take into account');
      expect(cleanQuizletTerm('  founder   (n)  ')).toBe('founder');
    });

    it('handles nested parentheses properly: word ((nested)) -> word', () => {
      expect(cleanQuizletTerm('word ((nested))')).toBe('word');
      expect(cleanQuizletTerm('(np) international tax preparation (us)')).toBe('international tax preparation');
    });

    it('returns empty string when term only contains parentheses', () => {
      expect(cleanQuizletTerm('(n)')).toBe('');
      expect(cleanQuizletTerm('(something)')).toBe('');
      expect(cleanQuizletTerm('  (np)  ')).toBe('');
      expect(cleanQuizletTerm('()')).toBe('');
      expect(cleanQuizletTerm('')).toBe('');
    });
  });

  describe('normalizeQuizletCard', () => {
    it('accurately splits "sign the contract (v)" into clean phrase and POS tag', () => {
      const result = normalizeQuizletCard('sign the contract (v)', 'ký hợp đồng');
      expect(result.word).toBe('sign the contract');
      expect(result.pos).toEqual(['verb']);
      expect(result.hasExtractedPos).toBe(true);
      expect(result.definition).toBe('ký hợp đồng');
      expect(result.rawWord).toBe('sign the contract (v)');
      expect(result.rawDefinition).toBe('ký hợp đồng');
    });

    it('splits various standard POS tags: (n), (adj), (adv), (phr), (np), (vp)', () => {
      const noun = normalizeQuizletCard('apple (n)', 'quả táo');
      expect(noun.word).toBe('apple');
      expect(noun.pos).toEqual(['noun']);

      const adj = normalizeQuizletCard('reliable (adj)', 'đáng tin cậy');
      expect(adj.word).toBe('reliable');
      expect(adj.pos).toEqual(['adjective']);

      const adv = normalizeQuizletCard('quickly (adv)', 'nhanh chóng');
      expect(adv.word).toBe('quickly');
      expect(adv.pos).toEqual(['adverb']);

      const phrase = normalizeQuizletCard('in terms of (phr)', 'về mặt');
      expect(phrase.word).toBe('in terms of');
      expect(phrase.pos).toEqual(['phrase']);

      const np = normalizeQuizletCard('international tax preparation (np)', 'chuẩn bị thuế quốc tế');
      expect(np.word).toBe('international tax preparation');
      expect(np.pos).toEqual(['phrase']);

      const vp = normalizeQuizletCard('take (something) into account (vp)', 'tính đến cái gì');
      expect(vp.word).toBe('take into account');
      expect(vp.pos).toEqual(['verb']);
    });

    it('automatically removes all parentheticals from term while keeping definition untouched', () => {
      const wto = normalizeQuizletCard('WTO (World Trade Organization)', 'Tổ chức Thương mại Thế giới (viết tắt WTO)');
      expect(wto.word).toBe('WTO');
      expect(wto.rawWord).toBe('WTO (World Trade Organization)');
      // Definition should preserve its parenthetical
      expect(wto.definition).toBe('Tổ chức Thương mại Thế giới (viết tắt WTO)');

      const kiwi = normalizeQuizletCard('kiwi (fruit)', 'trái kiwi (màu xanh)');
      expect(kiwi.word).toBe('kiwi');
      expect(kiwi.definition).toBe('trái kiwi (màu xanh)');

      const bank = normalizeQuizletCard('bank (financial institution)', 'ngân hàng');
      expect(bank.word).toBe('bank');
    });

    it('extracts embedded IPA from definition and cleans the definition text', () => {
      const result = normalizeQuizletCard('branch', '/bræntʃ/ - cành cây, chi nhánh');
      expect(result.word).toBe('branch');
      expect(result.extractedIpa).toBe('/bræntʃ/');
      expect(result.hasExtractedIpa).toBe(true);
      expect(result.definition).toBe('cành cây, chi nhánh');
    });

    it('handles bracketed IPA format [teɪk ɒf]', () => {
      const result = normalizeQuizletCard('take off', '[teɪk ɒf] cất cánh');
      expect(result.word).toBe('take off');
      expect(result.extractedIpa).toBe('/teɪk ɒf/');
      expect(result.hasExtractedIpa).toBe(true);
      expect(result.definition).toBe('cất cánh');
    });

    it('cleans leading POS markers in definitions like "(v) ký hợp đồng"', () => {
      const result = normalizeQuizletCard('sign the contract', '(v) ký hợp đồng');
      expect(result.definition).toBe('ký hợp đồng');
      expect(result.pos).toEqual(['verb']);
    });
  });

  describe('extractIpaFromText', () => {
    it('extracts slash IPA and strips punctuation delimiters', () => {
      const { ipa, cleanText } = extractIpaFromText('/kənˈtrækt/ : hợp đồng');
      expect(ipa).toBe('/kənˈtrækt/');
      expect(cleanText).toBe('hợp đồng');
    });

    it('returns undefined ipa when no valid IPA pattern exists', () => {
      const { ipa, cleanText } = extractIpaFromText('chỉ có nghĩa tiếng Việt');
      expect(ipa).toBeUndefined();
      expect(cleanText).toBe('chỉ có nghĩa tiếng Việt');
    });
  });

  describe('cleanDefinitionPosPrefix', () => {
    it('strips leading (v), (n.), v. from definitions', () => {
      expect(cleanDefinitionPosPrefix('(v) chạy').cleanDef).toBe('chạy');
      expect(cleanDefinitionPosPrefix('v. chạy').cleanDef).toBe('chạy');
      expect(cleanDefinitionPosPrefix('(adj) đẹp').cleanDef).toBe('đẹp');
      expect(cleanDefinitionPosPrefix('adj. đẹp').cleanDef).toBe('đẹp');
    });
  });

  describe('isPlaceholderDefinition', () => {
    it('identifies English placeholder definitions', () => {
      expect(isPlaceholderDefinition('Definition for "sign the contract (v)"')).toBe(true);
      expect(isPlaceholderDefinition('Definition for "apple"')).toBe(true);
      expect(isPlaceholderDefinition('No definition found for test')).toBe(true);
    });

    it('identifies Vietnamese placeholder definitions', () => {
      expect(isPlaceholderDefinition('Từ vựng "sign the contract (v)"')).toBe(true);
      expect(isPlaceholderDefinition('Chưa có định nghĩa cho từ này')).toBe(true);
    });

    it('does not flag authentic definitions as placeholders', () => {
      expect(isPlaceholderDefinition('To sign an official legal document')).toBe(false);
      expect(isPlaceholderDefinition('Ký kết hợp đồng giao dịch')).toBe(false);
      expect(isPlaceholderDefinition('A round fruit with red or green skin')).toBe(false);
    });
  });
});
