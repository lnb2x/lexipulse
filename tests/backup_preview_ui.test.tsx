// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ImportExportModal } from '../src/components/deck/ImportExportModal';
import { LanguageProvider } from '../src/context/LanguageContext';
import { db } from '../src/services/db/schema';
import { integrityWord } from './dataIntegrityFixture';

beforeEach(async () => {
  for (const table of db.tables) await table.clear();
  localStorage.setItem('lexipulse_ui_language', 'en');
  vi.stubGlobal('crypto', webcrypto);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('requires preview and recovery confirmation before restoring a file', async () => {
  await db.words.put(integrityWord());
  const onComplete = vi.fn();
  render(<LanguageProvider><ImportExportModal isOpen initialTab="import" onClose={() => {}} onImportComplete={onComplete} /></LanguageProvider>);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: JSON.stringify([integrityWord('new', 'beta')]) } });
  fireEvent.click(screen.getByRole('button', { name: 'Preview changes' }));
  const confirm = await screen.findByRole('button', { name: 'Confirm restore' });
  expect(confirm.hasAttribute('disabled')).toBe(true);
  expect(await db.words.count()).toBe(1);
  fireEvent.click(screen.getByRole('checkbox', { name: 'I saved the recovery backup' }));
  fireEvent.click(confirm);
  await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  expect(await db.words.count()).toBe(2);
});
