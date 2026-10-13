import { getSkill } from '../skills';
import type { GameId, OptionalFlag } from '../types';
import { BLOCKS, blockDef } from './blocks';
import { DAYS_01_05 } from './days-01-05';
import { DAYS_06_10 } from './days-06-10';
import { DAYS_11_15 } from './days-11-15';
import { DAYS_16_20 } from './days-16-20';
import type { BossPart, BossSpec, DayBody, DayDef, IntroCard, Lesson, OptionalOn } from './types';

export * from './types';
export { BLOCKS, blockDef };

export const TOTAL_DAYS = 100;
export const BLOCK_COUNT = 20;
export const BLOCK_DAYS = 5;

/** 수업 데이터가 들어 있는 날들. 단계가 구현될 때마다 여기에 이어 붙인다. */
const AUTHORED: DayDef[] = [...DAYS_01_05, ...DAYS_06_10, ...DAYS_11_15, ...DAYS_16_20];

const DAY_MAP = new Map<number, DayDef>(AUTHORED.map((d) => [d.day, d]));

export const blockOf = (day: number): number => Math.ceil(day / BLOCK_DAYS);
export const idxInBlock = (day: number): 1 | 2 | 3 | 4 | 5 => (((day - 1) % BLOCK_DAYS) + 1) as 1 | 2 | 3 | 4 | 5;
export const isBossDay = (day: number): boolean => idxInBlock(day) === 5;
export const firstDayOf = (block: number): number => (block - 1) * BLOCK_DAYS + 1;
export const bossDayOf = (block: number): number => block * BLOCK_DAYS;

/** 열려 있는 마지막 날(보스 포함). 블록의 ready 표시를 따른다. */
export function lastReadyDay(): number {
  let last = 0;
  for (const b of BLOCKS) {
    if (!b.ready) break;
    last = b.n * BLOCK_DAYS;
  }
  return last;
}

export const isReadyDay = (day: number): boolean => day >= 1 && day <= lastReadyDay();

/** 선택 과제가 모두 꺼진 기본 상태 */
export const OPTIONAL_OFF: OptionalOn = { clock5: false, hour60: false, carry: false };

/** 스킬이 처음 나오는 날(선택 과제를 켠 본 수업 기준) */
const FIRST_DAY = new Map<string, number>();
for (const d of [...AUTHORED].sort((a, b) => a.day - b.day)) {
  for (const u of d.explore) if (!FIRST_DAY.has(u.skill)) FIRST_DAY.set(u.skill, d.day);
}
export const firstDayOfSkill = (skill: string): number | undefined => FIRST_DAY.get(skill);

/** 선택 과제 설정에 맞춰 그날 실제로 할 수업 내용을 고른다 */
function bodyOf(d: DayDef, opt: OptionalOn): { body: DayBody; optional?: { flag: OptionalFlag; on: boolean } } {
  if (!d.off) return { body: d };
  const on = opt[d.off.flag];
  return { body: on ? d : d.off.body, optional: { flag: d.off.flag, on } };
}

function newSkillsIn(day: number, body: DayBody): string[] {
  const out: string[] = [];
  for (const u of body.explore) {
    if (FIRST_DAY.get(u.skill) === day && !out.includes(u.skill)) out.push(u.skill);
  }
  return out;
}

const BOSS_INTRO: IntroCard[] = [
  { text: '보스 도전! 이번 단계에서 배운 것을 모아서 열다섯 문제를 풀어 볼 거야.' },
  { text: '열두 문제 이상 맞히면 통과야. 못 넘어도 괜찮아, 틀린 곳만 다시 하면 돼!' },
];
/** Day 100: 100일 완성 최종 점검 */
const BOSS_INTRO_FINAL: IntroCard[] = [
  { text: '드디어 100일째, 마지막 보스야! 100일 동안 배운 것을 모아서 열다섯 문제를 풀어 볼 거야.' },
  { text: '열두 문제 이상 맞히면 100일 완성이야. 못 넘어도 괜찮아, 틀린 곳만 다시 하면 돼!' },
];
/** Day 50: 절반을 지나며 하는 중간 점검 */
const BOSS_INTRO_MID: IntroCard[] = [
  { text: '50일 중간 점검 보스야! 지금까지 배운 것을 모아서 열다섯 문제를 풀어 볼 거야.' },
  { text: '열두 문제 이상 맞히면 통과야. 못 넘어도 괜찮아, 틀린 곳만 다시 하면 돼!' },
];
const BOSS_INTRO_FIRST: IntroCard[] = [
  { text: '첫 번째 보스 도전! 지금까지 배운 것으로 열다섯 문제를 풀어 볼 거야.' },
  { text: '열두 문제 이상 맞히면 통과야. 못 넘어도 괜찮아, 틀린 곳만 다시 하면 돼!' },
];

/** 하루치 수업. 아직 만들지 않은 날이면 null. opt는 보호자가 켠 선택 과제 */
export function lessonFor(day: number, opt: OptionalOn = OPTIONAL_OFF): Lesson | null {
  if (!Number.isInteger(day) || day < 1 || day > TOTAL_DAYS) return null;
  const block = blockOf(day);
  const idx = idxInBlock(day);
  const b = blockDef(block);
  if (!b.ready) return null;
  if (idx === 5) {
    return {
      day,
      block,
      idx,
      kind: 'boss',
      title: day === 100 ? '100일 완성 최종 보스' : day === 50 ? `${b.title} 보스 도전 · 중간 점검` : `${b.title} 보스 도전`,
      buddy: 'bear',
      intro: block === 1 ? BOSS_INTRO_FIRST : day === 50 ? BOSS_INTRO_MID : day === 100 ? BOSS_INTRO_FINAL : BOSS_INTRO,
      explore: [],
      game: null,
      tip: '보스전은 한 번에 통과하지 못해도 괜찮아요. 틀린 문제 유형만 골라 다시 풀게 되어 있어요.',
      newSkills: [],
    };
  }
  const def = DAY_MAP.get(day);
  if (!def) return null;
  const { body: d, optional } = bodyOf(def, opt);
  return {
    day,
    block,
    idx,
    kind: d.kind,
    title: d.title,
    buddy: d.buddy,
    intro: d.intro,
    explore: d.explore,
    game: d.game,
    tip: d.tip,
    newSkills: newSkillsIn(day, d),
    ...(optional ? { optional } : {}),
  };
}

export function gameIdOf(skill: string): GameId | undefined {
  return getSkill(skill).game;
}

// ---------------------------------------------------------------------------
// 보스전 구성
// ---------------------------------------------------------------------------

const QUOTA_NORMAL = [3, 2, 3, 2];
const QUOTA_FIRST = [4, 4, 4, 3];

/** quota를 가중치에 비례해 정수로 나눈다(가장 큰 나머지 순). 합은 항상 quota. */
export function allocate(quota: number, weights: number[]): number[] {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total === 0 || weights.length === 0) return weights.map(() => 0);
  const raw = weights.map((w) => (quota * w) / total);
  const base = raw.map(Math.floor);
  let left = quota - base.reduce((a, b) => a + b, 0);
  const order = raw.map((x, i) => ({ i, rem: x - Math.floor(x) })).sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (const o of order) {
    if (left <= 0) break;
    base[o.i] = (base[o.i] as number) + 1;
    left--;
  }
  return base;
}

export function bossSpec(block: number, opt: OptionalOn = OPTIONAL_OFF): BossSpec | null {
  if (!Number.isInteger(block) || block < 1 || block > BLOCK_COUNT || !blockDef(block).ready) return null;
  const quotas = block === 1 ? QUOTA_FIRST : QUOTA_NORMAL;
  const first = firstDayOf(block);
  const current: BossPart[] = [];
  for (let k = 0; k < 4; k++) {
    const def = DAY_MAP.get(first + k);
    if (!def) continue;
    const d = bodyOf(def, opt).body;
    const weight = new Map<string, number>();
    for (const u of d.explore) {
      if (getSkill(u.skill).noBoss) continue;
      weight.set(u.skill, (weight.get(u.skill) ?? 0) + u.n);
    }
    const skills = [...weight.keys()];
    const counts = allocate(quotas[k] as number, skills.map((s) => weight.get(s) as number));
    skills.forEach((s, i) => {
      const n = counts[i] as number;
      if (n <= 0) return;
      const existing = current.find((c) => c.skill === s);
      if (existing) existing.n += n;
      else current.push({ skill: s, n });
    });
  }
  return { block, current, previousCount: block === 1 ? 0 : 5 };
}

/** 앞 블록들에서 나온 스킬 중 보스전에 쓸 수 있는 것(오래된 순) */
export function skillsBefore(block: number, opt: OptionalOn = OPTIONAL_OFF): string[] {
  const out: string[] = [];
  for (let b = 1; b < block; b++) {
    for (let k = 0; k < 4; k++) {
      const def = DAY_MAP.get(firstDayOf(b) + k);
      if (!def) continue;
      for (const u of bodyOf(def, opt).body.explore) {
        if (!getSkill(u.skill).noBoss && !out.includes(u.skill)) out.push(u.skill);
      }
    }
  }
  return out;
}

/** 수업 데이터가 가리키는 스킬이 모두 등록되어 있는지 점검할 때 쓴다 */
export function referencedSkills(): string[] {
  const out = new Set<string>();
  for (const d of AUTHORED) {
    for (const body of d.off ? [d, d.off.body] : [d]) {
      for (const u of body.explore) out.add(u.skill);
      out.add(body.game.skill);
    }
  }
  return [...out];
}

export function authoredDays(): DayDef[] {
  return AUTHORED;
}
