import { BookPlus, Check, ChevronDown, Filter, HelpCircle, Layers, Play, X } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import type { ContributionActivityFilter, DailyStats, DayActivity, WordItem } from '../../types/vocab';
import { formatLocalDate } from '../../utils/dateUtils';

interface ContributionHeatmapProps {
  words: WordItem[];
  dailyStats: DailyStats[];
  onReviewDateWords?: (date: string) => void;
  onFilterDate?: (date: string) => void;
}

interface DayCell {
  date: string; // YYYY-MM-DD
  dayOfWeek: number; // 0 = Sun, 6 = Sat
  month: number; // 0-11
  isFuture: boolean;
  activity: DayActivity;
}

interface WeekColumn {
  days: (DayCell | null)[];
  monthLabel?: string;
}

export const ContributionHeatmap: React.FC<ContributionHeatmapProps> = ({
  words,
  dailyStats,
  onReviewDateWords,
  onFilterDate,
}) => {
  const { language, t } = useLanguage();

  // State - Default to 'words' for vocabulary addition tracking
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [activityFilter, setActivityFilter] = useState<ContributionActivityFilter>('words');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLearnModalOpen, setIsLearnModalOpen] = useState(false);
  const [hoveredDay, setHoveredDay] = useState<{ day: DayCell; x: number; y: number } | null>(null);
  const [selectedDayDetail, setSelectedDayDetail] = useState<DayCell | null>(null);

  const settingsDropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsDropdownRef.current && !settingsDropdownRef.current.contains(e.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute activity map: date (YYYY-MM-DD) -> { reviews, wordsAdded }
  const activityMap = useMemo(() => {
    const map = new Map<string, { reviews: number; words: number }>();

    // 1. Process words created
    for (const w of words) {
      const d = formatLocalDate(w.createdAt);
      const current = map.get(d) || { reviews: 0, words: 0 };
      current.words += 1;
      map.set(d, current);

      // Also process reviewMeta.history
      if (w.reviewMeta?.history && Array.isArray(w.reviewMeta.history)) {
        for (const h of w.reviewMeta.history) {
          if (h.date) {
            const reviewDate = formatLocalDate(h.date);
            const revItem = map.get(reviewDate) || { reviews: 0, words: 0 };
            revItem.reviews += 1;
            map.set(reviewDate, revItem);
          }
        }
      }
    }

    // 2. Process dailyStats (from session reviews)
    for (const s of dailyStats) {
      const d = s.date;
      const current = map.get(d) || { reviews: 0, words: 0 };
      // Use the max of tracked reviews or cardsReviewed
      current.reviews = Math.max(current.reviews, s.cardsReviewed || 0);
      map.set(d, current);
    }

    return map;
  }, [words, dailyStats]);

  // Available selectable years (Current year and past 4 years)
  const availableYears = useMemo(() => {
    const years: number[] = [];
    for (let y = currentYear; y >= currentYear - 4; y--) {
      years.push(y);
    }
    return years;
  }, [currentYear]);

  // Is rolling 12-month window (when current year is selected)
  const isRollingLastYear = selectedYear === currentYear;

  // Build grid of weeks (52-53 columns, 7 rows: Sun=0 to Sat=6)
  const { weeks, totalContributions } = useMemo(() => {
    const today = new Date();
    const todayStr = formatLocalDate(today);
    let startDate: Date;
    let endDate: Date;

    if (isRollingLastYear) {
      // End on the Saturday of the current week
      endDate = new Date(today);
      const dayOfWeek = endDate.getDay();
      endDate.setDate(endDate.getDate() + (6 - dayOfWeek));

      // 52 weeks back, starting on a Sunday (53 columns total)
      startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 52 * 7 - 6);
    } else {
      // Calendar year: Jan 1 to Dec 31 of selectedYear
      const jan1 = new Date(selectedYear, 0, 1);
      startDate = new Date(jan1);
      // Backtrack to previous Sunday
      startDate.setDate(startDate.getDate() - startDate.getDay());

      const dec31 = new Date(selectedYear, 11, 31);
      endDate = new Date(dec31);
      // Advance to following Saturday
      endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
    }

    // Calculate level based on count
    const getLevel = (count: number): 0 | 1 | 2 | 3 | 4 => {
      if (count <= 0) return 0;
      if (count <= 2) return 1;
      if (count <= 5) return 2;
      if (count <= 9) return 3;
      return 4;
    };

    let total = 0;
    const weekList: WeekColumn[] = [];
    let currentWeek: (DayCell | null)[] = [];
    const curr = new Date(startDate);

    let lastMonth = -1;

    while (curr <= endDate) {
      const dStr = formatLocalDate(curr);
      const dayOfWeek = curr.getDay();
      const month = curr.getMonth();
      const isFuture = dStr > todayStr;

      const actData = activityMap.get(dStr) || { reviews: 0, words: 0 };
      let count = 0;
      if (activityFilter === 'all') {
        count = actData.reviews + actData.words;
      } else if (activityFilter === 'reviews') {
        count = actData.reviews;
      } else {
        count = actData.words;
      }

      // Check if day is within the active counting range
      const inRange = isRollingLastYear
        ? dStr <= todayStr && curr >= new Date(today.getTime() - 366 * 24 * 60 * 60 * 1000)
        : curr.getFullYear() === selectedYear && !isFuture;

      if (inRange) {
        total += count;
      }

      const cell: DayCell = {
        date: dStr,
        dayOfWeek,
        month,
        isFuture,
        activity: {
          date: dStr,
          count,
          reviewsCount: actData.reviews,
          wordsAddedCount: actData.words,
          level: getLevel(count),
        },
      };

      currentWeek.push(cell);

      if (dayOfWeek === 6) {
        // Week complete (Saturday reached)
        // Determine if this week should display a month label
        let monthLabel: string | undefined = undefined;
        // Check if any day in the week is the first of a month or month changed
        const midDay = currentWeek[3] || currentWeek[0];
        if (midDay && midDay.month !== lastMonth) {
          lastMonth = midDay.month;
          // Format month name (e.g. Jan, Feb, Mar, Sep, ...)
          const dateForMonth = new Date(curr.getFullYear(), midDay.month, 1);
          monthLabel = dateForMonth.toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', {
            month: 'short',
          });
        }

        weekList.push({
          days: currentWeek,
          monthLabel,
        });
        currentWeek = [];
      }

      curr.setDate(curr.getDate() + 1);
    }

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      weekList.push({ days: currentWeek });
    }

    return { weeks: weekList, totalContributions: total };
  }, [selectedYear, isRollingLastYear, activityMap, activityFilter, language]);

  // Color classes for dark and light theme
  const getCellColorClass = (cell: DayCell | null) => {
    if (!cell) return 'invisible';
    if (cell.isFuture) {
      return 'bg-slate-100/50 dark:bg-slate-900/30 border border-slate-200/30 dark:border-slate-800/30 opacity-30 cursor-default';
    }

    const { level } = cell.activity;
    switch (level) {
      case 1:
        return 'bg-[#9be9a8] dark:bg-[#0e4429] border border-[#7bc96f]/40 dark:border-[#0e4429] hover:ring-2 hover:ring-emerald-400';
      case 2:
        return 'bg-[#40c463] dark:bg-[#006d32] border border-[#30a14e]/40 dark:border-[#006d32] hover:ring-2 hover:ring-emerald-400';
      case 3:
        return 'bg-[#30a14e] dark:bg-[#26a641] border border-[#216e39]/40 dark:border-[#26a641] hover:ring-2 hover:ring-emerald-300';
      case 4:
        return 'bg-[#216e39] dark:bg-[#39d353] border border-[#195328]/40 dark:border-[#39d353] hover:ring-2 hover:ring-emerald-200';
      case 0:
      default:
        return 'bg-[#ebedf0] dark:bg-[#161b22] border border-slate-200/70 dark:border-[#30363d]/50 hover:border-slate-400 dark:hover:border-slate-500';
    }
  };

  // Format date for tooltip and popup
  const formatCellDate = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Header title text
  const headerTitle = useMemo(() => {
    if (isRollingLastYear) {
      return t.contribution.inLastYear.replace('{count}', totalContributions.toString());
    }
    return t.contribution.inYear
      .replace('{count}', totalContributions.toString())
      .replace('{year}', selectedYear.toString());
  }, [isRollingLastYear, totalContributions, selectedYear, t]);

  return (
    <div ref={containerRef} className="relative w-full rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-card dark:border-slate-800 dark:bg-[#121824]">
      <div className="flex flex-col lg:flex-row items-start gap-4">
        {/* Main Contribution Box */}
        <div className="flex-1 w-full space-y-3">
          {/* Header with Title and Settings */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                <BookPlus className="h-4 w-4" />
              </div>
              <h3 className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                {headerTitle}
              </h3>
            </div>

            {/* Display Settings Dropdown */}
            <div className="relative" ref={settingsDropdownRef}>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
              >
                <span>{t.contribution.settings}</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </button>

              {isSettingsOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-30 dark:border-slate-800 dark:bg-[#161b22] text-xs space-y-1 animate-fade-in">
                  <div className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    {language === 'vi' ? 'Hiển thị hoạt động' : 'Activity Filter'}
                  </div>

                  {/* Option: Words Added (Default) */}
                  <button
                    type="button"
                    onClick={() => {
                      setActivityFilter('words');
                      setIsSettingsOpen(false);
                    }}
                    className={`flex w-full items-start justify-between rounded-lg px-2.5 py-2 text-left transition-colors ${
                      activityFilter === 'words'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div>
                      <div className="font-semibold">{t.contribution.wordsOnly}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        {t.contribution.wordsOnlyDesc}
                      </div>
                    </div>
                    {activityFilter === 'words' && <Check className="h-3.5 w-3.5 mt-0.5 shrink-0" />}
                  </button>

                  {/* Option: All Activity */}
                  <button
                    type="button"
                    onClick={() => {
                      setActivityFilter('all');
                      setIsSettingsOpen(false);
                    }}
                    className={`flex w-full items-start justify-between rounded-lg px-2.5 py-2 text-left transition-colors ${
                      activityFilter === 'all'
                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div>
                      <div className="font-semibold">{t.contribution.allActivity}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        {t.contribution.allActivityDesc}
                      </div>
                    </div>
                    {activityFilter === 'all' && <Check className="h-3.5 w-3.5 mt-0.5 shrink-0" />}
                  </button>

                  {/* Option: Reviews Only */}
                  <button
                    type="button"
                    onClick={() => {
                      setActivityFilter('reviews');
                      setIsSettingsOpen(false);
                    }}
                    className={`flex w-full items-start justify-between rounded-lg px-2.5 py-2 text-left transition-colors ${
                      activityFilter === 'reviews'
                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div>
                      <div className="font-semibold">{t.contribution.reviewsOnly}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        {t.contribution.reviewsOnlyDesc}
                      </div>
                    </div>
                    {activityFilter === 'reviews' && <Check className="h-3.5 w-3.5 mt-0.5 shrink-0" />}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* GitHub-style Heatmap Box */}
          <div className="rounded-xl border border-slate-200/70 bg-slate-50/50 p-3.5 dark:border-slate-800/80 dark:bg-[#0c1017]/70 overflow-hidden">
            {/* Scrollable Container for Heatmap on narrow viewports */}
            <div className="overflow-x-auto pb-2 scrollbar-thin">
              <div className="min-w-[720px]">
                {/* Month labels row */}
                <div className="flex pl-8 mb-1 text-[11px] text-slate-400 dark:text-slate-400 font-medium select-none">
                  {weeks.map((week, idx) => (
                    <div key={`month-${idx}`} className="w-[14px] text-left shrink-0">
                      {week.monthLabel && (
                        <span className="relative -top-0.5 whitespace-nowrap">{week.monthLabel}</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Heatmap Grid (7 rows, 52-53 columns) */}
                <div className="flex">
                  {/* Day of Week Labels (Mon, Wed, Fri) */}
                  <div className="w-8 flex flex-col justify-between py-[2px] pr-2 text-[10px] font-medium text-slate-400 dark:text-slate-400 select-none">
                    <span className="h-[11px] leading-[11px]"></span>
                    <span className="h-[11px] leading-[11px]">Mon</span>
                    <span className="h-[11px] leading-[11px]"></span>
                    <span className="h-[11px] leading-[11px]">Wed</span>
                    <span className="h-[11px] leading-[11px]"></span>
                    <span className="h-[11px] leading-[11px]">Fri</span>
                    <span className="h-[11px] leading-[11px]"></span>
                  </div>

                  {/* Weeks columns */}
                  <div className="flex gap-[3px]">
                    {weeks.map((week, wIdx) => (
                      <div key={`week-${wIdx}`} className="flex flex-col gap-[3px]">
                        {week.days.map((day, dIdx) => {
                          const isHovered = hoveredDay?.day.date === day?.date;
                          const isSelected = selectedDayDetail?.date === day?.date;

                          return (
                            <div
                              key={`day-${wIdx}-${dIdx}`}
                              onMouseEnter={(e) => {
                                if (day) {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setHoveredDay({
                                    day,
                                    x: rect.left + rect.width / 2,
                                    y: rect.top,
                                  });
                                }
                              }}
                              onMouseLeave={() => setHoveredDay(null)}
                              onClick={() => {
                                if (day && !day.isFuture) {
                                  setSelectedDayDetail(day);
                                }
                              }}
                              className={`h-[11px] w-[11px] rounded-[2.5px] transition-all duration-100 ${getCellColorClass(
                                day
                              )} ${
                                isSelected ? 'ring-2 ring-indigo-500 scale-110 z-10' : ''
                              } ${
                                isHovered && !day?.isFuture ? 'scale-125 z-10' : ''
                              } ${day && !day.isFuture ? 'cursor-pointer' : ''}`}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom bar: Learn link and Legend */}
            <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px] dark:border-slate-800/80">
              <button
                type="button"
                onClick={() => setIsLearnModalOpen(true)}
                className="inline-flex items-center gap-1 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                <span>{t.contribution.learnCount}</span>
              </button>

              {/* Legend: Less [][][][][] More */}
              <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-400">
                <span>{t.contribution.less}</span>
                <span className="inline-block h-[10px] w-[10px] rounded-[2px] bg-[#ebedf0] border border-slate-200/80 dark:bg-[#161b22] dark:border-[#30363d]/60" />
                <span className="inline-block h-[10px] w-[10px] rounded-[2px] bg-[#9be9a8] dark:bg-[#0e4429]" />
                <span className="inline-block h-[10px] w-[10px] rounded-[2px] bg-[#40c463] dark:bg-[#006d32]" />
                <span className="inline-block h-[10px] w-[10px] rounded-[2px] bg-[#30a14e] dark:bg-[#26a641]" />
                <span className="inline-block h-[10px] w-[10px] rounded-[2px] bg-[#216e39] dark:bg-[#39d353]" />
                <span>{t.contribution.more}</span>
              </div>
            </div>
          </div>

          {/* Selected Day Quick Action Drawer / Card */}
          {selectedDayDetail && (
            <div className="mt-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/20 animate-fade-in flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-sm">
                  {activityFilter === 'words'
                    ? selectedDayDetail.activity.wordsAddedCount
                    : selectedDayDetail.activity.count}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    {formatCellDate(selectedDayDetail.date)}
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    {selectedDayDetail.activity.wordsAddedCount}{' '}
                    {language === 'vi' ? 'từ vựng được thêm' : 'words added'}
                    {selectedDayDetail.activity.reviewsCount > 0 && (
                      <span> • {selectedDayDetail.activity.reviewsCount} {language === 'vi' ? 'lượt ôn tập' : 'reviews'}</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {onReviewDateWords && selectedDayDetail.activity.wordsAddedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => onReviewDateWords(selectedDayDetail.date)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 active:scale-98 transition-all"
                  >
                    <Play className="h-3 w-3 fill-white" />
                    <span>{t.contribution.reviewThisDate}</span>
                  </button>
                )}

                {onFilterDate && (
                  <button
                    type="button"
                    onClick={() => onFilterDate(selectedDayDetail.date)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-colors"
                  >
                    <Filter className="h-3 w-3" />
                    <span>{t.contribution.filterThisDate}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedDayDetail(null)}
                  className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Year Sidebar Selector */}
        <div className="w-full lg:w-28 flex lg:flex-col flex-row gap-1.5 pt-7 shrink-0 overflow-x-auto">
          {availableYears.map((year) => {
            const isSelected = selectedYear === year;
            return (
              <button
                key={year}
                type="button"
                onClick={() => {
                  setSelectedYear(year);
                  setSelectedDayDetail(null);
                }}
                className={`text-center rounded-lg text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-sm px-3.5 py-1.5'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60 px-3.5 py-1.5'
                }`}
              >
                {year}
              </button>
            );
          })}
        </div>
      </div>

      {/* Floating Hover Tooltip */}
      {hoveredDay && !hoveredDay.day.isFuture && (
        <div
          className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-full mb-2 rounded-lg bg-slate-900/95 dark:bg-[#21262d] px-3 py-1.5 text-[11px] text-white shadow-xl backdrop-blur border border-slate-700/60"
          style={{
            left: hoveredDay.x,
            top: hoveredDay.y - 8,
          }}
        >
          <div className="font-semibold whitespace-nowrap">
            {hoveredDay.day.activity.count === 0
              ? t.contribution.noContributions.replace(
                  '{date}',
                  formatCellDate(hoveredDay.day.date)
                )
              : t.contribution.contributionsOn
                  .replace('{count}', (activityFilter === 'words' ? hoveredDay.day.activity.wordsAddedCount : hoveredDay.day.activity.count).toString())
                  .replace('{date}', formatCellDate(hoveredDay.day.date))}
          </div>
          {activityFilter !== 'words' && hoveredDay.day.activity.count > 0 && (
            <div className="text-[10px] text-slate-300 dark:text-slate-400 flex items-center gap-2 mt-0.5">
              <span>
                {t.contribution.wordCount.replace(
                  '{count}',
                  hoveredDay.day.activity.wordsAddedCount.toString()
                )}
              </span>
              <span>•</span>
              <span>
                {t.contribution.reviewCount.replace(
                  '{count}',
                  hoveredDay.day.activity.reviewsCount.toString()
                )}
              </span>
            </div>
          )}
        </div>
      )}

      {/* "Learn How We Count Contributions" Modal */}
      {isLearnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-[#111622] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                  <Layers className="h-5 w-5" />
                </div>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  {t.contribution.modalTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsLearnModalOpen(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {t.contribution.modalDesc}
            </p>

            <div className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
              <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60">
                <span className="font-bold text-indigo-600 dark:text-indigo-400">1.</span>
                <span>{t.contribution.modalPoint1}</span>
              </div>
              <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60">
                <span className="font-bold text-indigo-600 dark:text-indigo-400">2.</span>
                <span>{t.contribution.modalPoint2}</span>
              </div>
              <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60">
                <span className="font-bold text-emerald-600 dark:text-emerald-400">3.</span>
                <span>{t.contribution.modalPoint3}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsLearnModalOpen(false)}
              className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-500 transition-colors"
            >
              {t.contribution.closeModal}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
