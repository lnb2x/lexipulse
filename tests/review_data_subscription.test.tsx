// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { useSpacedRepetition } from '../src/hooks/useSpacedRepetition';
import { db, SEED_WORDS } from '../src/services/db';
import type { WordItem } from '../src/types/vocab';

beforeEach(async () => {
  await db.words.clear();
  await db.words.put({ ...SEED_WORDS[0], id: 'due-test', reviewMeta: { ...SEED_WORDS[0].reviewMeta, dueDate: 0 } });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Review data subscription', () => {
  it('uses the supplied deck without reading the whole database again, including an empty deck', async () => {
    const read = vi.spyOn(db.words, 'toArray');
    const cards = [{ ...SEED_WORDS[0], reviewMeta: { ...SEED_WORDS[0].reviewMeta, dueDate: 0 } }];
    const { result, rerender } = renderHook(({ words }: { words: WordItem[] }) => useSpacedRepetition(words), {
      initialProps: { words: cards },
    });
    await waitFor(() => expect(result.current.settings).not.toBeNull());
    expect(result.current.dueCards).toEqual(cards);
    expect(read).not.toHaveBeenCalled();
    rerender({ words: [] });
    expect(result.current.dueCards).toEqual([]);
    expect(read).not.toHaveBeenCalled();
  });

  it('subscribes to database updates when no deck is supplied', async () => {
    const { result } = renderHook(() => useSpacedRepetition());
    await waitFor(() => expect(result.current.dueCards.map((word) => word.id)).toEqual(['due-test']));
    await db.words.clear();
    await waitFor(() => expect(result.current.dueCards).toEqual([]));
  });

  it('can switch between supplied cards and the database subscription', async () => {
    const { result, rerender } = renderHook(({ words }: { words: WordItem[] | undefined }) => useSpacedRepetition(words), {
      initialProps: { words: [] as WordItem[] | undefined },
    });
    await waitFor(() => expect(result.current.settings).not.toBeNull());
    expect(result.current.dueCards).toEqual([]);
    rerender({ words: undefined });
    await waitFor(() => expect(result.current.dueCards.map((word) => word.id)).toEqual(['due-test']));
    rerender({ words: [] });
    expect(result.current.dueCards).toEqual([]);
  });
});
