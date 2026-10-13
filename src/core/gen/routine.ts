import { josa, timeText, withJosa } from '../ko';
import { chance, int, pick, sample, shuffle, type Rng } from '../rng';
import type { GenCtx, MatchPair, Option, OrderItem, Question, Visual } from '../types';
import { clockPick, clockVis } from './clock';
import { buildChoice, mk, shuffleDiff } from './util';

// ---------------------------------------------------------------------------
// 하루 일과
// ---------------------------------------------------------------------------

interface Step {
  key: string;
  emoji: string;
  label: string;
}

/** 아침부터 밤까지, 먼저 하는 순서 */
export const DAY: Step[] = [
  { key: 'wake', emoji: '⏰', label: '일어나기' },
  { key: 'wash', emoji: '🧼', label: '세수하기' },
  { key: 'breakfast', emoji: '🍚', label: '아침밥 먹기' },
  { key: 'school', emoji: '🎒', label: '학교 가기' },
  { key: 'lunch', emoji: '🍱', label: '점심 먹기' },
  { key: 'play', emoji: '🛝', label: '놀이터에서 놀기' },
  { key: 'dinner', emoji: '🍲', label: '저녁밥 먹기' },
  { key: 'bath', emoji: '🛁', label: '목욕하기' },
  { key: 'sleep', emoji: '🛌', label: '잠자기' },
];

const stepOpt = (s: Step): Option => ({ key: s.key, text: `${s.emoji} ${s.label}`, say: s.label });
const stepItem = (s: Step): OrderItem => ({ key: s.key, text: `${s.emoji} ${s.label}`, say: s.label });
const at = (i: number): Step => DAY[i] as Step;

/** 0~8 중 서로 간격이 gap 이상 벌어진 n개(오름차순) */
function spacedIdx(r: Rng, n: number, gap: number): number[] {
  for (let t = 0; t < 60; t++) {
    const idx = sample(r, DAY.map((_, i) => i), n).sort((a, b) => a - b);
    if (idx.every((v, i) => i === 0 || v - (idx[i - 1] as number) >= gap)) return idx;
  }
  return n === 3 ? [0, 4, 8] : n === 4 ? [0, 3, 5, 8] : [0, 2, 4, 6, 8];
}

function orderQ(c: GenCtx, n: number, gap: number): Question {
  const r = c.rng;
  const steps = spacedIdx(r, n, gap).map(at);
  const correct = steps.map((s) => s.key);
  return mk(c, {
    prompt: '하루에 하는 일을 먼저 하는 것부터 차례대로 눌러 보세요.',
    say: '하루에 하는 일을 먼저 하는 것부터 차례대로 눌러 보세요.',
    answer: { t: 'order', items: shuffleDiff(r, steps.map(stepItem), correct), correct, style: 'cards' },
    hint: { say: '아침에 하는 일이 먼저, 저녁과 밤에 하는 일이 나중이에요. 하루를 아침부터 떠올려 봐요.' },
    explain: `${steps.map((s) => s.label).join(', ')} 순서예요.`,
  });
}

/** anchor 바로 다음에 하는 일 */
function nextQ(c: GenCtx): Question {
  const r = c.rng;
  const i = int(r, 2, DAY.length - 2);
  const a = at(i);
  const next = at(i + 1);
  const earlier = DAY.slice(0, i);
  const wrongs = sample(r, earlier, 2).map(stepOpt);
  const text = `${a.label} 바로 다음에 하는 일은 무엇일까요?`;
  return mk(c, {
    prompt: text,
    say: text,
    answer: buildChoice(r, stepOpt(next), wrongs, 3),
    hint: { say: '하루를 아침부터 떠올려 봐요. 이미 한 일은 지난 일이에요.' },
    explain: `${a.label} 다음에는 ${next.label}${josa(next.label, '이에요/예요')}.`,
  });
}

/** anchor 바로 전에 하는 일 */
function prevQ(c: GenCtx): Question {
  const r = c.rng;
  const i = int(r, 1, DAY.length - 3);
  const a = at(i);
  const prev = at(i - 1);
  const later = DAY.slice(i + 1);
  const wrongs = sample(r, later, 2).map(stepOpt);
  const text = `${a.label} 바로 전에 하는 일은 무엇일까요?`;
  return mk(c, {
    prompt: text,
    say: text,
    answer: buildChoice(r, stepOpt(prev), wrongs, 3),
    hint: { say: '전에 하는 일은 먼저 하는 일이에요. 하루를 거꾸로 떠올려 봐요.' },
    explain: `${a.label} 바로 전에는 ${prev.label}${josa(prev.label, '이에요/예요')}.`,
  });
}

/** 세 가지 중 가장 먼저 / 마지막에 하는 일 */
function extremeQ(c: GenCtx): Question {
  const r = c.rng;
  const idx = spacedIdx(r, 3, 2);
  const steps = shuffle(r, idx.map(at));
  const first = chance(r, 0.5);
  const rightIdx = first ? (idx[0] as number) : (idx[2] as number);
  const right = at(rightIdx);
  const text = `${first ? '가장 먼저' : '가장 나중에'} 하는 일은 무엇일까요?`;
  return mk(c, {
    prompt: text,
    say: text,
    visual: { k: 'routine', items: steps.map((s) => ({ emoji: s.emoji, label: s.label })) },
    answer: buildChoice(r, stepOpt(right), steps.filter((s) => s !== right).map(stepOpt), 3),
    hint: { say: first ? '아침에 하는 일일수록 먼저 해요.' : '밤에 가까운 일일수록 나중에 해요.' },
    explain: `${idx.map((i) => at(i).label).join(', ')} 순서예요. ${first ? '가장 먼저' : '가장 나중에'} 하는 일은 ${right.label}${josa(right.label, '이에요/예요')}.`,
  });
}

export function routineGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  if (L === 1) return chance(r, 0.6) ? orderQ(c, 3, 3) : nextQ(c);
  if (L === 2) return chance(r, 0.5) ? orderQ(c, 4, 2) : chance(r, 0.5) ? nextQ(c) : extremeQ(c);
  const roll = r();
  if (roll < 0.34) return orderQ(c, 5, 1);
  if (roll < 0.58) return prevQ(c);
  if (roll < 0.8) return nextQ(c);
  return extremeQ(c);
}

// ---------------------------------------------------------------------------
// 일과와 시각
// ---------------------------------------------------------------------------

interface Slot {
  step: Step;
  /** 낮 24시간제로 쓴 후보 시각 [시, 분] */
  times: [number, number][];
  /** 30분 후보(3단계에서만 쓴다) */
  halves: [number, number][];
}

const SLOTS: Slot[] = [
  { step: at(0), times: [[6, 0], [7, 0]], halves: [[6, 30], [7, 30]] },
  { step: at(2), times: [[7, 0], [8, 0]], halves: [[7, 30], [8, 30]] },
  { step: at(3), times: [[8, 0], [9, 0]], halves: [[8, 30]] },
  { step: at(4), times: [[12, 0], [13, 0]], halves: [[12, 30]] },
  { step: at(5), times: [[15, 0], [16, 0]], halves: [[15, 30], [16, 30]] },
  { step: at(6), times: [[17, 0], [18, 0]], halves: [[17, 30], [18, 30]] },
  { step: at(7), times: [[19, 0], [20, 0]], halves: [[19, 30]] },
  { step: at(8), times: [[20, 0], [21, 0]], halves: [[20, 30], [21, 30]] },
];

const to12 = (h: number): number => ((h - 1 + 12) % 12) + 1;
const minutesOf = (t: [number, number]): number => t[0] * 60 + t[1];

export interface Planned {
  step: Step;
  /** 시계에 보이는 시(1~12) */
  h: number;
  m: number;
  /** 하루 안에서 순서를 따질 때 쓰는 24시간제 시 */
  h24: number;
}

/** 어떤 조합으로도 막히지 않는 기본 일과표(앞에서부터 n개를 쓴다) */
const SAFE: { slot: number; time: [number, number]; half: [number, number] }[] = [
  { slot: 0, time: [7, 0], half: [7, 30] },
  { slot: 3, time: [12, 0], half: [12, 30] },
  { slot: 4, time: [15, 0], half: [15, 30] },
  { slot: 5, time: [18, 0], half: [18, 30] },
  { slot: 7, time: [21, 0], half: [21, 30] },
];

/** 하루 일과표에서 n개를 골라 시각을 정한다. 순서대로 시각이 늘어나고, 시계 그림이 겹치지 않는다. */
export function planDay(r: Rng, n: number, halves: boolean): Planned[] {
  const optionsOf = (s: Slot): [number, number][] => (halves ? [...s.times, ...s.halves] : s.times);
  for (let outer = 0; outer < 40; outer++) {
    const slots = sample(r, SLOTS, n).sort((a, b) => SLOTS.indexOf(a) - SLOTS.indexOf(b));
    for (let t = 0; t < 60; t++) {
      const chosen = slots.map((s) => pick(r, optionsOf(s)));
      const increasing = chosen.every((x, i) => i === 0 || minutesOf(x) > minutesOf(chosen[i - 1] as [number, number]));
      const faces = new Set(chosen.map(([h, m]) => `${to12(h)}:${m}`));
      const hasHalf = !halves || chosen.some((x) => x[1] === 30);
      if (increasing && hasHalf && faces.size === chosen.length) {
        return slots.map((s, i) => ({ step: s.step, h: to12((chosen[i] as [number, number])[0]), m: (chosen[i] as [number, number])[1], h24: (chosen[i] as [number, number])[0] }));
      }
    }
  }
  return SAFE.slice(0, n).map((x, i) => {
    const t = halves && i === 0 ? x.half : x.time;
    return { step: (SLOTS[x.slot] as Slot).step, h: to12(t[0]), m: t[1], h24: t[0] };
  });
}

const tableOf = (plan: Planned[]): Visual => ({
  k: 'routine',
  items: plan.map((p) => ({ emoji: p.step.emoji, label: p.step.label, time: timeText(p.h, p.m) })),
});

export function routineTimeGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;

  if (L === 1) {
    const plan = planDay(r, 3, false);
    const target = pick(r, plan);
    // 보기는 일과표에 나온 다른 시각들과 가까운 시각
    const wrongs = plan.filter((p) => p !== target).map((p) => clockPick(p.h, p.m));
    const extra = clockPick(((target.h + (chance(r, 0.5) ? 0 : 1)) % 12) + 1, 0);
    const text = `일과표를 보고 ${target.step.label} 시각의 시계를 골라 보세요.`;
    return mk(c, {
      prompt: text,
      say: text,
      visual: tableOf(plan),
      answer: buildChoice(r, clockPick(target.h, target.m), [...wrongs, extra], 3, 3),
      hint: { say: '일과표에서 그 일의 시각을 읽고, 짧은바늘이 그 숫자를 가리키는 시계를 찾아요.' },
      explain: `${withJosa(target.step.label, '은/는')} ${timeText(target.h, target.m)}${josa(timeText(target.h, target.m), '이에요/예요')}. 긴바늘과 짧은바늘이 그 시각을 가리키는 시계예요.`,
    });
  }

  if (L === 2) {
    const plan = planDay(r, 4, false);
    const target = pick(r, plan);
    const text = '시계가 가리키는 시각에는 무엇을 할까요? 일과표에서 찾아보세요.';
    return mk(c, {
      prompt: text,
      say: text,
      visual: { k: 'col', items: [clockVis(target.h, target.m, { size: 'md' }), tableOf(plan)], gap: 10 },
      answer: buildChoice(r, stepOpt(target.step), plan.filter((p) => p !== target).map((p) => stepOpt(p.step)), 3),
      hint: { say: '짧은바늘이 가리키는 숫자를 읽고, 일과표에서 같은 시각을 찾아요.' },
      explain: `${timeText(target.h, target.m)}에는 ${target.step.label}${josa(target.step.label, '이에요/예요')}.`,
    });
  }

  const plan = planDay(r, 4, true);
  const pairs: MatchPair[] = plan.map((p) => ({
    key: p.step.key,
    a: { text: `${p.step.emoji} ${p.step.label}` },
    b: { visual: clockVis(p.h, p.m, { size: 'sm' }) },
  }));
  const text = '일과표를 보고 하는 일과 알맞은 시계를 이어 보세요.';
  return mk(c, {
    prompt: text,
    say: text,
    visual: tableOf(plan),
    answer: { t: 'match', pairs },
    hint: { say: '일과표에서 시각을 읽어요. 긴바늘이 6이면 30분, 12이면 정각이에요.' },
    explain: '일과표의 시각과 같은 시각을 가리키는 시계를 이었어요.',
  });
}

/** 보너스 게임: 일과 카드와 시계 이어 주기 */
export function routineMatchGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  const plan = planDay(r, L === 1 ? 3 : 4, L === 3);
  const pairs: MatchPair[] = plan.map((p) => ({
    key: p.step.key,
    a: { text: `${p.step.emoji} ${p.step.label}` },
    b: { visual: clockVis(p.h, p.m, { size: 'sm' }) },
  }));
  const text = '일과표를 보고 하는 일과 알맞은 시계를 이어 보세요.';
  return mk(c, {
    prompt: text,
    say: text,
    visual: tableOf(plan),
    answer: { t: 'match', pairs },
    hint: { say: '일과표에서 시각을 읽어요. 긴바늘이 6이면 30분, 12이면 정각이에요.' },
    explain: '일과표의 시각과 같은 시각을 가리키는 시계를 이었어요.',
  });
}
