import { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { importDeckFromJson, type ImportDeckResult } from '../../services/vocabRepository';
import { BACKUP_TABLES, type BackupTableName } from '../../services/db/backupPlan';

export function BackupRestorePanel({ onComplete }: { onComplete: () => void }) {
  const { t } = useLanguage();
  const labels = t.backup;
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [tables, setTables] = useState<BackupTableName[]>([...BACKUP_TABLES]);
  const [result, setResult] = useState<ImportDeckResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const invalidate = () => { setResult(null); setSaved(false); setFailed(false); };
  const editText = (value: string) => { setText(value); invalidate(); };
  const toggle = (names: BackupTableName[]) => {
    setTables(previous => names.every(name => previous.includes(name))
      ? previous.filter(name => !names.includes(name)) : [...new Set([...previous, ...names])]);
    invalidate();
  };
  const run = async (previewOnly: boolean) => {
    setBusy(true); setFailed(false);
    try {
      const next = await importDeckFromJson(text, { mode, tables, previewOnly,
        recoveryBackup: previewOnly ? undefined : result?.preview?.recoveryBackup });
      setResult(next); setSaved(false);
      if (!previewOnly && next.errors.length === 0) onComplete();
    } catch { setFailed(true); }
    finally { setBusy(false); }
  };
  const download = () => {
    if (!result?.preview) return;
    const url = URL.createObjectURL(new Blob([result.preview.recoveryBackup], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'lexipulse-before-restore.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const errorText = (message: string) => {
    if (message.includes('stale')) return labels.stale;
    if (message.includes('checksum')) return labels.checksum;
    if (message.includes('replace_rejected')) return labels.damagedReplace;
    if (message.includes('replace_requires')) return labels.v2Required;
    if (/quota|storage left/i.test(message)) return labels.quota;
    const field = message.match(/^((?:words|quizletSets|dailyStats|settingsTable)\[\d+\]|settings):/);
    return field ? `${labels.invalidRecord}: ${field[1]}` : labels.failed;
  };
  return <fieldset disabled={busy} className="mt-5 space-y-4 text-sm text-slate-700 dark:text-slate-200">
    <legend className="sr-only">{labels.title}</legend>
    <p>{labels.description}</p>
    <label className="block">{t.modals.selectJsonFile}
      <input type="file" accept=".json,application/json" className="block w-full" onChange={async event => {
        const file = event.target.files?.[0];
        if (file) { try { editText(await file.text()); } catch { setFailed(true); } }
      }} />
    </label>
    <label className="block">{t.modals.pasteJsonLabel}
      <textarea rows={4} value={text} onChange={event => editText(event.target.value)}
        className="block w-full rounded border p-2 font-mono text-xs bg-white dark:bg-slate-900" />
    </label>
    <label className="block">{labels.mode}
      <select value={mode} onChange={event => { setMode(event.target.value as 'merge' | 'replace'); invalidate(); }}
        className="ml-2 rounded border p-1 bg-white dark:bg-slate-900">
        <option value="merge">{labels.merge}</option><option value="replace">{labels.replace}</option>
      </select>
    </label>
    {mode === 'replace' && <p className="font-semibold">{labels.replaceWarning}</p>}
    <div className="space-y-2">
      <label className="block"><input type="checkbox" checked={tables.includes('words')} onChange={() => toggle(['words', 'quizletSets'])} /> {labels.wordsAndSets}</label>
      <label className="block"><input type="checkbox" checked={tables.includes('dailyStats')} onChange={() => toggle(['dailyStats'])} /> {labels.dailyStats}</label>
      <label className="block"><input type="checkbox" checked={tables.includes('settingsTable')} onChange={() => toggle(['settingsTable'])} /> {labels.settingsTable}</label>
    </div>
    {tables.includes('settingsTable') && <p>{labels.keysWarning}</p>}
    <button type="button" disabled={!text.trim() || !tables.length} onClick={() => void run(true)}
      className="rounded bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">{busy ? labels.working : labels.preview}</button>
    {result?.preview && <section aria-label={labels.diff} className="space-y-3">
      <div className="overflow-x-auto"><table className="w-full text-xs text-left">
        <caption className="text-left font-semibold">{labels.diff}</caption>
        <thead><tr>{[labels.table, labels.current, labels.incoming, labels.added, labels.matched, labels.removed].map(label => <th key={label} scope="col" className="p-1">{label}</th>)}</tr></thead>
        <tbody>{tables.map(name => { const counts = result.preview!.tables[name]; return <tr key={name}>
          <th scope="row" className="p-1">{labels[name]}</th>
          {[counts.current, counts.incoming, counts.added, counts.matched, counts.removed].map((count, index) => <td key={index} className="p-1">{count}</td>)}
        </tr>; })}</tbody>
      </table></div>
      <p>{labels.matchedHint}</p>
      <button type="button" onClick={download} className="rounded border px-3 py-2">{labels.downloadRecovery}</button>
      <label className="block"><input type="checkbox" checked={saved} onChange={event => setSaved(event.target.checked)} /> {labels.savedRecovery}</label>
      <button type="button" disabled={!saved || (mode === 'replace' && result.errors.length > 0)} onClick={() => void run(false)}
        className="rounded bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">{labels.confirm}</button>
    </section>}
    <div role="status" aria-live="polite">
      {failed && <p>{labels.failed}</p>}
      {result && <p>{labels.imported}: {result.imported}; {labels.skipped}: {result.skipped}</p>}
      {!!result?.errors.length && <ul>{result.errors.map((error, index) => <li key={index}>{errorText(error)}</li>)}</ul>}
    </div>
  </fieldset>;
}
