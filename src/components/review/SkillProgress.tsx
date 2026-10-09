import { useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { skillSummary } from '../../services/studyProgress';
import { selectDifficultPracticeWords } from '../../services/practiceSelection';
import type { StudyAttempt } from '../../types/study';
import type { ReviewMode, WordItem } from '../../types/vocab';
import { GlassButton } from '../common/Glass';

interface SkillProgressProps {
  allWords: WordItem[];
  attempts: StudyAttempt[];
  onStartSession: (mode: ReviewMode, cards: WordItem[], sessionType: 'cram') => void;
}

export function SkillProgress({ allWords, attempts, onStartSession }: SkillProgressProps) {
  const { language } = useLanguage();
  const rows = useMemo(() => skillSummary(attempts).map(row => ({ ...row,
    practiceWords: row.mode === 'toeic' ? [] : selectDifficultPracticeWords(allWords, attempts, row.mode),
  })), [allWords, attempts]);
  const listening = rows.find(row => row.mode === 'listen');
  const names = language === 'vi'
    ? { learn: 'Học thông minh', flashcards: 'Tự nhớ từ', listen: 'Nghe và chính tả', choice: 'Nhận diện nghĩa', cloze: 'Điền từ', match: 'Nối từ', toeic: 'TOEIC Part 5' }
    : { learn: 'Learn', flashcards: 'Recall', listen: 'Listening and spelling', choice: 'Meaning recognition', cloze: 'Cloze', match: 'Matching', toeic: 'TOEIC Part 5' };
  return <section className="study-panel skill-progress-panel" aria-label={language === 'vi' ? 'Tiến độ theo kỹ năng' : 'Skill progress'}>
    <h3>{language === 'vi' ? 'Bạn cần luyện gì?' : 'What needs practice?'}</h3>
    {!rows.length ? <p className="study-caption skill-empty">{language === 'vi' ? 'Hoàn thành một lượt học để xem điểm yếu theo kỹ năng.' : 'Complete a session to see your skills.'}</p> : <>
      <p className="study-caption">{language === 'vi' ? 'Tỷ lệ đúng ngay, tự làm' : 'First try, unassisted accuracy'}</p>
      <ul className="skill-progress-list">{rows.map(row => <li key={row.mode}>
        <div><strong>{names[row.mode]}</strong><span>{row.firstTryRate === null ? '—' : `${Math.round(row.firstTryRate * 100)}%`}</span></div>
        {row.firstTryRate !== null && <div className="study-progress-track"><div style={{ width: `${row.firstTryRate * 100}%` }} /></div>}
        <p>{row.count} {language === 'vi' ? 'lượt' : 'attempts'} · {row.difficult} {language === 'vi' ? 'lượt khó' : 'difficult'}{row.firstTryRate !== null && ` · N=${row.firstTryCount}`}</p>
        {row.mode !== 'toeic' && row.practiceWords.length > 0 && <GlassButton
          className="skill-practice-button"
          aria-label={language === 'vi' ? `Luyện ${row.practiceWords.length} từ cần củng cố · ${names[row.mode]}` : `Practice ${row.practiceWords.length} difficult words · ${names[row.mode]}`}
          onClick={() => { if (row.mode !== 'toeic') onStartSession(row.mode, row.practiceWords, 'cram'); }}
        >{language === 'vi' ? `Luyện ${row.practiceWords.length} từ cần củng cố` : `Practice ${row.practiceWords.length} difficult words`}</GlassButton>}
      </li>)}</ul>
      {listening && <p className="study-caption">{language === 'vi' ? `Nghe chép: ${listening.corrections} lần nhập sai, ${listening.hints} lần dùng gợi ý. Nghe lại không làm giảm điểm.` : `Dictation: ${listening.corrections} incorrect checks, ${listening.hints} hints. Replays do not reduce your score.`}</p>}
    </>}
    <p className="study-caption skill-footnote">{language === 'vi' ? 'Thống kê từ các lượt mới, gồm ôn đến hạn và luyện thêm. Nút luyện chọn tối đa 10 từ còn gặp khó ở kỹ năng này, không đổi lịch ôn. Tự đánh giá flashcard không có tỷ lệ đúng lần đầu.' : 'New attempts, including scheduled reviews and practice. Practice selects up to 10 words still difficult in this skill and keeps your review schedule. Self-rated flashcards have no first-try accuracy.'}</p>
  </section>;
}
