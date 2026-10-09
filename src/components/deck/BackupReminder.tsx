import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLanguage } from '../../context/LanguageContext';
import { db } from '../../services/db/schema';
import { exportFullBackupToJson } from '../../services/db/backup';
import { BACKUP_DOWNLOAD_KEY, markBackupDownloaded } from '../../services/studyProgress';
import { formatLocalDate } from '../../utils/dateUtils';

export function BackupReminder({ wordCount }: { wordCount: number }) {
  const { language } = useLanguage();
  const [now] = useState(Date.now);
  const row = useLiveQuery(() => db.settingsTable.get(BACKUP_DOWNLOAD_KEY), []);
  const lastDownload = typeof row?.value === 'number' && Number.isFinite(row.value) ? row.value : null;
  const overdue = !lastDownload || now - lastDownload >= 7 * 86400000;
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!wordCount) return null;
  const download = async () => {
    if (busy) return;
    setBusy(true); setFailed(false);
    let url: string | undefined;
    try {
      const json = await exportFullBackupToJson();
      url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url; link.download = `lexipulse_backup_${formatLocalDate()}.json`;
      link.click();
      await markBackupDownloaded();
    } catch { setFailed(true); }
    finally { if (url) URL.revokeObjectURL(url); setBusy(false); }
  };
  return <section className="card-elevated max-w-3xl mx-auto p-5 flex flex-wrap items-center justify-between gap-3">
    <div><h3 className="font-semibold">{language === 'vi' ? 'Sao lưu dữ liệu học' : 'Back up your learning'}</h3>
      <p className="text-sm text-slate-500">{lastDownload
        ? (language === 'vi' ? `Lần yêu cầu tải backup gần nhất: ${formatLocalDate(lastDownload)}.` : `Last backup download requested: ${formatLocalDate(lastDownload)}.`)
        : (language === 'vi' ? 'Bạn chưa tải bản sao lưu đầy đủ trên trình duyệt này.' : 'No full backup downloaded in this browser.')}
        {overdue && (language === 'vi' ? ' Nên lưu một bản mỗi tuần.' : ' Save a copy weekly.')}</p>
      {failed && <p role="alert" className="text-sm text-rose-600">{language === 'vi' ? 'Chưa tạo được backup. Hãy thử lại.' : 'Could not create a backup. Please try again.'}</p>}
    </div>
    <button type="button" className="btn-secondary" disabled={busy} onClick={download}>{language === 'vi' ? 'Tải backup đầy đủ' : 'Download full backup'}</button>
  </section>;
}
