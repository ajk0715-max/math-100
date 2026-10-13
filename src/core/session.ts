import { BLOCK_DAYS, blockOf, bossSpec, firstDayOf, idxInBlock, lessonFor, type Lesson } from './curriculum';
import type { Profile, ReviewTask, SkillStat } from './model';
import { newSkillStat } from './model';
import { generate, type GenEnv } from './question';
import { hashSeed, makeRng, shuffle } from './rng';
import { getSkill } from './skills';
import type { Level, Question } from './types';

export type Section = 'warmup' | 'explore' | 'game' | 'boss';

/** 한 문제 자리. 풀기 전에는 단계와 시드만 정해져 있고, 푼 뒤에는 결과가 채워진다. */
export interface Slot {
  id: number;
  section: Section;
  skill: string;
  seed: number;
  level?: Level;
  maxLevel?: Level;
  /** 앞 블록에서 가져온 보스전 문제 */
  prev?: boolean;
  /** 복습 일정에서 온 문제 */
  review?: boolean;
  /** 약점으로 표시되어 넣은 문제 */
  weak?: boolean;
  done?: boolean;
  correctFirst?: boolean;
  tries?: number;
  revealed?: boolean;
  hinted?: boolean;
  ms?: number;
}

export interface Plan {
  day: number;
  kind: 'lesson' | 'boss';
  /** 같은 날을 다시 풀 때마다 올라가는 번호. 시드가 달라진다. */
  run: number;
  slots: Slot[];
  /** 보스 재도전일 때, 처음 시도가 아닌 경우 */
  retry?: boolean;
}

const WARMUP_TOTAL = 6;
const REVIEW_PER_SKILL = 3;
const WEAK_THRESHOLD = 3;

export function seedFor(profile: Pick<Profile, 'seedSalt'>, day: number, run: number, idx: number): number {
  return (hashSeed(profile.seedSalt, day, run, idx) % 1_000_000_000) + 1;
}

// ---------------------------------------------------------------------------
// 단계 조절
// ---------------------------------------------------------------------------

export function resolveLevel(stat: SkillStat | undefined, maxLevel?: Level): Level {
  const l = stat?.level ?? 1;
  return Math.min(l, maxLevel ?? 3) as Level;
}

export interface AttemptInfo {
  correctFirst: boolean;
  confusion?: string | null;
}

/** 한 문제를 푼 결과를 스킬 기록에 반영한다. 연속 3번 맞히면 한 단계 위, 연속 2번 틀리면 한 단계 아래. */
export function applyAttempt(stat: SkillStat | undefined, day: number, info: AttemptInfo): SkillStat {
  const s: SkillStat = { ...(stat ?? newSkillStat(day)), confusions: { ...(stat?.confusions ?? {}) } };
  s.seen += 1;
  s.lastDay = day;
  if (info.correctFirst) {
    s.right += 1;
    s.streakRight += 1;
    s.streakWrong = 0;
    s.autoHint = false;
    if (s.streakRight >= 3 && s.level < 3) {
      s.level = (s.level + 1) as Level;
      s.streakRight = 0;
    }
  } else {
    s.streakWrong += 1;
    s.streakRight = 0;
    if (info.confusion) s.confusions[info.confusion] = (s.confusions[info.confusion] ?? 0) + 1;
    if (s.streakWrong >= 2) {
      if (s.level > 1) s.level = (s.level - 1) as Level;
      s.autoHint = true;
      s.streakWrong = 0;
    }
  }
  return s;
}

// ---------------------------------------------------------------------------
// 복습 일정과 약점
// ---------------------------------------------------------------------------

export const REVIEW_OFFSETS: readonly [1 | 2 | 3, number][] = [
  [1, 1],
  [2, 3],
  [3, 7],
];

/** 새로 배운 스킬의 복습을 +1일, +3일, +7일 뒤에 예약한다 */
export function scheduleReviews(day: number, skills: string[]): ReviewTask[] {
  const out: ReviewTask[] = [];
  for (const skill of skills) {
    if (getSkill(skill).noBoss) continue;
    for (const [stage, off] of REVIEW_OFFSETS) out.push({ skill, due: day + off, stage });
  }
  return out;
}

export interface WeakSpot {
  label: string;
  skill: string;
  count: number;
}

/** 같은 혼동이 3번 이상 쌓인 것들(많은 순) */
export function weakSpots(profile: Pick<Profile, 'skills'>): WeakSpot[] {
  const out: WeakSpot[] = [];
  for (const [skill, st] of Object.entries(profile.skills)) {
    for (const [label, count] of Object.entries(st.confusions)) {
      if (count >= WEAK_THRESHOLD) out.push({ label, skill, count });
    }
  }
  return out.sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// 계획 만들기
// ---------------------------------------------------------------------------

interface Want {
  skill: string;
  n: number;
  review?: boolean;
  weak?: boolean;
}

/** 직전 수업(보스 제외)의 스킬들 */
function previousLesson(day: number): Lesson | null {
  for (let d = day - 1; d >= Math.max(1, day - 3); d--) {
    if (idxInBlock(d) === 5) continue;
    const l = lessonFor(d);
    if (l && l.kind !== 'boss') return l;
  }
  return null;
}

export function warmupWants(profile: Profile, day: number): Want[] {
  const wants: Want[] = [];
  let total = 0;
  const add = (w: Want) => {
    wants.push(w);
    total += w.n;
  };

  // 1) 복습 예정(오래된 것부터, 스킬당 3문제, 최대 두 스킬)
  const due = profile.reviews.filter((r) => r.due <= day).sort((a, b) => a.due - b.due || a.stage - b.stage);
  const skillsDue: string[] = [];
  for (const r of due) if (!skillsDue.includes(r.skill)) skillsDue.push(r.skill);
  for (const skill of skillsDue.slice(0, 2)) add({ skill, n: REVIEW_PER_SKILL, review: true });

  // 2) 약점(한 스킬, 2문제)
  const weak = weakSpots(profile).find((w) => !wants.some((x) => x.skill === w.skill) && !getSkill(w.skill).game);
  if (weak && total + 2 <= WARMUP_TOTAL) add({ skill: weak.skill, n: 2, weak: true });

  // 3) 직전 수업 스킬로 채우기
  const prev = previousLesson(day);
  if (prev && total < WARMUP_TOTAL) {
    const pool = [...new Set(prev.explore.map((u) => u.skill))].filter((s) => !getSkill(s).noBoss && !wants.some((x) => x.skill === s));
    if (pool.length) {
      const left = WARMUP_TOTAL - total;
      const each = Math.max(1, Math.ceil(left / pool.length));
      for (const s of pool) {
        const n = Math.min(each, WARMUP_TOTAL - total);
        if (n > 0) add({ skill: s, n });
      }
    }
  }
  return wants;
}

export function buildLessonPlan(profile: Profile, day: number, run: number): Plan | null {
  const lesson = lessonFor(day);
  if (!lesson || lesson.kind === 'boss') return null;
  const slots: Slot[] = [];
  let id = 0;
  const push = (s: Omit<Slot, 'id' | 'seed'>) => {
    slots.push({ ...s, id, seed: seedFor(profile, day, run, id) });
    id++;
  };
  for (const w of warmupWants(profile, day)) {
    for (let i = 0; i < w.n; i++) push({ section: 'warmup', skill: w.skill, maxLevel: 2, review: w.review, weak: w.weak });
  }
  for (const u of lesson.explore) {
    for (let i = 0; i < u.n; i++) push({ section: 'explore', skill: u.skill, maxLevel: u.maxLevel });
  }
  if (lesson.game) {
    for (const lv of lesson.game.levels) push({ section: 'game', skill: lesson.game.skill, level: lv });
  }
  return { day, kind: 'lesson', run, slots };
}

function skillsOfBlock(block: number): string[] {
  const out: string[] = [];
  const first = firstDayOf(block);
  for (let k = 0; k < BLOCK_DAYS - 1; k++) {
    const l = lessonFor(first + k);
    if (!l) continue;
    for (const u of l.explore) if (!getSkill(u.skill).noBoss && !out.includes(u.skill)) out.push(u.skill);
  }
  return out;
}

/** 보스전 계획. retryFrom이 있으면 틀린 유형만 다시 낸다. */
export function buildBossPlan(profile: Profile, block: number, run: number, retryFrom?: { skill: string; wrong: number }[]): Plan | null {
  const spec = bossSpec(block);
  if (!spec) return null;
  const day = block * BLOCK_DAYS;
  const rng = makeRng(profile.seedSalt, 'boss', block, run);
  const parts: { skill: string; prev?: boolean }[] = [];

  if (retryFrom) {
    for (const r of retryFrom) for (let i = 0; i < Math.max(1, r.wrong); i++) parts.push({ skill: r.skill });
  } else {
    for (const p of spec.current) for (let i = 0; i < p.n; i++) parts.push({ skill: p.skill });
    if (spec.previousCount > 0) {
      const pool = skillsOfBlock(block - 1);
      for (let i = 0; i < spec.previousCount && pool.length; i++) parts.push({ skill: pool[i % pool.length] as string, prev: true });
    }
  }
  const ordered = shuffle(rng, parts);
  const slots: Slot[] = ordered.map((p, id) => ({
    id,
    section: 'boss',
    skill: p.skill,
    seed: seedFor(profile, day, run, id),
    maxLevel: 2,
    ...(p.prev ? { prev: true } : {}),
  }));
  return { day, kind: 'boss', run, slots, ...(retryFrom ? { retry: true } : {}) };
}

// ---------------------------------------------------------------------------
// 문제 꺼내기
// ---------------------------------------------------------------------------

export function fingerprint(q: Question): string {
  return JSON.stringify({ p: q.prompt, v: q.visual, a: q.answer });
}

/** 슬롯의 문제를 만든다. 이미 나온 문제와 같으면 시드를 바꿔 다시 뽑는다(최대 12번). */
export function materialize(slot: Slot, level: Level, env: GenEnv, used: Set<string>): { q: Question; seed: number } {
  let last: { q: Question; seed: number } | null = null;
  for (let i = 0; i < 12; i++) {
    const seed = slot.seed + i * 7919;
    const q = generate({ skill: slot.skill, level, seed }, env);
    last = { q, seed };
    const key = fingerprint(q);
    if (!used.has(key)) {
      used.add(key);
      return last;
    }
  }
  return last as { q: Question; seed: number };
}

// ---------------------------------------------------------------------------
// 보상 계산과 마무리
// ---------------------------------------------------------------------------

export const STARS_LESSON = 5;
export const STARS_BOSS = 10;
export const BOSS_PASS = 0.8;

export function bossPassed(correct: number, total: number): boolean {
  return total > 0 && correct / total >= BOSS_PASS - 1e-9;
}

export interface BossOutcome {
  correct: number;
  total: number;
  passed: boolean;
  wrongBySkill: { skill: string; wrong: number }[];
}

export function bossOutcome(slots: Slot[]): BossOutcome {
  const done = slots.filter((s) => s.done);
  const correct = done.filter((s) => s.correctFirst).length;
  const wrong = new Map<string, number>();
  for (const s of done) if (!s.correctFirst) wrong.set(s.skill, (wrong.get(s.skill) ?? 0) + 1);
  return {
    correct,
    total: done.length,
    passed: bossPassed(correct, done.length),
    wrongBySkill: [...wrong.entries()].map(([skill, w]) => ({ skill, wrong: w })),
  };
}

export interface LessonSummary {
  total: number;
  correctFirst: number;
  revealed: number;
}

export function lessonSummary(slots: Slot[]): LessonSummary {
  const graded = slots.filter((s) => s.done && s.section !== 'game');
  return {
    total: graded.length,
    correctFirst: graded.filter((s) => s.correctFirst).length,
    revealed: graded.filter((s) => s.revealed).length,
  };
}

/** 수업을 마친 뒤의 프로필: 날 진행, 별, 복습 예약과 소화한 복습 정리 */
export function finishLesson(profile: Profile, plan: Plan, today: string, firstOfDay: boolean): Profile {
  const lesson = lessonFor(plan.day);
  const reviewedSkills = new Set(plan.slots.filter((s) => s.done && s.review).map((s) => s.skill));
  const reviews = profile.reviews.filter((r) => !(r.due <= plan.day && reviewedSkills.has(r.skill)));
  const added = lesson ? scheduleReviews(plan.day, lesson.newSkills) : [];
  const fresh = !profile.doneDays.includes(plan.day);
  const stars = firstOfDay && fresh ? STARS_LESSON : 0;
  // 약점 문제를 풀었으면 그 혼동 횟수를 비운다(다시 쌓이면 다시 표시된다)
  const skills = { ...profile.skills };
  for (const s of plan.slots) {
    if (s.done && s.weak && skills[s.skill]) {
      skills[s.skill] = { ...(skills[s.skill] as SkillStat), confusions: {} };
    }
  }
  return {
    ...profile,
    day: Math.max(profile.day, Math.min(plan.day + 1, 100)),
    doneDays: fresh ? [...profile.doneDays, plan.day] : profile.doneDays,
    stars: profile.stars + stars,
    starsTotal: profile.starsTotal + stars,
    reviews: [...reviews, ...(fresh ? added : [])],
    skills,
    lastLessonDate: today,
  };
}

/** 보스를 통과한 뒤의 프로필 */
export function finishBoss(profile: Profile, block: number, outcome: BossOutcome, firstAttemptCorrectRate: number, today: string): Profile {
  const day = block * BLOCK_DAYS;
  const prev = profile.blocks[block];
  const fresh = !profile.doneDays.includes(day);
  const gold = firstAttemptCorrectRate >= BOSS_PASS - 1e-9;
  const stars = fresh ? STARS_BOSS : 0;
  const result = {
    tries: (prev?.tries ?? 0) + 1,
    best: Math.max(prev?.best ?? 0, outcome.correct / Math.max(1, outcome.total)),
    passedAt: prev?.passedAt ?? day,
    gold: prev?.gold || gold,
  };
  return {
    ...profile,
    day: Math.max(profile.day, Math.min(day + 1, 100)),
    doneDays: fresh ? [...profile.doneDays, day] : profile.doneDays,
    blocks: { ...profile.blocks, [block]: result },
    stickers: { ...profile.stickers, [block]: profile.stickers[block] === 'gold' || gold ? 'gold' : 'normal' },
    stars: profile.stars + stars,
    starsTotal: profile.starsTotal + stars,
    lastLessonDate: today,
  };
}

/** 보스에서 통과하지 못했을 때 시도 횟수만 기록한다 */
export function recordBossFail(profile: Profile, block: number, correct: number, total: number): Profile {
  const prev = profile.blocks[block];
  return {
    ...profile,
    blocks: {
      ...profile.blocks,
      [block]: {
        tries: (prev?.tries ?? 0) + 1,
        best: Math.max(prev?.best ?? 0, correct / Math.max(1, total)),
        gold: prev?.gold ?? false,
        ...(prev?.passedAt ? { passedAt: prev.passedAt } : {}),
      },
    },
  };
}

export { blockOf };
