import { Calendar, Clock, Edit3, Trash2 } from 'lucide-react';
import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { formatDueText, formatInterval } from '../../services/sm2';
import type { WordItem } from '../../types/vocab';
import { AudioButton } from '../common/AudioButton';

interface WordListItemProps {
  word: WordItem;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}
const viDateFormatter = new Intl.DateTimeFormat('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit' });
const enDateFormatter = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });

export const WordListItem = React.memo<WordListItemProps>(({ word, onClick, onEdit, onDelete }) => {
  const { language, t } = useLanguage();
  const dueInfo = formatDueText(word.reviewMeta.dueDate, undefined, language);
  const createdDate = Number.isFinite(word.createdAt) && word.createdAt > 0
    ? (language === 'vi' ? viDateFormatter : enDateFormatter).format(new Date(word.createdAt))
    : '—';
  const statusNames = language === 'vi'
    ? { new: 'Mới', learning: 'Đang học', review_needed: 'Cần ôn', mastered: 'Đã thuộc' }
    : { new: 'New', learning: 'Learning', review_needed: 'Due', mastered: 'Mastered' };
  const phonetic = word.phonetics.us || word.phonetics.uk;
  return <article className="deck-word-row" onClick={onClick}>
    <div className="deck-word-main">
      <button type="button" className="deck-word-title" onClick={event => { event.stopPropagation(); onClick(); }}>{word.word}</button>
      <div className="deck-word-phonetic"><span>{word.pos.join(', ')}</span>{phonetic && phonetic !== `/${word.word}/` && <span>{phonetic}</span>}</div>
      {(word.formLabels?.length || (word.lemma && word.lemma.toLowerCase() !== word.word.toLowerCase())) ? <div className="deck-word-morphology">
        {word.formLabels?.[0] && <span>{word.formLabels[0]}</span>}
        {word.lemma && word.lemma.toLowerCase() !== word.word.toLowerCase() && <span>{language === 'vi' ? 'Gốc:' : 'Root:'} {word.lemma}</span>}
      </div> : null}
    </div>
    <div className="deck-word-meaning">
      <p>{word.vietnameseDefinition}</p>
      <div className="deck-word-tags">
        {word.tags.slice(0, 3).map(tag => <span key={tag}>{tag}</span>)}
        {word.collocations.slice(0, 2).map((item, index) => <span key={index} className="deck-collocation">{item.phrase}</span>)}
      </div>
      <span className="deck-word-created"><Calendar size={11} />{createdDate}</span>
    </div>
    <div className="deck-word-schedule">
      <span className={`deck-word-status status-${word.status}`}>{statusNames[word.status]}</span>
      <span className={`deck-word-due ${dueInfo.isOverdue ? 'is-overdue' : ''}`}><Clock size={11} />{dueInfo.text}</span>
      <span className="deck-word-interval">{t.deck.interval} {formatInterval(word.reviewMeta.interval, language)} ({word.reviewMeta.repetition} {t.deck.reps})</span>
    </div>
    <div className="deck-word-actions" onClick={event => event.stopPropagation()}>
      <AudioButton text={word.word} accent="US" audioUrl={word.phonetics.audioUs} size="sm" showLabel={false} />
      <button data-glass type="button" onClick={onEdit} className="glass-control" title={language === 'vi' ? 'Chỉnh sửa từ này' : 'Edit word'}><Edit3 size={15} /></button>
      <button data-glass type="button" onClick={onDelete} className="glass-control deck-delete" title={language === 'vi' ? 'Xóa khỏi bộ từ' : 'Delete word'}><Trash2 size={15} /></button>
    </div>
  </article>;
});
WordListItem.displayName = 'WordListItem';
