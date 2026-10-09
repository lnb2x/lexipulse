import { ChevronDown, Database, Download, FileSpreadsheet, Plus, Sparkles, Upload } from 'lucide-react';
import { useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';

interface DeckActionsProps {
  onOpenImportExport: (tab?: 'bulk' | 'quizlet' | 'export' | 'import') => void;
  onAddNewWord?: () => void;
  onQuickExportCsv?: () => void;
  onQuickExportXlsx?: () => void;
  onOpenTranslationAudit?: () => void;
}

export function DeckActions({ onOpenImportExport, onAddNewWord, onQuickExportCsv, onQuickExportXlsx, onOpenTranslationAudit }: DeckActionsProps) {
  const { language, t } = useLanguage();
  const menuRef = useRef<HTMLDetailsElement>(null);
  const run = (action: () => void) => {
    if (menuRef.current) menuRef.current.open = false;
    action();
  };
  return <div className="deck-actions">
    <details ref={menuRef} className="deck-actions-menu"
      onKeyDown={event => {
        if (event.key === 'Escape' && menuRef.current) {
          menuRef.current.open = false;
          menuRef.current.querySelector('summary')?.focus();
        }
      }}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
      }}>
      <summary className="btn-secondary"><Upload size={16} />{language === 'vi' ? 'Nhập / Xuất' : 'Import / Export'}<ChevronDown size={14} /></summary>
      <div className="deck-actions-popover">
        <button type="button" onClick={() => run(() => onOpenImportExport('bulk'))}><Plus size={16} />{t.deck.bulkAddBtn}</button>
        <button type="button" onClick={() => run(() => onOpenImportExport('quizlet'))}><Database size={16} />{t.deck.quizletBtn}</button>
        <button type="button" onClick={() => run(() => onOpenImportExport('import'))}><Upload size={16} />{language === 'vi' ? 'Khôi phục bản sao lưu' : 'Restore backup'}</button>
        <div className="deck-menu-divider" />
        {onQuickExportXlsx && <button type="button" onClick={() => run(onQuickExportXlsx)}><FileSpreadsheet size={16} />{language === 'vi' ? 'Xuất Excel' : 'Export Excel'}</button>}
        {onQuickExportCsv && <button type="button" onClick={() => run(onQuickExportCsv)}><Download size={16} />{language === 'vi' ? 'Xuất CSV' : 'Export CSV'}</button>}
        <button type="button" onClick={() => run(() => onOpenImportExport('export'))}><Download size={16} />{t.deck.exportBackupBtn}</button>
        {onOpenTranslationAudit && <><div className="deck-menu-divider" /><button type="button" onClick={() => run(onOpenTranslationAudit)}><Sparkles size={16} />{language === 'vi' ? 'Kiểm tra & chỉnh nghĩa' : 'Check & improve definitions'}</button></>}
      </div>
    </details>
    {onAddNewWord && <button type="button" onClick={onAddNewWord} className="btn-primary"><Plus size={17} />{language === 'vi' ? 'Thêm từ mới' : 'Add word'}</button>}
  </div>;
}
