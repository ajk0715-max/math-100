import type { AttemptRec, SessionRec } from '@/db/db';
import { localYmd } from './dates';
import { josa } from './ko';
import type { Profile } from './model';
import { weakSpots } from './session';
import { getSkill, hasSkill } from './skills';
import type { Area } from './types';

export const AREA_LABEL: Record<Area, string> = {
  num: '수와 연산',
  shape: '모양',
  measure: '비교하기',
  pattern: '규칙',
  data: '분류·표',
  story: '이야기 식',
  clock: '시계',
  cal: '달력',
  money: '돈',
  life: '하루 일과',
  mix: '종합',
};

export const SECTION_LABEL: Record<string, string> = { warmup: '워밍업', explore: '탐험', game: '게임', boss: '보스전', extra: '추가 놀이', diag: '시작 진단' };

export interface AreaStat {
  area: Area;
  label: string;
  solved: number;
  firstRight: number;
}

export interface DayReport {
  date: string;
  /** 오늘 열어 본 수업·보스 수 */
  sessions: number;
  /** 끝까지 마친 수업·보스가 있는가 */
  finished: boolean;
  /** 오늘 화면을 본 시간(추가 놀이 포함) */
  minutes: number;
  /** 그중 별 없이 논 시간 */
  extraMinutes: number;
  solved: number;
  firstRight: number;
  /** 도움 그림이나 힌트를 본 문제 수 */
  hints: number;
  /** 두 번 틀려 정답을 보여 준 문제 수 */
  revealed: number;
  areas: AreaStat[];
}

export function areaOf(skillId: string): Area | null {
  return hasSkill(skillId) ? getSkill(skillId).area : null;
}

/** 수업·보스전이 아닌 풀이(시작 진단, 별 없는 추가 놀이)는 정답률 통계에 넣지 않는다 */
const isGraded = (a: Pick<AttemptRec, 'section'>): boolean => a.section !== 'diag' && a.section !== 'extra';

/** 하루 리포트: 완료 여부, 소요 시간, 영역별 정답률, 힌트 사용 횟수 */
export function dayReport(date: string, sessions: SessionRec[], attempts: AttemptRec[]): DayReport {
  const mine = sessions.filter((s) => s.date === date);
  const today = attempts.filter((a) => isGraded(a) && localYmd(new Date(a.ts)) === date);
  const byArea = new Map<Area, AreaStat>();
  for (const a of today) {
    const area = areaOf(a.skill);
    if (!area) continue;
    const st = byArea.get(area) ?? { area, label: AREA_LABEL[area], solved: 0, firstRight: 0 };
    st.solved += 1;
    if (a.correctFirst) st.firstRight += 1;
    byArea.set(area, st);
  }
  return {
    date,
    sessions: mine.length,
    finished: mine.some((s) => s.completed && s.kind !== 'extra'),
    minutes: Math.round(mine.reduce((t, s) => t + s.activeMs, 0) / 60000),
    extraMinutes: Math.round(mine.filter((s) => s.kind === 'extra').reduce((t, s) => t + s.activeMs, 0) / 60000),
    solved: today.length,
    firstRight: today.filter((a) => a.correctFirst).length,
    hints: today.filter((a) => a.hinted).length,
    revealed: today.filter((a) => a.revealed).length,
    areas: [...byArea.values()].sort((a, b) => b.solved - a.solved),
  };
}

export interface WeakRow {
  label: string;
  skill: string;
  skillName: string;
  count: number;
}

/** 같은 헷갈림이 3번 이상 쌓인 것. 다음 워밍업에 저절로 들어간다. */
export function weakRows(p: Pick<Profile, 'skills'>): WeakRow[] {
  return weakSpots(p).map((w) => ({ ...w, skillName: hasSkill(w.skill) ? getSkill(w.skill).name : w.skill }));
}

export interface SkillRow {
  skill: string;
  name: string;
  area: Area | null;
  seen: number;
  right: number;
  /** 0~1 */
  rate: number;
  level: number;
}

/** 지금까지 가장 많이 틀린 유형(5문제 이상 푼 것만) */
export function lowestSkills(p: Pick<Profile, 'skills'>, limit = 5): SkillRow[] {
  const rows: SkillRow[] = [];
  for (const [skill, st] of Object.entries(p.skills)) {
    if (st.seen < 5 || !hasSkill(skill) || getSkill(skill).game) continue;
    rows.push({ skill, name: getSkill(skill).name, area: areaOf(skill), seen: st.seen, right: st.right, rate: st.right / st.seen, level: st.level });
  }
  return rows.sort((a, b) => a.rate - b.rate || b.seen - a.seen).slice(0, limit);
}

export interface RangeReport {
  /** 구간 안에서 푼 문제 수와 첫 시도 정답 수 */
  solved: number;
  firstRight: number;
  hints: number;
  minutes: number;
  days: number;
  areas: AreaStat[];
}

/** Day 구간(from~to)의 기록을 모은다. 중간 점검 리포트에 쓴다. */
export function rangeReport(attempts: AttemptRec[], sessions: SessionRec[], fromDay: number, toDay: number): RangeReport {
  const a = attempts.filter((x) => x.day >= fromDay && x.day <= toDay && isGraded(x));
  const s = sessions.filter((x) => x.day >= fromDay && x.day <= toDay && x.kind !== 'extra');
  const byArea = new Map<Area, AreaStat>();
  for (const x of a) {
    const area = areaOf(x.skill);
    if (!area) continue;
    const st = byArea.get(area) ?? { area, label: AREA_LABEL[area], solved: 0, firstRight: 0 };
    st.solved += 1;
    if (x.correctFirst) st.firstRight += 1;
    byArea.set(area, st);
  }
  return {
    solved: a.length,
    firstRight: a.filter((x) => x.correctFirst).length,
    hints: a.filter((x) => x.hinted).length,
    minutes: Math.round(s.reduce((t, x) => t + x.activeMs, 0) / 60000),
    days: new Set(s.filter((x) => x.completed).map((x) => x.day)).size,
    areas: [...byArea.values()].sort((x, y) => y.solved - x.solved),
  };
}

const pct = (n: number, d: number): number | null => (d > 0 ? Math.round((n / d) * 100) : null);

export interface FinalReport {
  all: RangeReport;
  /** Day 1~50 */
  first: RangeReport;
  /** Day 51~100 */
  second: RangeReport;
  advice: string[];
}

/** 100일 종합 리포트: 전체와 앞·뒤 50일, 영역별 강약, 앞으로 할 일 */
export function finalReport(attempts: AttemptRec[], sessions: SessionRec[]): FinalReport {
  const all = rangeReport(attempts, sessions, 1, 100);
  const first = rangeReport(attempts, sessions, 1, 50);
  const second = rangeReport(attempts, sessions, 51, 100);
  return { all, first, second, advice: finalAdvice(all, first, second) };
}

const AREA_MIN = 20;
const HALF_MIN = 30;

/** 보호자에게 건네는 말. 정답률이 아니라 ‘다음에 할 일’로 끝난다. */
export function finalAdvice(all: RangeReport, first: RangeReport, second: RangeReport): string[] {
  const out: string[] = [];
  const total = pct(all.firstRight, all.solved);
  if (total === null) return ['기록이 아직 적어요. 수업을 마친 뒤에 다시 확인해 주세요.'];

  out.push(
    total >= 85
      ? `100일 동안 처음에 바로 맞힌 비율이 ${total}%예요. 배운 내용이 잘 자리 잡았어요.`
      : total >= 70
        ? `100일 동안 처음에 바로 맞힌 비율이 ${total}%예요. 대체로 잘 해냈어요.`
        : `100일 동안 처음에 바로 맞힌 비율이 ${total}%예요. 어려워한 부분이 많았으니 아래 약한 영역을 한 번 더 살펴봐 주세요.`,
  );

  const a = pct(first.firstRight, first.solved);
  const b = pct(second.firstRight, second.solved);
  if (a !== null && b !== null && first.solved >= HALF_MIN && second.solved >= HALF_MIN) {
    if (b - a >= 3) out.push(`앞 50일은 ${a}%, 뒤 50일은 ${b}%예요. 뒤로 갈수록 내용이 어려워졌는데도 더 안정적이었어요.`);
    else if (a - b >= 8) out.push(`앞 50일은 ${a}%, 뒤 50일은 ${b}%예요. 뒤 단계 내용이 더 어렵기 때문일 수 있어요. 낮은 영역을 아래에서 확인해 주세요.`);
    else out.push(`앞 50일은 ${a}%, 뒤 50일은 ${b}%로 비슷하게 이어졌어요.`);
  }

  const rated = all.areas
    .filter((x) => x.solved >= AREA_MIN)
    .map((x) => ({ label: x.label, rate: x.firstRight / x.solved }))
    .sort((x, y) => y.rate - x.rate);
  if (rated.length >= 2) {
    const best = rated[0] as { label: string; rate: number };
    const worst = rated[rated.length - 1] as { label: string; rate: number };
    out.push(
      `가장 안정적인 영역은 ${best.label}${josa(best.label, '이에요/예요')}(${Math.round(best.rate * 100)}%). 상대적으로 약한 영역은 ${worst.label}${josa(worst.label, '이에요/예요')}(${Math.round(worst.rate * 100)}%).`,
    );
    if (worst.rate < 0.85) out.push(`${worst.label} 영역은 생활 속에서 한 번씩 더 물어봐 주세요. 진도 탭에서 해당 단계로 돌아가 다시 풀어 보는 방법도 있어요.`);
  }

  out.push('입학 전까지는 하루 5분 ‘더 놀기’로 감을 유지하고, 시계와 달력은 집 안에서 직접 읽어 보게 해 주세요.');
  return out;
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

const q = (v: string | number | boolean): string => {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const ox = (b: boolean): string => (b ? 'O' : 'X');

const HEADER = ['날짜', '시각', 'Day', '구분', '영역', '문제 유형', '단계', '첫 시도 정답', '시도 수', '힌트', '정답 공개', '걸린 시간(초)', '정답', '고른 답', '헷갈린 것'];

/** 엑셀에서 한글이 깨지지 않게 BOM을 붙인다 */
export function attemptsToCsv(attempts: AttemptRec[]): string {
  const rows = [...attempts].sort((a, b) => a.ts - b.ts).map((a) => {
    const d = new Date(a.ts);
    const area = areaOf(a.skill);
    return [
      localYmd(d),
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
      a.day,
      SECTION_LABEL[a.section] ?? a.section,
      area ? AREA_LABEL[area] : '',
      hasSkill(a.skill) ? getSkill(a.skill).name : a.skill,
      a.level,
      ox(a.correctFirst),
      a.tries,
      ox(a.hinted),
      ox(a.revealed),
      Math.round(a.ms / 100) / 10,
      a.expected,
      a.given,
      a.confusion ?? '',
    ].map(q).join(',');
  });
  return `﻿${[HEADER.map(q).join(','), ...rows].join('\r\n')}\r\n`;
}
