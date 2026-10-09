import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLanguage } from '../../context/LanguageContext';
import { TOEIC_PART5, TOEIC_TOPICS, type ToeicTopic } from '../../data/toeicPart5';
import { db } from '../../services/db/schema';
import { getStudyAttempts, recordStudyAttempt, TOEIC_SESSION_KEY } from '../../services/studyProgress';
import { ArrowRight, ChevronRight, Clock3, GitBranch, Languages, ListFilter, Play, Type } from 'lucide-react';
import { GlassDropdown } from '../common/GlassDropdown';
import { ContentSurface, GlassButton, GlassIconButton } from '../common/Glass';

interface ToeicSession { id: string; questionIds: string[]; index: number; selected: number | null; wrongIds: string[] }
function validToeicSession(value: unknown): value is ToeicSession {
  if (!value || typeof value !== 'object') return false;
  const s = value as ToeicSession;
  return typeof s.id === 'string' && Array.isArray(s.questionIds) && s.questionIds.length > 0 &&
    s.questionIds.every(id => TOEIC_PART5.some(q => q.id === id)) && new Set(s.questionIds).size === s.questionIds.length &&
    Number.isInteger(s.index) && s.index >= 0 && s.index <= s.questionIds.length &&
    (s.selected === null || Number.isInteger(s.selected) && s.selected >= 0 && s.selected <= 3) &&
    Array.isArray(s.wrongIds) && s.wrongIds.every(id => s.questionIds.includes(id));
}

export function ToeicPractice() {
  const { language } = useLanguage();
  const [topic, setTopic] = useState<ToeicTopic | 'all'>('all');
  const [session, setSession] = useState<ToeicSession | null>(null);
  const [saved, setSaved] = useState<ToeicSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const lock = useRef(false);
  const attempts = useLiveQuery(getStudyAttempts, []) ?? [];
  useEffect(() => {
    let active = true;
    db.settingsTable.get(TOEIC_SESSION_KEY).then(row => {
      if (active && validToeicSession(row?.value)) setSaved(row.value);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);
  const store = async (next: ToeicSession) => {
    await db.settingsTable.put({ key: TOEIC_SESSION_KEY, value: next });
    setSession(next); setSaved(next);
  };
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setFailed(false);
    try { await action(); } catch { setFailed(true); }
    finally { lock.current = false; setBusy(false); }
  };
  const start = (ids: string[]) => run(() => store({ id: crypto.randomUUID(), questionIds: ids, index: 0, selected: null, wrongIds: [] }));
  const current = session && TOEIC_PART5.find(q => q.id === session.questionIds[session.index]);
  const select = (selected: number) => run(async () => {
    if (!session || !current || session.selected !== null) return;
    const correct = selected === current.correctIndex;
    const next = { ...session, selected, wrongIds: correct ? session.wrongIds : [...session.wrongIds, current.id] };
    await db.transaction('rw', db.settingsTable, async () => {
      await recordStudyAttempt({ id: `${session.id}:${current.id}`, date: Date.now(), mode: 'toeic',
        rating: correct ? 3 : 1, sessionType: 'cram', questionId: current.id, topic: current.topic,
        firstAttemptCorrect: correct, incorrectSubmissionCount: correct ? 0 : 1 });
      await db.settingsTable.put({ key: TOEIC_SESSION_KEY, value: next });
    });
    setSession(next); setSaved(next);
  });
  const topicIcons = { 'word-form': Type, tense: Clock3, preposition: Languages, conjunction: GitBranch };
  return <ContentSurface className="toeic-workspace space-y-5">
    <div className="toeic-heading"><div><h2>TOEIC Part 5</h2>
      <p>{language === 'vi' ? '16 câu tự biên soạn theo bốn chủ đề. Chọn đáp án rồi đọc lý do cho từng lựa chọn.' : '16 original questions across four topics. Choose an answer, then read the explanation for each option.'}</p></div>
      {!session && saved && saved.index < saved.questionIds.length && <GlassButton prominent onClick={() => setSession(saved)}><Play size={16} />{language === 'vi' ? 'Tiếp tục Part 5' : 'Continue Part 5'}</GlassButton>}
    </div>
    {failed && <p role="alert" className="text-sm text-rose-600">{language === 'vi' ? 'Chưa lưu được kết quả. Hãy thử lại.' : 'Could not save your progress. Please try again.'}</p>}
    {!session ? <>
      <div className="toeic-start-controls">
        <div className="toeic-topic-selector"><span>{language === 'vi' ? 'Chủ đề' : 'Topic'}</span>
          <GlassDropdown label={language === 'vi' ? 'Chủ đề' : 'Topic'} value={topic} onChange={value => setTopic(value as ToeicTopic | 'all')}
            icon={<ListFilter size={16} />} options={[{ value: 'all', label: language === 'vi' ? 'Tất cả chủ đề' : 'All topics' }, ...Object.entries(TOEIC_TOPICS).map(([id, label]) => ({ value: id, label: label[language] }))]} />
        </div>
        <GlassButton prominent busy={busy} disabled={busy} onClick={() => start(TOEIC_PART5.filter(q => topic === 'all' || q.topic === topic).map(q => q.id))}>
          <Play size={16} />{language === 'vi' ? 'Bắt đầu Part 5' : 'Start Part 5'}<ArrowRight size={16} />
        </GlassButton>
      </div>
      <div className="toeic-topic-list">{Object.entries(TOEIC_TOPICS).map(([id, label]) => {
        const rows = attempts.filter(a => a.mode === 'toeic' && a.topic === id);
        const rate = rows.length ? Math.round(rows.filter(a => a.firstAttemptCorrect).length / rows.length * 100) : 0;
        const questions = TOEIC_PART5.filter(q => q.topic === id);
        const Icon = topicIcons[id as ToeicTopic];
        const wrongIds = [...new Set(rows.filter(a => a.rating === 1).map(a => a.questionId!))].filter(qid => TOEIC_PART5.some(q => q.id === qid));
        return <div key={id} className="toeic-topic-row">
          <div className="toeic-topic-symbol"><Icon size={20} strokeWidth={1.7} /></div>
          <div className="toeic-topic-copy"><strong>{label[language]}</strong>
            <span>{rows.length ? `${rate}% · ${rows.length} ${language === 'vi' ? 'lượt trả lời' : 'attempts'}` : language === 'vi' ? `Chưa luyện · ${questions.length} câu` : `No attempts · ${questions.length} questions`}</span>
            {rows.length > 0 && <div className="study-progress-track" role="progressbar" aria-label={label[language]} aria-valuemin={0} aria-valuemax={100} aria-valuenow={rate}><div style={{ width: `${rate}%` }} /></div>}
          </div>
          {wrongIds.length > 0 && <button type="button" className="btn-secondary" disabled={busy} onClick={() => start(wrongIds)}>{language === 'vi' ? `Luyện lại ${wrongIds.length} câu từng sai` : `Retry ${wrongIds.length} missed questions`}</button>}
          <GlassIconButton className="toeic-topic-action" disabled={busy} onClick={() => start(questions.map(q => q.id))} aria-label={`${language === 'vi' ? 'Luyện' : 'Practice'} ${label[language]}`}><ChevronRight size={18} /></GlassIconButton>
        </div>;
      })}</div>
    </> : current ? <>
      <div className="flex justify-between gap-3 text-sm"><span>{language === 'vi' ? 'Câu' : 'Question'} {session.index + 1}/{session.questionIds.length} · {TOEIC_TOPICS[current.topic][language]}</span>
        <button type="button" className="text-indigo-600 dark:text-indigo-400 underline" disabled={busy} onClick={() => setSession(null)}>{language === 'vi' ? 'Tạm dừng' : 'Pause'}</button></div>
      <p className="toeic-question">{current.sentence}</p>
      <div className="toeic-options grid sm:grid-cols-2 gap-3">{current.options.map((option, index) => <button type="button" key={index} disabled={busy || session.selected !== null} onClick={() => select(index)}
        className={`btn-secondary text-left ${session.selected !== null && index === current.correctIndex ? 'ring-2 ring-emerald-500' : session.selected === index ? 'ring-2 ring-rose-500' : ''}`}>
        {String.fromCharCode(65 + index)}. {option}
      </button>)}</div>
      {session.selected !== null && <div className="toeic-explanation space-y-3" aria-live="polite">
        <p className="font-semibold">{session.selected === current.correctIndex ? (language === 'vi' ? 'Chính xác!' : 'Correct!') : (language === 'vi' ? 'Chưa đúng.' : 'Incorrect.')}{' '}
          {language === 'vi' ? 'Đáp án' : 'Answer'}: {String.fromCharCode(65 + current.correctIndex)}. {current.options[current.correctIndex]}</p>
        <ol className="space-y-2 text-sm">{current.options.map((option, index) => <li key={index}><strong>{String.fromCharCode(65 + index)}. {option}: </strong>{language === 'vi' ? current.explanationsVi[index] : current.explanationsEn[index]}</li>)}</ol>
        <button type="button" className="btn-primary" disabled={busy} onClick={() => run(() => store({ ...session, index: session.index + 1, selected: null }))}>{language === 'vi' ? 'Câu tiếp theo' : 'Next question'}</button>
      </div>}
    </> : <div className="space-y-4">
      <p className="text-lg font-semibold">{language === 'vi' ? 'Hoàn thành!' : 'Completed!'} {session.questionIds.length - session.wrongIds.length}/{session.questionIds.length} {language === 'vi' ? 'câu đúng.' : 'correct.'}</p>
      {session.wrongIds.length > 0 && <button type="button" className="btn-primary" disabled={busy} onClick={() => start(session.wrongIds)}>{language === 'vi' ? 'Luyện lại câu sai' : 'Retry missed questions'}</button>}
      <button type="button" className="btn-secondary ml-3" onClick={() => setSession(null)}>{language === 'vi' ? 'Chọn chủ đề khác' : 'Choose another topic'}</button>
    </div>}
  </ContentSurface>;
}
