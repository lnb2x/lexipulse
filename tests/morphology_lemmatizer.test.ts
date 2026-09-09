import { describe, it, expect } from 'vitest';
import { analyzeMorphology } from '../src/services/morphology/lemmatizer';

describe('Morphological Analysis & Lemmatizer', () => {
  it('identifies went -> go as past tense of go', () => {
    const res = analyzeMorphology('went');
    expect(res.selectedLemma).toBe('go');
    expect(res.originalInput).toBe('went');
    expect(res.lemmaCandidates.some((c) => c.lemma === 'go')).toBe(true);
    expect(res.partOfSpeech).toContain('verb');
  });

  it('identifies written -> write as past participle', () => {
    const res = analyzeMorphology('written');
    expect(res.selectedLemma).toBe('write');
    expect(res.originalInput).toBe('written');
    expect(res.formLabels.some((l) => l.includes('Quá khứ phân từ'))).toBe(true);
  });

  it('identifies working -> work as verb -ing form', () => {
    const res = analyzeMorphology('working');
    expect(res.selectedLemma).toBe('work');
    expect(res.lemmaCandidates.some((c) => c.lemma === 'work')).toBe(true);
  });

  it('disambiguates working in working hours vs she is working', () => {
    const nounAdjContext = analyzeMorphology('working', 'The company announced flexible working hours.');
    expect(nounAdjContext.selectedLemma).toBe('working');

    const verbContext = analyzeMorphology('working', 'She is working on an important project.');
    expect(verbContext.selectedLemma).toBe('work');
  });

  it('handles studies -> study with both verb and noun candidates', () => {
    const resNoContext = analyzeMorphology('studies');
    expect(resNoContext.selectedLemma).toBe('study');
    expect(resNoContext.lemmaCandidates.some((c) => c.lemma === 'study')).toBe(true);

    const verbContext = analyzeMorphology('studies', 'He studies late at night.');
    expect(verbContext.selectedLemma).toBe('study');
    expect(verbContext.lemmaCandidates[0].pos).toBe('verb');

    const nounContext = analyzeMorphology('studies', 'Recent clinical studies show positive results.');
    expect(nounContext.selectedLemma).toBe('study');
    expect(nounContext.lemmaCandidates[0].pos).toBe('noun');
  });

  it('keeps saw ambiguous (see vs saw) when lacking context, and disambiguates with context', () => {
    const ambiguous = analyzeMorphology('saw');
    expect(ambiguous.needsDisambiguation).toBe(true);
    const lemmas = ambiguous.lemmaCandidates.map((c) => c.lemma);
    expect(lemmas).toContain('see');
    expect(lemmas).toContain('saw');

    const seeContext = analyzeMorphology('saw', 'I saw him yesterday at the cinema.');
    expect(seeContext.selectedLemma).toBe('see');

    const sawContext = analyzeMorphology('saw', 'The carpenter cut the wood with a sharp saw.');
    expect(sawContext.selectedLemma).toBe('saw');
  });

  it('does not blindly convert better to good without considering pos and context', () => {
    const ambiguous = analyzeMorphology('better');
    expect(ambiguous.lemmaCandidates.some((c) => c.lemma === 'better')).toBe(true);
    expect(ambiguous.lemmaCandidates.some((c) => c.lemma === 'good')).toBe(true);

    const verbContext = analyzeMorphology('better', 'He took courses to better his communication skills.');
    expect(verbContext.selectedLemma).toBe('better');

    const adjContext = analyzeMorphology('better', 'This proposal is much better than the previous one.');
    expect(adjContext.selectedLemma).toBe('good');
  });

  it('distinguishes meeting as primary noun cuộc họp vs verb meet', () => {
    const nounContext = analyzeMorphology('meeting', 'We have an urgent budget meeting this morning.');
    expect(nounContext.selectedLemma).toBe('meeting');
    expect(nounContext.partOfSpeech).toContain('noun');

    const verbContext = analyzeMorphology('meeting', 'I am meeting my client for lunch.');
    expect(verbContext.selectedLemma).toBe('meet');
  });

  it('never strips -s mechanically from business, news, series, lens, physics', () => {
    for (const w of ['business', 'news', 'series', 'species', 'lens', 'physics']) {
      const res = analyzeMorphology(w);
      expect(res.selectedLemma).toBe(w);
      expect(res.lemmaCandidates[0].lemma).toBe(w);
    }
  });

  it('preserves particles in phrasal verbs: looked up -> look up, ran out of -> run out of', () => {
    const res1 = analyzeMorphology('looked up');
    expect(res1.selectedLemma).toBe('look up');

    const res2 = analyzeMorphology('ran out of');
    expect(res2.selectedLemma).toBe('run out of');
  });

  it('handles irregular plurals: children -> child, criteria -> criterion', () => {
    const res1 = analyzeMorphology('children');
    expect(res1.selectedLemma).toBe('child');

    const res2 = analyzeMorphology('criteria');
    expect(res2.selectedLemma).toBe('criterion');

    const res3 = analyzeMorphology('analyses');
    expect(res3.selectedLemma).toBe('analysis');
  });
});
