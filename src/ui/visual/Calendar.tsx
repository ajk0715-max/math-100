import { WEEKDAYS_SHORT, monthCells } from '@/core/dates';
import type { CalMark } from '@/core/types';

export interface CalendarProps {
  year: number;
  month: number;
  marks?: Record<number, CalMark>;
  compact?: boolean;
  highlightWeekday?: number;
  /** 날짜를 눌러 고르는 달력일 때 */
  onPick?: (day: number) => void;
  picked?: number[];
  right?: number[];
  wrong?: number[];
}

export function Calendar({ year, month, marks, compact, highlightWeekday, onPick, picked = [], right = [], wrong = [] }: CalendarProps) {
  const cells = monthCells(year, month);
  return (
    <div className={`cal${compact ? ' compact' : ''}`}>
      <div className="title">
        {year}년 {month}월
      </div>
      <div className="grid">
        {WEEKDAYS_SHORT.map((w, i) => (
          <div key={w} className={`dow${i === 0 ? ' sun' : i === 6 ? ' sat' : ''}`}>
            {w}
          </div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={i} className="d blank" />;
          const col = i % 7;
          const cls = [
            'd',
            col === 0 ? 'sun' : col === 6 ? 'sat' : '',
            highlightWeekday === col ? 'col-hl' : '',
            marks?.[d] ?? '',
            picked.includes(d) ? 'picked' : '',
            right.includes(d) ? 'right' : '',
            wrong.includes(d) ? 'wrong' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return onPick ? (
            <button key={i} type="button" className={cls} onClick={() => onPick(d)} aria-label={`${d}일`}>
              {d}
            </button>
          ) : (
            <div key={i} className={cls}>
              {d}
            </div>
          );
        })}
      </div>
    </div>
  );
}
