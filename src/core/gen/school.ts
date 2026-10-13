import { WEEKDAYS_LONG } from '../dates';
import { josa, timeText, withJosa } from '../ko';
import { chance, int, pick, sample, shuffle, type Rng } from '../rng';
import type { GenCtx, MatchPair, Option, OrderItem, Question, Visual } from '../types';
import { clockPick, clockVis, wrap12 } from './clock';
import { buildChoice, mk, numChoice, shuffleDiff } from './util';

// ---------------------------------------------------------------------------
// 학교 시간표
// ---------------------------------------------------------------------------

interface Subject {
  key: string;
  ko: string;
  emoji: string;
}

export const SUBJECTS: Subject[] = [
  { key: 'korean', ko: '국어', emoji: '📖' },
  { key: 'math', ko: '수학', emoji: '🔢' },
  { key: 'life', ko: '통합', emoji: '🌱' },
  { key: 'music', ko: '음악', emoji: '🎵' },
  { key: 'art', ko: '미술', emoji: '🎨' },
  { key: 'pe', ko: '체육', emoji: '🏃' },
];

const subjOpt = (s: Subject): Option => ({ key: s.key, text: `${s.emoji} ${s.ko}`, say: s.ko });
const periodOpt = (n: number): Option => ({ key: String(n), text: `${n}교시`, say: `${n}교시` });

interface Day {
  name: string;
  subjects: Subject[];
}

function makeDay(r: Rng, n: number): Day {
  const wd = int(r, 1, 5);
  return { name: WEEKDAYS_LONG[wd] as string, subjects: sample(r, SUBJECTS, n) };
}

const tableVis = (d: Day): Visual => ({
  k: 'timetable',
  day: d.name,
  periods: d.subjects.map((s, i) => ({ label: `${i + 1}교시`, subject: s.ko, emoji: s.emoji })),
});

function whichSubjectQ(c: GenCtx, d: Day): Question {
  const r = c.rng;
  const p = int(r, 1, d.subjects.length);
  const target = d.subjects[p - 1] as Subject;
  const rest = d.subjects.filter((s) => s !== target);
  const outside = SUBJECTS.filter((s) => !d.subjects.includes(s));
  const wrongs = [...shuffle(r, rest), ...shuffle(r, outside)].map(subjOpt);
  const text = `${p}교시에는 무슨 수업을 할까요?`;
  return mk(c, {
    prompt: text,
    say: text,
    visual: tableVis(d),
    answer: buildChoice(r, subjOpt(target), wrongs, 3),
    hint: { say: `시간표에서 ${p}교시 줄을 찾고, 오른쪽에 적힌 수업을 읽어요.` },
    explain: `${p}교시는 ${target.ko}${josa(target.ko, '이에요/예요')}.`,
  });
}

function whichPeriodQ(c: GenCtx, d: Day): Question {
  const r = c.rng;
  const p = int(r, 1, d.subjects.length);
  const target = d.subjects[p - 1] as Subject;
  const n = d.subjects.length;
  const wrongs = [p - 1, p + 1, p + 2, p - 2].filter((v) => v >= 1 && v <= n && v !== p).map(periodOpt);
  const text = `${withJosa(target.ko, '은/는')} 몇 교시일까요?`;
  return mk(c, {
    prompt: text,
    say: text,
    visual: tableVis(d),
    answer: buildChoice(r, periodOpt(p), wrongs, 3),
    hint: { say: `시간표에서 ${target.ko}${josa(target.ko, '을/를')} 찾고, 왼쪽에 적힌 교시를 읽어요.` },
    explain: `${withJosa(target.ko, '은/는')} ${p}교시예요.`,
  });
}

function nextSubjectQ(c: GenCtx, d: Day, dir: 'next' | 'prev'): Question {
  const r = c.rng;
  const n = d.subjects.length;
  const i = dir === 'next' ? int(r, 0, n - 2) : int(r, 1, n - 1);
  const anchor = d.subjects[i] as Subject;
  const target = d.subjects[dir === 'next' ? i + 1 : i - 1] as Subject;
  const rest = d.subjects.filter((s) => s !== anchor && s !== target);
  const outside = SUBJECTS.filter((s) => !d.subjects.includes(s));
  const wrongs = [...shuffle(r, rest), ...shuffle(r, outside)].map(subjOpt);
  const where = dir === 'next' ? '다음' : '바로 앞';
  const text = `${anchor.ko} ${where} 시간은 무슨 수업일까요?`;
  return mk(c, {
    prompt: text,
    say: text,
    visual: tableVis(d),
    answer: buildChoice(r, subjOpt(target), wrongs, 3),
    hint: { say: dir === 'next' ? `${anchor.ko} 줄에서 아래로 한 칸 내려가 봐요.` : `${anchor.ko} 줄에서 위로 한 칸 올라가 봐요.` },
    explain: `${anchor.ko} ${where} 시간은 ${target.ko}${josa(target.ko, '이에요/예요')}.`,
  });
}

function edgeQ(c: GenCtx, d: Day): Question {
  const r = c.rng;
  const first = chance(r, 0.5);
  const n = d.subjects.length;
  const target = d.subjects[first ? 0 : n - 1] as Subject;
  const wrongs = shuffle(
    r,
    d.subjects.filter((s) => s !== target),
  ).map(subjOpt);
  const text = first ? '오늘 첫 번째로 하는 수업은 무엇일까요?' : '오늘 마지막으로 하는 수업은 무엇일까요?';
  return mk(c, {
    prompt: text,
    say: text,
    visual: tableVis(d),
    answer: buildChoice(r, subjOpt(target), wrongs, 3),
    hint: { say: first ? '시간표의 맨 위 줄을 읽어요.' : '시간표의 맨 아래 줄을 읽어요.' },
    explain: `${first ? '첫 번째' : '마지막'} 수업은 ${target.ko}${josa(target.ko, '이에요/예요')}.`,
  });
}

function totalQ(c: GenCtx, d: Day): Question {
  const r = c.rng;
  const n = d.subjects.length;
  const text = `${d.name}에는 수업이 모두 몇 교시까지 있을까요?`;
  return mk(c, {
    prompt: text,
    say: text,
    visual: tableVis(d),
    answer: numChoice(r, n, 3, 6, { say: (v) => `${v}교시`, text: (v) => `${v}교시` }),
    hint: { say: '시간표의 맨 아래 줄에 적힌 교시를 읽어요.' },
    explain: `${n}교시까지 있어요.`,
  });
}

function betweenQ(c: GenCtx, d: Day): Question {
  const r = c.rng;
  const n = d.subjects.length;
  const i = int(r, 0, n - 3);
  const a = d.subjects[i] as Subject;
  const b = d.subjects[i + 2] as Subject;
  const mid = d.subjects[i + 1] as Subject;
  const rest = d.subjects.filter((s) => s !== a && s !== b && s !== mid);
  const outside = SUBJECTS.filter((s) => !d.subjects.includes(s));
  const wrongs = [...shuffle(r, rest), ...shuffle(r, outside)].map(subjOpt);
  const text = `${a.ko}${josa(a.ko, '과/와')} ${b.ko} 사이에 있는 수업은 무엇일까요?`;
  return mk(c, {
    prompt: text,
    say: text,
    visual: tableVis(d),
    answer: buildChoice(r, subjOpt(mid), wrongs, 3),
    hint: { say: `${a.ko}${josa(a.ko, '과/와')} ${b.ko}${josa(b.ko, '을/를')} 찾고, 그 가운데 줄을 읽어요.` },
    explain: `${a.ko}${josa(a.ko, '과/와')} ${b.ko} 사이는 ${mid.ko}${josa(mid.ko, '이에요/예요')}.`,
  });
}

function gapQ(c: GenCtx, d: Day): Question {
  const r = c.rng;
  const n = d.subjects.length;
  const i = int(r, 0, n - 3);
  const j = int(r, i + 2, n - 1);
  const a = d.subjects[i] as Subject;
  const b = d.subjects[j] as Subject;
  const gap = j - i - 1;
  const text = `${a.ko}${josa(a.ko, '과/와')} ${b.ko} 사이에는 수업이 몇 번 있을까요?`;
  return mk(c, {
    prompt: text,
    say: text,
    visual: tableVis(d),
    answer: numChoice(r, gap, 1, 4, { say: (v) => `${v}번`, text: (v) => `${v}번` }),
    hint: { say: `${a.ko}${josa(a.ko, '은/는')} ${i + 1}교시, ${b.ko}${josa(b.ko, '은/는')} ${j + 1}교시예요. 두 수업은 빼고, 그 사이의 수업만 세어 봐요.` },
    explain: `${a.ko}${josa(a.ko, '은/는')} ${i + 1}교시, ${b.ko}${josa(b.ko, '은/는')} ${j + 1}교시이니까 그 사이에 수업이 ${gap}번 있어요.`,
  });
}

function beforeCountQ(c: GenCtx, d: Day): Question {
  const r = c.rng;
  const n = d.subjects.length;
  const i = int(r, 1, n - 1);
  const t = d.subjects[i] as Subject;
  const text = `${t.ko} 시간 전에는 수업을 몇 번 할까요?`;
  return mk(c, {
    prompt: text,
    say: text,
    visual: tableVis(d),
    answer: numChoice(r, i, 1, n - 1, { say: (v) => `${v}번`, text: (v) => `${v}번` }),
    hint: { say: `${t.ko}${josa(t.ko, '은/는')} ${i + 1}교시예요. 그 앞의 수업만 세어 봐요.` },
    explain: `${t.ko}${josa(t.ko, '은/는')} ${i + 1}교시이니까 그 전에 ${i}번 수업을 해요.`,
  });
}

export function timetableGen(c: GenCtx): Question {
  const r = c.rng;
  if (c.level === 1) {
    const d = makeDay(r, 3);
    return chance(r, 0.55) ? whichSubjectQ(c, d) : whichPeriodQ(c, d);
  }
  if (c.level === 2) {
    const d = makeDay(r, 4);
    const roll = r();
    if (roll < 0.25) return whichPeriodQ(c, d);
    if (roll < 0.5) return nextSubjectQ(c, d, 'next');
    if (roll < 0.7) return nextSubjectQ(c, d, 'prev');
    if (roll < 0.85) return edgeQ(c, d);
    return totalQ(c, d);
  }
  const d = makeDay(r, chance(r, 0.5) ? 5 : 4);
  const roll = r();
  if (roll < 0.3) return betweenQ(c, d);
  if (roll < 0.55) return gapQ(c, d);
  if (roll < 0.75) return beforeCountQ(c, d);
  if (roll < 0.9) return nextSubjectQ(c, d, 'prev');
  return whichSubjectQ(c, d);
}

// ---------------------------------------------------------------------------
// 학교 가는 날의 하루
// ---------------------------------------------------------------------------

interface SStep {
  key: string;
  emoji: string;
  label: string;
  /** 24시간제 [시, 분] 후보 */
  times: [number, number][];
}

const STEPS: SStep[] = [
  { key: 'wake', emoji: '⏰', label: '일어나기', times: [[7, 0], [6, 30], [7, 30]] },
  { key: 'breakfast', emoji: '🍚', label: '아침밥 먹기', times: [[8, 0], [7, 30]] },
  { key: 'go', emoji: '🚌', label: '학교 가기', times: [[8, 30], [8, 0]] },
  { key: 'class', emoji: '📚', label: '공부 시작', times: [[9, 0]] },
  { key: 'lunch', emoji: '🍱', label: '점심 먹기', times: [[12, 0], [12, 30]] },
  { key: 'home', emoji: '🏠', label: '학교 마치기', times: [[13, 0], [13, 30]] },
];

interface Planned {
  step: SStep;
  h: number;
  m: number;
}

const mins = (t: [number, number]): number => t[0] * 60 + t[1];

/** 하루에서 n개를 골라 시각을 정한다. 순서대로 시각이 늘고, 시계 모습이 겹치지 않는다. halves면 30분이 하나 이상 있다 */
function planSchool(r: Rng, n: number, halves: boolean): Planned[] {
  const usable = (s: SStep): [number, number][] => (halves ? s.times : s.times.filter((t) => t[1] === 0));
  for (let outer = 0; outer < 60; outer++) {
    const picked = sample(r, STEPS, n).sort((a, b) => STEPS.indexOf(a) - STEPS.indexOf(b));
    if (picked.some((s) => usable(s).length === 0)) continue;
    for (let t = 0; t < 40; t++) {
      const chosen = picked.map((s) => pick(r, usable(s)));
      const increasing = chosen.every((x, i) => i === 0 || mins(x) > mins(chosen[i - 1] as [number, number]));
      const faces = new Set(chosen.map(([h, m]) => `${wrap12(h)}:${m}`));
      const hasHalf = !halves || chosen.some((x) => x[1] === 30);
      if (increasing && hasHalf && faces.size === chosen.length) {
        return picked.map((s, i) => ({ step: s, h: wrap12((chosen[i] as [number, number])[0]), m: (chosen[i] as [number, number])[1] }));
      }
    }
  }
  const safe: [string, number, number][] = [
    ['wake', 7, 0],
    ['go', 8, 0],
    ['class', 9, 0],
    ['lunch', 12, 0],
    ['home', 1, 0],
  ];
  return safe.slice(0, n).map(([k, h, m]) => ({ step: STEPS.find((s) => s.key === k) as SStep, h, m }));
}

const dayTable = (plan: Planned[]): Visual => ({
  k: 'routine',
  items: plan.map((p) => ({ emoji: p.step.emoji, label: p.step.label, time: timeText(p.h, p.m) })),
});
const stepOpt = (s: SStep): Option => ({ key: s.key, text: `${s.emoji} ${s.label}`, say: s.label });
const stepItem = (s: SStep): OrderItem => ({ key: s.key, text: `${s.emoji} ${s.label}`, say: s.label });

function clockOfStepQ(c: GenCtx, plan: Planned[]): Question {
  const r = c.rng;
  const target = pick(r, plan);
  const wrongs = plan.filter((p) => p !== target).map((p) => clockPick(p.h, p.m));
  const near = clockPick(wrap12(target.h + (chance(r, 0.5) ? 1 : -1)), target.m);
  const text = `하루 계획표를 보고 ${target.step.label} 시각의 시계를 골라 보세요.`;
  const label = timeText(target.h, target.m);
  return mk(c, {
    prompt: text,
    say: text,
    visual: dayTable(plan),
    answer: buildChoice(r, clockPick(target.h, target.m), [...wrongs, near], 3, 3),
    hint: { say: '계획표에서 그 일의 시각을 읽고, 짧은바늘과 긴바늘이 그 시각을 가리키는 시계를 찾아요.' },
    explain: `${withJosa(target.step.label, '은/는')} ${label}${josa(label, '이에요/예요')}.`,
  });
}

function stepOfClockQ(c: GenCtx, plan: Planned[]): Question {
  const r = c.rng;
  const target = pick(r, plan);
  const text = '시계가 가리키는 시각에는 무엇을 할까요? 계획표에서 찾아보세요.';
  const label = timeText(target.h, target.m);
  return mk(c, {
    prompt: text,
    say: text,
    visual: { k: 'col', items: [clockVis(target.h, target.m, { size: 'md' }), dayTable(plan)], gap: 10 },
    answer: buildChoice(r, stepOpt(target.step), plan.filter((p) => p !== target).map((p) => stepOpt(p.step)), 3),
    hint: { say: '짧은바늘이 가리키는 숫자와 긴바늘 위치를 읽고, 계획표에서 같은 시각을 찾아요.' },
    explain: `${label}에는 ${target.step.label}${josa(target.step.label, '이에요/예요')}.`,
  });
}

function matchDayQ(c: GenCtx, plan: Planned[]): Question {
  const pairs: MatchPair[] = plan.map((p) => ({
    key: p.step.key,
    a: { text: `${p.step.emoji} ${p.step.label}` },
    b: { visual: clockVis(p.h, p.m, { size: 'sm' }) },
  }));
  const text = '계획표를 보고 하는 일과 알맞은 시계를 이어 보세요.';
  return mk(c, {
    prompt: text,
    say: text,
    visual: dayTable(plan),
    answer: { t: 'match', pairs },
    hint: { say: '계획표에서 시각을 읽어요. 긴바늘이 6이면 30분, 12이면 정각이에요.' },
    explain: '계획표의 시각과 같은 시각을 가리키는 시계를 이었어요.',
  });
}

function orderDayQ(c: GenCtx, n: number): Question {
  const r = c.rng;
  const picked = sample(r, STEPS, n).sort((a, b) => STEPS.indexOf(a) - STEPS.indexOf(b));
  const correct = picked.map((s) => s.key);
  const text = '학교 가는 날, 먼저 하는 일부터 차례대로 눌러 보세요.';
  return mk(c, {
    prompt: text,
    say: text,
    answer: { t: 'order', items: shuffleDiff(r, picked.map(stepItem), correct), correct, style: 'cards' },
    hint: { say: '아침에 일어나서 학교에 가고, 공부하고, 점심을 먹고, 집에 오는 순서를 떠올려 봐요.' },
    explain: `${picked.map((s) => s.label).join(', ')} 순서예요.`,
  });
}

function earlierQ(c: GenCtx, plan: Planned[]): Question {
  const r = c.rng;
  const [i, j] = sample(r, [...Array(plan.length).keys()], 2).sort((x, y) => x - y) as [number, number];
  const first = plan[i] as Planned;
  const late = plan[j] as Planned;
  const text = `${first.step.label}${josa(first.step.label, '과/와')} ${late.step.label} 중에서 먼저 하는 일은 무엇일까요?`;
  const t1 = timeText(first.h, first.m);
  const t2 = timeText(late.h, late.m);
  return mk(c, {
    prompt: text,
    say: text,
    visual: dayTable(plan),
    answer: buildChoice(r, stepOpt(first.step), [stepOpt(late.step)], 2),
    hint: { say: '계획표에서 두 일의 시각을 비교해 봐요. 아침에 가까운 쪽이 먼저예요.' },
    explain: `${first.step.label}${josa(first.step.label, '은/는')} ${t1}, ${late.step.label}${josa(late.step.label, '은/는')} ${t2}${josa(t2, '이에요/예요')}. 시각이 더 이른 ${first.step.label}${josa(first.step.label, '이/가')} 먼저예요.`,
  });
}

export function schoolDayGen(c: GenCtx): Question {
  const r = c.rng;
  if (c.level === 1) return chance(r, 0.65) ? clockOfStepQ(c, planSchool(r, 3, false)) : orderDayQ(c, 3);
  if (c.level === 2) {
    const roll = r();
    if (roll < 0.4) return stepOfClockQ(c, planSchool(r, 4, chance(r, 0.4)));
    if (roll < 0.7) return clockOfStepQ(c, planSchool(r, 4, chance(r, 0.5)));
    return orderDayQ(c, 4);
  }
  const roll = r();
  if (roll < 0.4) return matchDayQ(c, planSchool(r, 4, true));
  if (roll < 0.65) return stepOfClockQ(c, planSchool(r, 5, true));
  if (roll < 0.85) return earlierQ(c, planSchool(r, 4, true));
  return orderDayQ(c, 5);
}
