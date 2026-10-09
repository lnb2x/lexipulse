import { CheckCircle2, Clock, Layers, Plus, RotateCcw } from 'lucide-react';
import React from 'react';
import { useLanguage } from '../../context/LanguageContext';

interface DeckStatsProps {
  stats: { total: number; due: number; new: number; learning: number; mastered: number };
}

export const DeckStats = React.memo<DeckStatsProps>(({ stats }) => {
  const { t } = useLanguage();
  const metrics = [
    { label: t.deck.totalWords, value: stats.total, icon: Layers },
    { label: t.deck.dueToday, value: stats.due, icon: RotateCcw },
    { label: t.deck.newWords, value: stats.new, icon: Plus },
    { label: t.deck.learning, value: stats.learning, icon: Clock },
    { label: t.deck.mastered, value: stats.mastered, icon: CheckCircle2 },
  ];
  return <dl className="deck-metrics study-panel">
    {metrics.map(metric => <div key={metric.label}>
      <dt><metric.icon size={16} aria-hidden="true" />{metric.label}</dt>
      <dd>{metric.value.toLocaleString()}</dd>
    </div>)}
  </dl>;
});
DeckStats.displayName = 'DeckStats';
