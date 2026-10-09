// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { WordCard } from '../src/components/lookup/WordCard';
import { LanguageProvider } from '../src/context/LanguageContext';
import type { WordItem } from '../src/types/vocab';
import { createInitialReviewMeta } from '../src/services/sm2';
import { verbosePromiseDefinition } from './definitionClarityFixture';

vi.mock('../src/components/common/AudioButton', () => ({ AudioButton: () => null }));

const word: WordItem = {
  id: 'clarity-as-soon-as', word: 'as soon as', pos: ['conjunction'], phonetics: {},
  vietnameseDefinition: 'ngay khi; vừa… thì…', englishDefinition: 'immediately after something happens',
  usageNoteVi: 'Nối hai mệnh đề, diễn tả việc thứ hai xảy ra ngay sau việc thứ nhất.',
  meanings: [], collocations: [], wordFamily: [],
  examples: [{ en: 'I will call you as soon as I arrive.', vi: 'Tôi sẽ gọi bạn ngay khi tôi đến.', context: 'general' }],
  tags: [], status: 'new', createdAt: 1000, updatedAt: 1000, reviewMeta: createInitialReviewMeta(),
  vietnameseDefinitionProvenance: { source: 'ai', provider: 'groq' },
};

beforeEach(() => localStorage.setItem('lexipulse_ui_language', 'vi'));
afterEach(() => { cleanup(); localStorage.clear(); });

function showWord(value: WordItem = word) {
  return render(<LanguageProvider><WordCard word={value} onSaveToDeck={vi.fn()} isAlreadyInDeck={false} /></LanguageProvider>);
}

it('separates concise Vietnamese senses, usage guidance and the bilingual example', () => {
  const { container } = showWord();
  expect(Array.from(container.querySelectorAll('.dictionary-meaning-text')).map(element => element.textContent))
    .toEqual(['ngay khi', 'vừa… thì…']);
  const usage = screen.getByRole('heading', { name: 'Cách dùng' }).parentElement;
  expect(usage?.textContent).toContain(word.usageNoteVi);
  expect(usage?.querySelector('.dictionary-meaning-text')).toBeNull();
  const meaningCard = container.querySelector('.dictionary-definition');
  expect(meaningCard?.textContent).not.toContain(word.examples[0].en);
  const example = container.querySelector('.dictionary-example');
  expect(example?.textContent).toContain(word.examples[0].en);
  expect(example?.textContent).toContain(word.examples[0].vi);
});

it('cleans legacy definitions of different words without mixing examples into the main meaning', () => {
  const { container } = showWord({ ...word, word: 'promise', vietnameseDefinition: verbosePromiseDefinition });
  const definition = container.querySelector('.dictionary-definition');
  expect(definition?.textContent).toContain('lời hứa, sự hứa hẹn');
  expect(definition?.textContent).toContain('tiềm năng, triển vọng');
  expect(definition?.textContent).not.toContain('ví dụ:');
  expect(container.querySelector('.dictionary-example')?.textContent).toContain(word.examples[0].en);
});

it.each([undefined, '   '])('keeps older lookup cards without usage guidance readable (%s)', (usageNoteVi) => {
  const { container } = showWord({ ...word, usageNoteVi });
  expect(screen.queryByRole('heading', { name: 'Cách dùng' })).toBeNull();
  expect(container.querySelectorAll('.dictionary-meaning-text')).toHaveLength(2);
});

it('labels the separate guidance in English when English UI is selected', () => {
  localStorage.setItem('lexipulse_ui_language', 'en');
  showWord();
  expect(screen.getByRole('heading', { name: 'Usage' }).parentElement?.textContent).toContain(word.usageNoteVi);
});
