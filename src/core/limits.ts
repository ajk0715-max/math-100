import type { Profile } from './model';

export type GateReason = 'restday' | 'before' | 'after' | 'cap' | 'done';

export interface Gate {
  open: boolean;
  reason: GateReason | null;
  /** 아이에게 보여 줄 한 줄 */
  title: string;
  sub: string;
  /** 오늘 더 쓸 수 있는 시간(ms). 닫혀 있으면 0 */
  remainMs: number;
}

/** "07:30" → 분. 읽을 수 없으면 null */
export function parseHm(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 24 || mi > 59 || (h === 24 && mi > 0)) return null;
  return h * 60 + mi;
}

export const hmText = (min: number): string => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

const CLOSED = (reason: GateReason, title: string, sub: string): Gate => ({ open: false, reason, title, sub, remainMs: 0 });

/**
 * 지금 수업을 열어도 되는가.
 * 쉬는 요일 → 허용 시간대 → 하루 상한 → "하루 하나" 순으로 막는다.
 * 쉬는 날이나 시간 밖이어도 Day와 별은 줄지 않는다.
 */
export function gate(p: Pick<Profile, 'settings' | 'lastLessonDate' | 'extraLessonDate'>, now: Date, today: string, usedMs: number): Gate {
  const st = p.settings;
  if (st.studyDays.length > 0 && !st.studyDays.includes(now.getDay())) {
    return CLOSED('restday', '오늘은 쉬는 날이에요', '내일 또 만나요. 쉬어도 별은 줄지 않아요.');
  }
  const from = parseHm(st.allowedFrom);
  const to = parseHm(st.allowedTo);
  if (from !== null && to !== null && from < to) {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (nowMin < from) return CLOSED('before', '아직 공부 시간이 아니에요', `${hmText(from)}부터 열려요.`);
    if (nowMin >= to) return CLOSED('after', '오늘 공부 시간이 끝났어요', '내일 또 만나요.');
  }
  const cap = st.dailyCapMin * 60_000;
  if (usedMs >= cap) return CLOSED('cap', '오늘은 충분히 공부했어요', '내일 또 만나요.');
  if (st.oneLessonPerDay && p.lastLessonDate === today && p.extraLessonDate !== today) {
    return CLOSED('done', '오늘 수업 끝!', '내일 또 만나요. 오늘 도장은 이미 찍었어요.');
  }
  return { open: true, reason: null, title: '', sub: '', remainMs: Math.max(0, cap - usedMs) };
}

/**
 * 수업을 마친 뒤 별 없이 더 놀 수 있는 시간(ms).
 * 하루 추가 놀이는 extraMin분까지이고(이미 논 시간 extraUsedMs는 뺀다), 오늘 전체 공부 시간이 하루 상한을 넘지 않는다.
 */
export function extraBudgetMs(p: Pick<Profile, 'settings'>, usedMs: number, extraUsedMs = 0): number {
  const byExtra = p.settings.extraMin * 60_000 - extraUsedMs;
  const byCap = p.settings.dailyCapMin * 60_000 - usedMs;
  return Math.max(0, Math.min(byExtra, byCap));
}

/** 이 정도보다 적게 남으면 추가 놀이를 열지 않는다 */
export const EXTRA_MIN_MS = 30_000;

/** 추가 놀이를 열어 줄 수 있는가: 수업을 마쳤고, 허용 시간대와 쉬는 날이 아니며, 남은 시간이 있다 */
export function extraAvailable(p: Pick<Profile, 'settings' | 'lastLessonDate' | 'extraLessonDate'>, now: Date, today: string, usedMs: number, extraUsedMs = 0): boolean {
  if (p.settings.extraMin <= 0 || p.lastLessonDate !== today) return false;
  const g = gate({ ...p, settings: { ...p.settings, oneLessonPerDay: false } }, now, today, usedMs);
  return g.open && extraBudgetMs(p, usedMs, extraUsedMs) >= EXTRA_MIN_MS;
}
