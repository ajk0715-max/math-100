// 날짜 계산. 모든 날짜는 기기의 현지 시간 기준이다.

export interface DateParts {
  y: number;
  m: number; // 1~12
  d: number; // 1~31
  wd: number; // 0=일 … 6=토
}

export const WEEKDAYS_SHORT = ['일', '월', '화', '수', '목', '금', '토'] as const;
export const WEEKDAYS_LONG = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'] as const;

export function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

export function weekdayOf(y: number, m: number, d: number): number {
  return new Date(y, m - 1, d).getDay();
}

export function toParts(date: Date): DateParts {
  return { y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate(), wd: date.getDay() };
}

export function makeParts(y: number, m: number, d: number): DateParts {
  return { y, m, d, wd: weekdayOf(y, m, d) };
}

export function addDays(p: DateParts, n: number): DateParts {
  return toParts(new Date(p.y, p.m - 1, p.d + n));
}

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function ymd(p: DateParts): string {
  return `${p.y}-${pad2(p.m)}-${pad2(p.d)}`;
}

export function localYmd(date: Date = new Date()): string {
  return ymd(toParts(date));
}

export function parseYmd(s: string): DateParts {
  const [y, m, d] = s.split('-').map(Number);
  return makeParts(y as number, m as number, d as number);
}

/** b - a (일 수) */
export function diffDays(a: DateParts, b: DateParts): number {
  const ta = Date.UTC(a.y, a.m - 1, a.d);
  const tb = Date.UTC(b.y, b.m - 1, b.d);
  return Math.round((tb - ta) / 86400000);
}

/** 그 달 1일의 요일 (0=일) */
export function firstWeekday(y: number, m: number): number {
  return weekdayOf(y, m, 1);
}

/** 달력 칸 배열: 앞쪽 빈칸은 null */
export function monthCells(y: number, m: number): (number | null)[] {
  const lead = firstWeekday(y, m);
  const total = daysInMonth(y, m);
  const cells: (number | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= total; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** 'HH:MM' 문자열을 분으로 */
export function hmToMin(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return (h as number) * 60 + (m as number);
}
