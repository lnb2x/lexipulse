import { CheckCircle2, Clock, Flame } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import type { MatchCardItem, ReviewRating, WordItem } from '../../types/vocab';

interface ReviewMatchProps {
  cards: WordItem[];
  onCompleteSession: (history: Array<{ word: WordItem; rating: ReviewRating }>) => void;
  onGradeSingleWord?: (wordId: string, rating: ReviewRating) => Promise<void> | void;
}

const BATCH_SIZE = 5; // 5 words = 10 cards per round for optimal desktop readability

export const ReviewMatch: React.FC<ReviewMatchProps> = ({
  cards,
  onCompleteSession,
  onGradeSingleWord,
}) => {
  const { language, t } = useLanguage();

  const [currentRound, setCurrentRound] = useState(0);
  const totalRounds = Math.max(1, Math.ceil(cards.length / BATCH_SIZE));

  const [boardCards, setBoardCards] = useState<MatchCardItem[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [matchedCount, setMatchedCount] = useState(0);
  const [mistakesMap, setMistakesMap] = useState<Record<string, number>>({});
  const [combos, setCombos] = useState(0);
  const [maxCombos, setMaxCombos] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const historyRef = useRef<Array<{ word: WordItem; rating: ReviewRating }>>([]);

  // Timer interval
  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Setup round cards
  useEffect(() => {
    const startIdx = currentRound * BATCH_SIZE;
    const roundWords = cards.slice(startIdx, startIdx + BATCH_SIZE);

    if (roundWords.length === 0) return;

    // Create 2 cards per word: 1 EN, 1 VI
    const items: MatchCardItem[] = [];
    roundWords.forEach((w) => {
      items.push({
        id: `en-${w.id}`,
        wordId: w.id,
        text: w.word,
        type: 'en',
        isMatched: false,
        isSelected: false,
        isError: false,
      });
      items.push({
        id: `vi-${w.id}`,
        wordId: w.id,
        text: w.vietnameseDefinition,
        type: 'vi',
        isMatched: false,
        isSelected: false,
        isError: false,
      });
    });

    // Shuffle cards
    setBoardCards([...items].sort(() => 0.5 - Math.random()));
    setSelectedCardId(null);
  }, [currentRound, cards]);

  const handleCardClick = (card: MatchCardItem) => {
    if (isChecking || card.isMatched) return;

    // If clicking same card, deselect
    if (selectedCardId === card.id) {
      setSelectedCardId(null);
      return;
    }

    // If no card selected yet, select this card
    if (!selectedCardId) {
      setSelectedCardId(card.id);
      return;
    }

    // A card is already selected, check match with second card
    const firstCard = boardCards.find((c) => c.id === selectedCardId);
    if (!firstCard) return;

    // Cannot match two cards of the same type (e.g. EN with EN)
    if (firstCard.type === card.type) {
      setSelectedCardId(card.id);
      return;
    }

    setIsChecking(true);

    const isMatch = firstCard.wordId === card.wordId;

    if (isMatch) {
      // Correct match!
      setCombos((prev) => {
        const next = prev + 1;
        if (next > maxCombos) setMaxCombos(next);
        return next;
      });
      setMatchedCount((prev) => prev + 1);

      // Record SM-2 rating
      const targetWord = cards.find((w) => w.id === card.wordId);
      if (targetWord) {
        const hadMistakes = (mistakesMap[card.wordId] || 0) > 0;
        const rating: ReviewRating = hadMistakes ? 2 : 3;
        if (onGradeSingleWord) {
          onGradeSingleWord(card.wordId, rating);
        }
        historyRef.current = [...historyRef.current, { word: targetWord, rating }];
      }

      setBoardCards((prev) =>
        prev.map((c) =>
          c.wordId === card.wordId
            ? { ...c, isMatched: true, isSelected: false, isError: false }
            : c
        )
      );
      setSelectedCardId(null);
      setIsChecking(false);

      // Check if all cards in current round are matched
      const remainingUnmatched = boardCards.filter(
        (c) => !c.isMatched && c.wordId !== card.wordId
      );

      if (remainingUnmatched.length === 0) {
        // Round complete
        setTimeout(() => {
          if (currentRound + 1 < totalRounds) {
            setCurrentRound((prev) => prev + 1);
          } else {
            // Whole session complete!
            onCompleteSession(historyRef.current);
          }
        }, 800);
      }
    } else {
      // Mismatch
      setCombos(0);
      setMistakesMap((prev) => ({
        ...prev,
        [card.wordId]: (prev[card.wordId] || 0) + 1,
        [firstCard.wordId]: (prev[firstCard.wordId] || 0) + 1,
      }));

      setBoardCards((prev) =>
        prev.map((c) =>
          c.id === card.id || c.id === firstCard.id
            ? { ...c, isError: true }
            : c
        )
      );

      setTimeout(() => {
        setBoardCards((prev) =>
          prev.map((c) => ({ ...c, isError: false, isSelected: false }))
        );
        setSelectedCardId(null);
        setIsChecking(false);
      }, 700);
    }
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5 animate-slide-up">
      {/* Top metrics bar */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-3">
          <span className="font-bold font-mono text-slate-700 dark:text-slate-300">
            {language === 'vi'
              ? `Vòng ${currentRound + 1} / ${totalRounds}`
              : `Round ${currentRound + 1} of ${totalRounds}`}
          </span>

          <span className="flex items-center gap-1 font-mono text-slate-600 dark:text-slate-300">
            <Clock className="h-3.5 w-3.5 text-indigo-500" />
            {formatTimer(seconds)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {combos > 1 && (
            <span className="flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400 animate-bounce">
              <Flame className="h-4 w-4 fill-amber-500 text-amber-500" />
              {combos} Combo!
            </span>
          )}

          <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
            {matchedCount} / {cards.length} {language === 'vi' ? 'cặp từ' : 'pairs'}
          </span>
        </div>
      </div>

      {/* Main Game Container */}
      <div className="card-elevated p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-1">
          <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            {t.review.matchMode}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t.review.matchPrompt}
          </p>
        </div>

        {/* Card Grid: 2 columns on mobile, 2 columns on desktop for distinct visual clarity */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {boardCards.map((card) => {
            const isSelected = selectedCardId === card.id;

            let cardStyle =
              'border-slate-200 bg-white hover:border-indigo-400 hover:bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-slate-700';

            if (card.isMatched) {
              cardStyle =
                'border-emerald-500/40 bg-emerald-50/50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/20 dark:text-emerald-300 opacity-60 pointer-events-none';
            } else if (card.isError) {
              cardStyle =
                'border-rose-500 bg-rose-50 text-rose-800 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-200 ring-2 ring-rose-400';
            } else if (isSelected) {
              cardStyle =
                'border-indigo-600 bg-indigo-50/80 text-indigo-900 ring-2 ring-indigo-500 shadow-sm dark:border-indigo-500 dark:bg-indigo-950/60 dark:text-white';
            }

            return (
              <button
                key={card.id}
                type="button"
                onClick={() => handleCardClick(card)}
                disabled={card.isMatched || isChecking}
                className={`flex min-h-[72px] items-center justify-between rounded-xl border p-4 text-left transition-all shadow-sm active:scale-[0.98] ${cardStyle}`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                      card.type === 'en'
                        ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                    }`}
                  >
                    {card.type.toUpperCase()}
                  </span>
                  <span
                    className={`text-sm ${
                      card.type === 'en' ? 'font-bold' : 'font-medium'
                    }`}
                  >
                    {card.text}
                  </span>
                </div>

                {card.isMatched && (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 ml-2" />
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom Hint */}
        <div className="text-center text-[11px] text-slate-400 border-t border-slate-100 pt-3 dark:border-slate-800">
          {language === 'vi'
            ? 'Bấm vào từ tiếng Anh rồi chọn nghĩa tiếng Việt tương ứng'
            : 'Click an English word then select its matching Vietnamese definition'}
        </div>
      </div>
    </div>
  );
};
