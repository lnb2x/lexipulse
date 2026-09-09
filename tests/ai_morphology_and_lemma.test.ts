import { describe, it, expect, beforeEach } from 'vitest';
import {
  analyzeMorphology,
  resolveBaseVerbFromIng,
  resolveBaseVerbFromEd,
} from '../src/services/morphology/lemmatizer';
import {
  validateAIMorphologyResult,
  getCachedMorphology,
  setCachedMorphology,
  clearMorphologyCache,
  SUSPICIOUS_TRUNCATED_STEMS,
} from '../src/services/ai/aiMorphology';

describe('English Morphology & Lemma Identification (Section 10 Acceptance Criteria)', () => {
  describe('Mandatory Lemma Test Cases', () => {
    const cases: Array<{ input: string; expectedLemma: string; context?: string; forbiddenLemma?: string }> = [
      // Silent-e verbs -ing & -ed
      { input: 'postponing', expectedLemma: 'postpone', forbiddenLemma: 'postpon' },
      { input: 'postponed', expectedLemma: 'postpone', forbiddenLemma: 'postpon' },
      { input: 'making', expectedLemma: 'make' },
      { input: 'taking', expectedLemma: 'take' },
      { input: 'using', expectedLemma: 'use' },
      { input: 'writing', expectedLemma: 'write' },

      // Consonant doubling
      { input: 'running', expectedLemma: 'run' },
      { input: 'swimming', expectedLemma: 'swim' },
      { input: 'planning', expectedLemma: 'plan' },
      { input: 'stopping', expectedLemma: 'stop' },

      // y-to-i inflections
      { input: 'studies', expectedLemma: 'study' },
      { input: 'studied', expectedLemma: 'study' },
      { input: 'studying', expectedLemma: 'study' },
      { input: 'tries', expectedLemma: 'try' },
      { input: 'tried', expectedLemma: 'try' },

      // Irregular verbs
      { input: 'went', expectedLemma: 'go' },
      { input: 'gone', expectedLemma: 'go' },
      { input: 'did', expectedLemma: 'do' },
      { input: 'done', expectedLemma: 'do' },
      { input: 'was', expectedLemma: 'be' },
      { input: 'were', expectedLemma: 'be' },
      { input: 'been', expectedLemma: 'be' },
      { input: 'bought', expectedLemma: 'buy' },
      { input: 'brought', expectedLemma: 'bring' },
      { input: 'thought', expectedLemma: 'think' },
      { input: 'caught', expectedLemma: 'catch' },
      { input: 'taught', expectedLemma: 'teach' },
      { input: 'written', expectedLemma: 'write' },
      { input: 'spoken', expectedLemma: 'speak' },
      { input: 'driven', expectedLemma: 'drive' },
      { input: 'taken', expectedLemma: 'take' },

      // Irregular plurals
      { input: 'children', expectedLemma: 'child' },
      { input: 'men', expectedLemma: 'man' },
      { input: 'women', expectedLemma: 'woman' },
      { input: 'feet', expectedLemma: 'foot' },
      { input: 'teeth', expectedLemma: 'tooth' },
      { input: 'mice', expectedLemma: 'mouse' },

      // Plural nouns ending in -ies / -sses
      { input: 'companies', expectedLemma: 'company' },
      { input: 'businesses', expectedLemma: 'business' },

      // Non-e base verbs that must NEVER append an artificial 'e'
      { input: 'working', expectedLemma: 'work', forbiddenLemma: 'worke' },
      { input: 'reading', expectedLemma: 'read', forbiddenLemma: 'reade' },
      { input: 'meeting', expectedLemma: 'meet', context: 'She is meeting clients.', forbiddenLemma: 'meete' },
    ];

    for (const c of cases) {
      it(`resolves "${c.input}" -> "${c.expectedLemma}"`, () => {
        const res = analyzeMorphology(c.input, c.context);
        expect(res.selectedLemma.toLowerCase()).toBe(c.expectedLemma.toLowerCase());
        if (c.forbiddenLemma) {
          expect(res.selectedLemma.toLowerCase()).not.toBe(c.forbiddenLemma.toLowerCase());
          expect(res.lemmaCandidates.map((cand) => cand.lemma.toLowerCase())).not.toContain(c.forbiddenLemma.toLowerCase());
        }
      });
    }
  });

  describe('Phonotactic Resolvers', () => {
    it('resolveBaseVerbFromIng handles silent-e and avoids truncated stems', () => {
      expect(resolveBaseVerbFromIng('postponing')).toBe('postpone');
      expect(resolveBaseVerbFromIng('making')).toBe('make');
      expect(resolveBaseVerbFromIng('taking')).toBe('take');
      expect(resolveBaseVerbFromIng('using')).toBe('use');
      expect(resolveBaseVerbFromIng('writing')).toBe('write');
      expect(resolveBaseVerbFromIng('improving')).toBe('improve');
      expect(resolveBaseVerbFromIng('scheduling')).toBe('schedule');
      expect(resolveBaseVerbFromIng('managing')).toBe('manage');
      expect(resolveBaseVerbFromIng('producing')).toBe('produce');
    });

    it('resolveBaseVerbFromIng preserves consonant clusters and vowel digraphs without adding e', () => {
      expect(resolveBaseVerbFromIng('working')).toBe('work');
      expect(resolveBaseVerbFromIng('reading')).toBe('read');
      expect(resolveBaseVerbFromIng('sleeping')).toBe('sleep');
      expect(resolveBaseVerbFromIng('meeting')).toBe('meet');
      expect(resolveBaseVerbFromIng('asking')).toBe('ask');
      expect(resolveBaseVerbFromIng('helping')).toBe('help');
    });

    it('resolveBaseVerbFromEd handles regular and irregular -ed correctly', () => {
      expect(resolveBaseVerbFromEd('postponed')).toBe('postpone');
      expect(resolveBaseVerbFromEd('worked')).toBe('work');
      expect(resolveBaseVerbFromEd('studied')).toBe('study');
      expect(resolveBaseVerbFromEd('stopped')).toBe('stop');
      expect(resolveBaseVerbFromEd('planned')).toBe('plan');
      expect(resolveBaseVerbFromEd('used')).toBe('use');
      expect(resolveBaseVerbFromEd('improved')).toBe('improve');
    });
  });

  describe('Context-Aware Disambiguation', () => {
    it('disambiguates "better": adjective "good" vs health/feeling "well" vs verb "better"', () => {
      // Better results -> good
      const adjRes = analyzeMorphology('better', 'We achieved much better results this quarter.');
      expect(adjRes.selectedLemma).toBe('good');
      expect(adjRes.partOfSpeech).toContain('adjective');

      // Feel better -> well / good
      const healthRes = analyzeMorphology('better', 'I feel better after taking medicine.');
      expect(['well', 'good']).toContain(healthRes.selectedLemma);

      // Better your skills -> better (verb)
      const verbRes = analyzeMorphology('better', 'He enrolled to better his communication skills.');
      expect(verbRes.selectedLemma).toBe('better');
      expect(verbRes.partOfSpeech).toContain('verb');
    });

    it('disambiguates "best": adjective "good" vs noun "best" vs adverb "well"', () => {
      const adjRes = analyzeMorphology('best', 'This is the best option for our team.');
      expect(adjRes.selectedLemma).toBe('good');

      const nounRes = analyzeMorphology('best', 'She always tries to do her best.');
      expect(nounRes.selectedLemma).toBe('best');

      const advRes = analyzeMorphology('best', 'This method works best for beginners.');
      expect(advRes.selectedLemma).toBe('well');
    });

    it('disambiguates "saw": verb "see" vs noun "saw"', () => {
      const verbRes = analyzeMorphology('saw', 'I saw him yesterday at the office.');
      expect(verbRes.selectedLemma).toBe('see');

      const nounRes = analyzeMorphology('saw', 'The carpenter bought a new electric saw.');
      expect(nounRes.selectedLemma).toBe('saw');
    });

    it('disambiguates "working": verb "work" vs compound adjective "working"', () => {
      const verbRes = analyzeMorphology('working', 'She is working remotely today.');
      expect(verbRes.selectedLemma).toBe('work');

      const adjRes = analyzeMorphology('working', 'The company provides flexible working hours.');
      expect(adjRes.selectedLemma).toBe('working');
    });
  });

  describe('AI Morphology Validation & Guardrails', () => {
    it('validates a pristine AI morphology JSON object', () => {
      const validAiJson = {
        original: 'postponing',
        lemma: 'postpone',
        pos: 'verb',
        form: 'present_participle',
        is_inflected: true,
        confidence: 0.99,
        alternatives: [],
      };
      const result = validateAIMorphologyResult(validAiJson, 'postponing');
      expect(result).not.toBeNull();
      expect(result?.lemma).toBe('postpone');
      expect(result?.pos).toBe('verb');
      expect(result?.is_inflected).toBe(true);
    });

    it('intercepts and corrects suspicious truncated stem "postpon"', () => {
      const badStemJson = {
        original: 'postponing',
        lemma: 'postpon',
        pos: 'verb',
        form: 'present_participle',
      };
      const result = validateAIMorphologyResult(badStemJson, 'postponing');
      expect(result).not.toBeNull();
      expect(result?.lemma).toBe('postpone'); // Corrected by SUSPICIOUS_TRUNCATED_STEMS
    });

    it('rejects hallucinated or invalid characters in lemma', () => {
      const invalidJson = {
        original: 'postponing',
        lemma: 'postpone123!@#',
        pos: 'verb',
      };
      const result = validateAIMorphologyResult(invalidJson, 'postponing');
      expect(result).toBeNull();
    });

    it('handles code fences and malformed string input gracefully', () => {
      const codeFencedString = '```json\n{"original":"went","lemma":"go","pos":"verb","form":"past","is_inflected":true,"confidence":1.0}\n```';
      const result = validateAIMorphologyResult(codeFencedString, 'went');
      expect(result).not.toBeNull();
      expect(result?.lemma).toBe('go');
      expect(result?.pos).toBe('verb');
    });
  });

  describe('LRU Cache Behavior', () => {
    beforeEach(() => {
      clearMorphologyCache();
    });

    it('stores and retrieves cached morphology results with context separation', () => {
      const mockResult = {
        original_form: 'better',
        lemma: 'good',
        part_of_speech: 'adjective',
        is_inflected: true,
        confidence: 0.98,
        alternatives: [],
      };

      setCachedMorphology('better', 'better results', mockResult);

      const hit = getCachedMorphology('better', 'better results');
      expect(hit).toEqual({ ...mockResult, source: 'cache' });

      // Different context must NOT hit the same cache entry
      const miss = getCachedMorphology('better', 'feel better');
      expect(miss).toBeNull();
    });
  });
});
