import { ArrowRight, CheckCircle2, Lightbulb, Sparkles, XCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { ContentSurface, GlassButton } from '../common/Glass';
import { getLearnMeaning } from '../../services/adaptiveLearning';
import type { AttemptEvidence } from '../../types/study';
import type { ReviewRating, WordItem } from '../../types/vocab';

interface LearnSessionProps {
  question: { word: WordItem; type: 'choice' | 'write'; key: string };
  progress: { mastered: number; deferred: number; total: number; answered: number };
  allWords: WordItem[];
  isSubmitting: boolean;
  onAnswer: (rating: ReviewRating, evidence?: AttemptEvidence) => void | Promise<void>;
}

function meaningOf(word: WordItem) {
  return getLearnMeaning(word);
}

function normalizeLearnAnswer(value: string) {
  return value.normalize('NFKC').trim().toLocaleLowerCase('en').replace(/[’‘]/g, "'").replace(/\s+/g, ' ');
}

// Stable choices do not jump when a database update causes the parent to render.
function shuffledChoices(word: WordItem, allWords: WordItem[], questionKey: string) {
  const correct = meaningOf(word);
  const seen = new Set([normalizeLearnAnswer(correct)]);
  const distractors: string[] = [];
  for (const other of allWords) {
    const meaning = meaningOf(other);
    if (!meaning) continue;
    const normalized = normalizeLearnAnswer(meaning);
    if (other.id !== word.id && normalizeLearnAnswer(other.word) !== normalizeLearnAnswer(word.word) && !seen.has(normalized)) {
      seen.add(normalized);
      distractors.push(meaning);
    }
  }
  let seed = Array.from(questionKey).reduce((n, char) => (Math.imul(n, 31) + char.charCodeAt(0)) >>> 0, 7);
  const shuffle = (values: string[]) => {
    for (let index = values.length - 1; index > 0; index--) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const target = seed % (index + 1);
      [values[index], values[target]] = [values[target], values[index]];
    }
    return values;
  };
  return shuffle([correct, ...shuffle(distractors).slice(0, 3)]);
}

export function LearnSession({ question, progress, allWords, isSubmitting, onAnswer }: LearnSessionProps) {
  const { language } = useLanguage();
  const vi = language === 'vi';
  const { word, type } = question;
  const meaning = meaningOf(word);
  const [answer, setAnswer] = useState('');
  const [hints, setHints] = useState(0);
  const [feedback, setFeedback] = useState<{ correct: boolean; selected?: string; revealed: boolean } | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const advancingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const options = useMemo(() => shuffledChoices(word, allWords, question.key), [word, allWords, question.key]);
  const busy = isSubmitting || advancing;
  const settled = progress.mastered + progress.deferred;
  const percent = progress.total ? Math.round(settled / progress.total * 100) : 0;

  useEffect(() => { if (type === 'write') inputRef.current?.focus(); }, [type]);
  useEffect(() => { if (feedback) continueRef.current?.focus(); }, [feedback]);

  const checkAnswer = useCallback((value: string) => {
    if (busy || feedback) return;
    const target = type === 'choice' ? meaningOf(word) : word.word;
    setFeedback({ correct: normalizeLearnAnswer(value) === normalizeLearnAnswer(target), selected: value, revealed: false });
  }, [busy, feedback, type, word]);

  const advance = useCallback(async (deferred = false) => {
    if (!feedback || busy || advancingRef.current) return;
    advancingRef.current = true;
    setAdvancing(true);
    try {
      await onAnswer(deferred || !feedback.correct ? 1 : hints ? 2 : 3, {
        questionType: type,
        firstAttemptCorrect: feedback.correct && !feedback.revealed,
        incorrectSubmissionCount: feedback.correct ? 0 : 1,
        hintsUsedCount: hints,
        revealedAnswer: feedback.revealed,
        deferred,
      });
    } finally {
      advancingRef.current = false;
      setAdvancing(false);
    }
  }, [feedback, busy, onAnswer, hints, type]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey || busy) return;
      const element = event.target as HTMLElement | null;
      if (element?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element?.tagName ?? '')) return;
      if (type === 'choice' && !feedback && /^[1-4]$/.test(event.key)) {
        const option = options[Number(event.key) - 1];
        if (option) { event.preventDefault(); checkAnswer(option); }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [busy, type, feedback, options, checkAnswer]);

  return <section className="learn-session" aria-label={vi ? 'Học thông minh' : 'Learn'}>
    <div className="learn-session-meta">
      <div><Sparkles size={19} aria-hidden="true" /><h1>{vi ? 'Học thông minh' : 'Learn'}</h1></div>
      <span>{vi ? `Câu ${progress.answered + 1}` : `Question ${progress.answered + 1}`}</span>
    </div>
    <div className="learn-progress">
      <div><strong>{vi ? `${progress.mastered}/${progress.total} từ đã tự nhớ` : `${progress.mastered}/${progress.total} words recalled`}</strong><span>{progress.deferred > 0 ? (vi ? `${progress.deferred} từ để ôn sau` : `${progress.deferred} for later`) : (vi ? 'Nhận diện → Tự nhớ' : 'Recognize → Recall')}</span></div>
      <div className="study-progress-track" role="progressbar" aria-label={vi ? 'Tiến độ lượt học' : 'Session progress'} aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={settled}><div style={{ width: `${percent}%` }} /></div>
    </div>
    <ContentSurface className="learn-question-card">
      <div className="learn-question-header"><span className="learn-question-label">{type === 'choice' ? (vi ? 'Chọn nghĩa đúng' : 'Choose the meaning') : (vi ? 'Viết từ tiếng Anh' : 'Write the English term')}</span><span>{type === 'choice' ? (vi ? 'Nhận diện' : 'Recognition') : (vi ? 'Tự nhớ' : 'Recall')}</span></div>
      <div className="learn-prompt"><h2 className="learn-question-word">{type === 'choice' ? word.word : meaning || (vi ? 'Từ này chưa có nghĩa' : 'This term has no definition')}</h2>{type === 'choice' && word.phonetics.us && <p>{word.phonetics.us}</p>}</div>
      {type === 'choice' ? <div className="learn-answer-options" role="group" aria-label={vi ? 'Các đáp án' : 'Answers'}>
        {options.map((option, index) => <GlassButton key={option} className="learn-answer-option" disabled={!!feedback || busy}
          data-state={feedback ? (option === meaningOf(word) ? 'correct' : feedback.selected === option ? 'incorrect' : undefined) : undefined}
          onClick={() => checkAnswer(option)}><span className="learn-option-number" aria-hidden="true">{index + 1}</span><span>{option}</span>{feedback && option === meaningOf(word) && <CheckCircle2 size={19} aria-hidden="true" />}</GlassButton>)}
      </div> : <form className="learn-write-form" onSubmit={event => { event.preventDefault(); if (answer.trim()) checkAnswer(answer); }}>
        <label htmlFor="learn-answer">{vi ? 'Câu trả lời' : 'Your answer'}</label>
        <input ref={inputRef} id="learn-answer" type="text" autoComplete="off" autoCapitalize="none" spellCheck={false} value={answer} disabled={!!feedback || busy || !meaning} placeholder={vi ? 'Nhập từ tiếng Anh' : 'Type the English term'} onChange={event => setAnswer(event.target.value)} />
        {!feedback && <div className="learn-write-actions"><GlassButton prominent type="submit" className="learn-primary-button" disabled={!answer.trim() || busy || !meaning}>{vi ? 'Kiểm tra' : 'Check answer'}</GlassButton><GlassButton className="learn-secondary-button" disabled={busy || !meaning} onClick={() => { setHints(value => value + 1); inputRef.current?.focus(); }}><Lightbulb size={16} aria-hidden="true" />{vi ? 'Gợi ý' : 'Hint'}</GlassButton></div>}
        {hints > 0 && <p className="learn-hint">{vi ? 'Bắt đầu bằng: ' : 'Starts with: '}<strong>{Array.from(word.word).slice(0, Math.min(hints, Math.max(1, Array.from(word.word).length - 1))).join('')}…</strong></p>}
      </form>}
      {feedback ? <div className="learn-feedback" data-state={feedback.correct ? 'correct' : 'incorrect'} role="status">
        <div>{feedback.correct ? <CheckCircle2 size={22} aria-hidden="true" /> : <XCircle size={22} aria-hidden="true" />}<h3>{feedback.correct ? (vi ? 'Chính xác!' : 'Correct!') : (vi ? 'Cùng nhớ lại từ này' : 'Let’s revisit this word')}</h3></div>
        {!feedback.correct && <p>{vi ? 'Đáp án: ' : 'Answer: '}<strong>{type === 'choice' ? meaningOf(word) : word.word}</strong></p>}
        <p>{!feedback.correct || hints > 0 ? (vi ? 'Bạn sẽ gặp lại từ này sau vài câu để thử tự nhớ.' : 'This word will return after a few questions for another try.') : type === 'choice' ? (vi ? 'Tiếp theo, bạn sẽ luyện tự viết từ này.' : 'Next, you’ll practice recalling this term.') : (vi ? 'Bạn đã tự nhớ được từ này.' : 'You recalled this term on your own.')}</p>
        <div className="learn-feedback-actions"><GlassButton prominent ref={continueRef} className="learn-primary-button" busy={busy} disabled={busy} onClick={() => void advance()}>{busy ? (vi ? 'Đang lưu…' : 'Saving…') : (vi ? 'Tiếp tục' : 'Continue')}<ArrowRight size={17} aria-hidden="true" /></GlassButton>{!feedback.correct && <GlassButton className="learn-secondary-button" disabled={busy} onClick={() => void advance(true)}>{vi ? 'Để ôn lại sau' : 'Review later'}</GlassButton>}</div>
      </div> : <div className="learn-session-footer"><GlassButton className="learn-secondary-button" disabled={busy} onClick={() => setFeedback({ correct: false, revealed: true })}>{vi ? 'Không biết' : 'Don’t know'}</GlassButton><span>{type === 'choice' ? (vi ? 'Phím 1–4 để chọn đáp án' : 'Use 1–4 to answer') : (vi ? 'Enter để kiểm tra' : 'Press Enter to check')}</span></div>}
    </ContentSurface>
  </section>;
}
