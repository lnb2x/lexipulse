import { useLanguage } from '../../context/LanguageContext';
import type { DailyStats } from '../../types/vocab';
import { formatLocalDate } from '../../utils/dateUtils';

export function WeeklyActivity({ dailyStats }: { dailyStats: DailyStats[] }) {
  const { language } = useLanguage();
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6 + index);
    const key = formatLocalDate(date.getTime());
    return { key, date, count: dailyStats.find(item => item.date === key)?.cardsReviewed ?? 0 };
  });
  const maximum = Math.max(1, ...days.map(day => day.count));
  const total = days.reduce((sum, day) => sum + day.count, 0);
  const weekdays = language === 'vi' ? ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  return <section className="study-panel weekly-activity" aria-label={language === 'vi' ? 'Hoạt động 7 ngày qua' : 'Activity over the last 7 days'}>
    <h3>{language === 'vi' ? 'Nhịp học của bạn' : 'Your study rhythm'}</h3>
    <p><strong>{total.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')}</strong> {language === 'vi' ? 'lượt ôn trong 7 ngày qua' : 'reviews in the last 7 days'}</p>
    <div className="weekly-chart">
      {days.map(day => <div key={day.key} className="weekly-day" title={`${day.key}: ${day.count}`} aria-label={`${day.key}: ${day.count} ${language === 'vi' ? 'lượt ôn' : 'reviews'}`}>
        <span className="weekly-count">{day.count || ''}</span>
        <div className="weekly-bar-track"><div className={`weekly-bar ${day.key === formatLocalDate() ? 'is-today' : ''}`} style={{ height: `${day.count / maximum * 100}%` }} /></div>
        <span>{weekdays[day.date.getDay()]}</span>
      </div>)}
    </div>
    <p className="study-caption">{language === 'vi' ? 'Ghi nhận các lượt ôn đến hạn.' : 'Scheduled reviews are counted here.'}</p>
  </section>;
}
