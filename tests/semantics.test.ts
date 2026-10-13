import { describe, expect, it } from 'vitest';
import { WEEKDAYS_LONG, addDays, daysInMonth, makeParts, toParts, weekdayOf } from '@/core/dates';
import { DAY } from '@/core/gen/routine';
import { planDay } from '@/core/gen/routine';
import { makeRng } from '@/core/rng';
import { generate } from '@/core/question';
import { allSkills } from '@/core/skills';
import type { FamilyEvent, Level, Option, Question, Visual } from '@/core/types';

// 문제를 만든 쪽 코드와 따로, 화면에 보이는 값(그림·글·보기)만 보고 정답이 맞는지 다시 계산해 본다.

const ENVS = [
  { today: toParts(new Date(2026, 10, 2)), events: [] as FamilyEvent[] },
  {
    today: toParts(new Date(2028, 1, 29)),
    events: [
      { id: 'e1', label: '엄마 생일', month: 3, day: 14, kind: 'birthday' },
      { id: 'e2', label: '아빠 생일', month: 8, day: 2, kind: 'birthday' },
      { id: 'e3', label: '윤일 생일', month: 2, day: 29, kind: 'birthday' },
    ] as FamilyEvent[],
  },
  { today: toParts(new Date(2027, 0, 31)), events: [{ id: 'e4', label: '결혼기념일', month: 12, day: 25, kind: 'anniversary' }] as FamilyEvent[] },
  { today: toParts(new Date(2027, 2, 1)), events: [] as FamilyEvent[] },
];
const LEVELS: Level[] = [1, 2, 3];
const SEEDS = 250;

type Env = (typeof ENVS)[number];
interface Case {
  q: Question;
  env: Env;
  level: Level;
  seed: number;
}

function* cases(skill: string, seeds = SEEDS): Generator<Case> {
  for (const env of ENVS) for (const level of LEVELS) for (let seed = 1; seed <= seeds; seed++) yield { q: generate({ skill, level, seed }, env), env, level, seed };
}

function run(skill: string, check: (c: Case) => string | null, opts: { minChecked?: number } = {}): void {
  const bad: string[] = [];
  let checked = 0;
  for (const c of cases(skill)) {
    const p = check(c);
    if (p === 'skip') continue;
    checked++;
    if (p) bad.push(`L${c.level} s${c.seed}: ${p} :: ${c.q.prompt}`);
    if (bad.length >= 6) break;
  }
  expect(bad).toEqual([]);
  expect(checked).toBeGreaterThanOrEqual(opts.minChecked ?? 200);
}

// ---------------------------------------------------------------------------
// 도구
// ---------------------------------------------------------------------------

const flat = (v?: Visual): Visual[] => (v ? (v.k === 'row' || v.k === 'col' ? [v, ...v.items.flatMap(flat)] : [v]) : []);
const correctOpt = (q: Question): Option => {
  if (q.answer.t !== 'choice') throw new Error('choice가 아님');
  return q.answer.options[q.answer.correct] as Option;
};
const wrongOpts = (q: Question): Option[] => (q.answer.t === 'choice' ? q.answer.options.filter((_, i) => i !== (q.answer as { correct: number }).correct) : []);
const compute = (a: number, op: string, b: number): number => (op === '+' ? a + b : a - b);
const SKIP = 'skip';

function correctNumber(q: Question): number | null {
  const a = q.answer;
  if (a.t === 'number') return a.correct;
  if (a.t === 'choice') {
    const n = Number(correctOpt(q).key);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 덧셈·뺄셈
// ---------------------------------------------------------------------------

const ARITH = [
  'add.pic5', 'add.eq5', 'add.pic9', 'add.eq9', 'sub.pic5', 'sub.eq5', 'sub.pic9', 'sub.eq9', 'mix.addsub9',
  'game.balloons.add5', 'game.balloons.add9', 'game.balloons.sub5', 'game.balloons.sub9', 'game.balloons.mix9', 'game.fish.add9', 'game.fish.sub9',
];

function picValue(vs: Visual[]): { value: number; a: number; b: number; op: '+' | '−' } | null {
  const g = vs.find((v): v is Extract<Visual, { k: 'groups' }> => v.k === 'groups');
  if (g) return { value: g.a.n + g.b.n, a: g.a.n, b: g.b.n, op: '+' };
  const o = vs.find((v): v is Extract<Visual, { k: 'objects' }> => v.k === 'objects' && v.crossed !== undefined);
  if (o && o.crossed !== undefined) return { value: o.n - o.crossed, a: o.n, b: o.crossed, op: '−' };
  return null;
}

function arithCheck({ q }: Case): string | null {
  const vs = flat(q.visual);
  const a = q.answer;
  const eqv = vs.find((v): v is Extract<Visual, { k: 'eq' }> => v.k === 'eq' && v.parts.length === 5);
  const pic = picValue(vs);
  const EQ_TEXT = /^(\d+) ([+−]) (\d+) = (\d+)$/;

  // 식 고르기
  if (a.t === 'choice' && a.options.every((o) => EQ_TEXT.test(o.text ?? ''))) {
    for (let i = 0; i < a.options.length; i++) {
      const m = EQ_TEXT.exec((a.options[i] as Option).text as string) as RegExpExecArray;
      const truth = compute(Number(m[1]), m[2] as string, Number(m[3])) === Number(m[4]);
      if (truth !== (i === a.correct)) return `식 보기 ${i}가 ${truth ? '참' : '거짓'}인데 정답 표시와 다름`;
    }
    const m = EQ_TEXT.exec(correctOpt(q).text as string) as RegExpExecArray;
    if (pic && (Number(m[1]) !== pic.a || Number(m[3]) !== pic.b || m[2] !== pic.op)) return '그림과 식이 다름';
    return null;
  }
  // 식(풍선) 눌러 고르기: "답이 N인"
  if (a.t === 'tapTargets') {
    const m = /답이 (\d+)인/.exec(q.prompt);
    if (m) {
      const N = Number(m[1]);
      for (const it of a.items) {
        const e = /^(\d+) ([+−]) (\d+)$/.exec(it.text ?? '');
        if (!e) return `식 모양이 아님: ${it.text}`;
        const hit = compute(Number(e[1]), e[2] as string, Number(e[3])) === N;
        if (hit !== a.targets.includes(it.key)) return `항목 ${it.text}: 답이 ${N}인지(${hit}) 정답 표시와 다름`;
      }
      return null;
    }
    // 풍선 1단계: 식을 보여 주고 답이 적힌 풍선
    if (eqv) {
      const v = compute(Number(eqv.parts[0]), eqv.parts[1] as string, Number(eqv.parts[2]));
      const hit = a.items.filter((it) => Number(it.text) === v).map((it) => it.key);
      if (hit.length !== 1 || a.targets.length !== 1 || a.targets[0] !== hit[0]) return '풍선 답이 맞지 않음';
      return null;
    }
    return '확인할 수 없는 tapTargets';
  }
  // 더하기·빼기 기호 고르기
  if (a.t === 'choice' && a.options.every((o) => o.key === '+' || o.key === '−')) {
    const key = correctOpt(q).key;
    if (eqv && eqv.parts[1] === '?') {
      const A = Number(eqv.parts[0]);
      const B = Number(eqv.parts[2]);
      const C = Number(eqv.parts[4]);
      if (compute(A, key, B) !== C) return `기호 ${key}로는 ${A} ? ${B} = ${C}가 안 됨`;
      return null;
    }
    if (pic) {
      if (key !== pic.op) return `이야기·그림은 ${pic.op}인데 정답 ${key}`;
      const plusWords = /더 받았|더 올렸/.test(q.prompt);
      const minusWords = /가져갔|덜어 냈/.test(q.prompt);
      if ((key === '+' && !plusWords) || (key === '−' && !minusWords)) return '이야기 말과 기호가 다름';
      return null;
    }
    return '확인할 수 없는 기호 문제';
  }
  // 숫자 답
  const got = correctNumber(q);
  if (got === null) return '숫자 답이 아님';
  let expected: number | null = null;
  if (eqv) {
    const [A, op, B, , C] = eqv.parts as [string, string, string, string, string];
    if (C === '?') expected = compute(Number(A), op, Number(B));
    else if (B === '?') expected = op === '+' ? Number(C) - Number(A) : Number(A) - Number(C);
    if (pic && C === '?' && (pic.a !== Number(A) || pic.b !== Number(B) || pic.op !== op)) return '그림과 식이 다름';
  } else if (pic) {
    expected = pic.value;
    const m = /(\d+) ([+−]) (\d+)/.exec(q.prompt);
    if (m && compute(Number(m[1]), m[2] as string, Number(m[3])) !== pic.value) return '글의 식과 그림이 다름';
  } else {
    const nums = (q.prompt.match(/\d+/g) ?? []).map(Number);
    if (nums.length === 2 && /더 올렸|더 받았/.test(q.prompt)) expected = nums[0]! + nums[1]!;
    else if (nums.length === 2 && /덜어 냈|가져갔/.test(q.prompt)) expected = nums[0]! - nums[1]!;
  }
  if (expected === null) return '기대값을 계산하지 못함';
  if (expected !== got) return `정답 ${got}인데 계산값 ${expected}`;
  if (expected < 0) return '음수';
  return null;
}

describe('덧셈·뺄셈 정답이 맞다', () => {
  for (const id of ARITH) {
    it(id, () => run(id, arithCheck));
  }
  it('뺄셈 답은 1 이상, 합은 범위 안', () => {
    for (const id of ['sub.pic5', 'sub.eq5', 'sub.pic9', 'sub.eq9']) {
      for (const { q } of cases(id, 120)) {
        const n = correctNumber(q);
        if (n !== null) expect(n, `${id} ${q.prompt}`).toBeGreaterThanOrEqual(1);
      }
    }
    for (const id of ['add.pic5', 'add.eq5']) for (const { q } of cases(id, 120)) expect(correctNumber(q) ?? 0).toBeLessThanOrEqual(6);
    for (const id of ['add.pic9', 'add.eq9']) for (const { q } of cases(id, 120)) expect(correctNumber(q) ?? 0).toBeLessThanOrEqual(10);
  });
});

// ---------------------------------------------------------------------------
// 시계
// ---------------------------------------------------------------------------

const wrap12 = (h: number): number => ((h - 1 + 12) % 12) + 1;
const timeFromPrompt = (t: string): { h: number; m: number } | null => {
  const m = /(\d+)시(?: (\d+)분)?/.exec(t);
  return m ? { h: Number(m[1]), m: m[2] ? Number(m[2]) : 0 } : null;
};
const clocksOf = (vs: Visual[]) => vs.filter((v): v is Extract<Visual, { k: 'clock' }> => v.k === 'clock');
const digitalOf = (vs: Visual[]) => vs.find((v): v is Extract<Visual, { k: 'digital' }> => v.k === 'digital');
const sameTime = (a: { h: number; m: number }, b: { h: number; m: number }): boolean => wrap12(a.h) === wrap12(b.h) && a.m === b.m;

function optionTime(o: Option): { h: number; m: number } | null {
  if (o.visual?.k === 'clock') return { h: o.visual.h, m: o.visual.m };
  const [h, m] = o.key.split(':');
  if (m !== undefined && Number.isInteger(Number(h))) return { h: Number(h), m: Number(m) };
  return null;
}

function halfReadCheck({ q }: Case, expectHours: number[], mixed: boolean): string | null {
  const vs = flat(q.visual);
  const target = clocksOf(vs)[0] ?? digitalOf(vs) ?? timeFromPrompt(q.prompt);
  if (!target) return '기준 시각을 찾지 못함';
  const t = { h: target.h, m: target.m };
  if (!expectHours.includes(wrap12(t.h))) return `시간 범위 밖 ${t.h}`;
  if (!mixed && t.m !== 30) return '정각이 나옴';
  const got = optionTime(correctOpt(q));
  if (!got || !sameTime(got, t)) return `정답 시각 ${JSON.stringify(got)} 기준 ${JSON.stringify(t)}`;
  for (const w of wrongOpts(q)) {
    const wt = optionTime(w);
    if (wt && sameTime(wt, t)) return '오답이 정답과 같은 시각';
  }
  return null;
}

describe('몇 시 30분 정답이 맞다', () => {
  it('clk.half.a', () => run('clk.half.a', (c) => halfReadCheck(c, [1, 2, 3, 4, 5, 6], false)));
  it('clk.half.b', () => run('clk.half.b', (c) => halfReadCheck(c, [7, 8, 9, 10, 11, 12], false)));
  it('clk.read.mix', () => run('clk.read.mix', (c) => halfReadCheck(c, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], true)));

  const seeCheck = ({ q }: Case): string | null => {
    const a = q.answer;
    const vs = flat(q.visual);
    if (a.t === 'choice') {
      const clk = clocksOf(vs)[0];
      if (!clk) return '시계 없음';
      const key = correctOpt(q).key;
      const half = clk.m === 30;
      if (key === '6' || key === '12') return (key === '6') === half ? null : '긴바늘 숫자가 다름';
      if (key === 'half' || key === 'hour') return (key === 'half') === half ? null : '정각/30분이 다름';
      return `알 수 없는 키 ${key}`;
    }
    if (a.t === 'tapTargets') {
      const askHalf = /30분인/.test(q.prompt);
      const askHour = /정각인/.test(q.prompt);
      if (askHalf === askHour) return '질문에서 정각/30분을 못 읽음';
      for (const it of a.items) {
        const clk = it.visual?.k === 'clock' ? it.visual : null;
        if (!clk) return '시계 아님';
        const hit = askHalf ? clk.m === 30 : clk.m === 0;
        if (hit !== a.targets.includes(it.key)) return `항목 ${it.key} 정답 표시 불일치`;
      }
      return null;
    }
    return '확인 불가';
  };
  it('clk.half.see', () => run('clk.half.see', seeCheck));
  it('game.balloons.halfSee', () => run('game.balloons.halfSee', seeCheck));

  const setCheck = ({ q }: Case): string | null => {
    const a = q.answer;
    if (a.t !== 'clockSet') return '시계 맞추기가 아님';
    const dig = digitalOf(flat(q.visual));
    const p = /짧은바늘이 (\d+)을/.exec(q.prompt);
    if (p) return a.h === Number(p[1]) ? null : '짧은바늘 숫자 다름';
    const t = dig ?? timeFromPrompt(q.prompt);
    if (!t) return '기준 시각 없음';
    if (wrap12(t.h) !== wrap12(a.h) || t.m !== a.m) return `정답 ${a.h}:${a.m} 기준 ${t.h}:${t.m}`;
    if (a.mode === 'half' && a.m !== 30) return 'mode half인데 30분 아님';
    if (a.mode === 'hour' && a.m !== 0) return 'mode hour인데 정각 아님';
    return null;
  };
  for (const id of ['clk.set.half', 'game.hands.half.a', 'game.hands.half.b']) it(id, () => run(id, setCheck));

  const matchCheck = ({ q }: Case): string | null => {
    const a = q.answer;
    if (a.t !== 'match') return 'match 아님';
    for (const p of a.pairs) {
      const clk = p.a.visual?.k === 'clock' ? p.a.visual : null;
      if (!clk) return '짝 왼쪽이 시계가 아님';
      const text = p.b.text ?? '';
      const digital = /^(\d+):(\d\d)$/.exec(text);
      const t = digital ? { h: Number(digital[1]), m: Number(digital[2]) } : timeFromPrompt(text);
      if (!t || !sameTime(t, clk)) return `짝 불일치 ${text} / ${clk.h}:${clk.m}`;
    }
    const faces = new Set(a.pairs.map((p) => JSON.stringify(p.a.visual)));
    if (faces.size !== a.pairs.length) return '같은 시계 그림이 두 번';
    return null;
  };
  for (const id of ['game.clockMatch.half.a', 'game.clockMatch.half.b']) it(id, () => run(id, matchCheck));
});

// ---------------------------------------------------------------------------
// 달력
// ---------------------------------------------------------------------------

function calOfQ(q: Question): Extract<Visual, { k: 'calendar' }> | null {
  return (flat(q.visual).find((v) => v.k === 'calendar') as Extract<Visual, { k: 'calendar' }> | undefined) ?? null;
}
const markedDay = (cal: Extract<Visual, { k: 'calendar' }>, mark: string): number | null => {
  const e = Object.entries(cal.marks ?? {}).find(([, m]) => m === mark);
  return e ? Number(e[0]) : null;
};

describe('달력 정답이 맞다', () => {
  it('cal.today', () =>
    run('cal.today', ({ q, env }) => {
      const cal = calOfQ(q);
      if (!cal) return '달력 없음';
      const d = markedDay(cal, 'today');
      if (d !== env.today.d || cal.month !== env.today.m || cal.year !== env.today.y) return '달력이 오늘이 아님';
      const key = correctOpt(q).key.split('-').map(Number);
      const wdAsk = /요일/.test(q.prompt);
      const dayAsk = /며칠/.test(q.prompt);
      if (key.length === 3) {
        if (key[0] !== env.today.m || key[1] !== env.today.d || key[2] !== env.today.wd) return '월·일·요일 키가 오늘과 다름';
      } else if (key.length === 2) {
        if (key[0] !== env.today.m || key[1] !== env.today.d) return '월·일 키가 오늘과 다름';
      } else if (wdAsk && !dayAsk) {
        if (key[0] !== env.today.wd) return '요일 키가 오늘과 다름';
      } else if (key[0] !== env.today.d) return '일 키가 오늘과 다름';
      return null;
    }));

  it('cal.dateRead', () =>
    run('cal.dateRead', ({ q }) => {
      const cal = calOfQ(q);
      if (!cal) return '달력 없음';
      const t = markedDay(cal, 'target');
      if (t === null) return '표시된 칸 없음';
      const key = correctOpt(q).key.split('-').map(Number);
      if (key.length === 1) return key[0] === t ? null : '일 불일치';
      if (key[0] !== cal.month || key[1] !== t) return '월·일 불일치';
      if (key.length === 3 && key[2] !== weekdayOf(cal.year, cal.month, t)) return '요일 불일치';
      return null;
    }));

  it('cal.relday', () =>
    run('cal.relday', ({ q }) => {
      const cal = calOfQ(q);
      if (!cal) return '달력 없음';
      const today = markedDay(cal, 'today');
      if (today === null) return '오늘 표시 없음';
      const tomorrow = /내일/.test(q.prompt.replace('내일은 몇', '내일은 몇')) && !/어제는/.test(q.prompt);
      const delta = tomorrow ? 1 : -1;
      const base = makeParts(cal.year, cal.month, today);
      const want = addDays(base, delta);
      const key = correctOpt(q).key.split('-').map(Number);
      if (key.length === 1) return key[0] === want.d && want.m === cal.month ? null : '일 불일치';
      if (key.length === 2) return key[0] === want.m && key[1] === want.d ? null : `월일 불일치 ${key.join('-')} / ${want.m}-${want.d}`;
      if (key[0] !== want.m || key[1] !== want.d || key[2] !== want.wd) return '월·일·요일 불일치';
      // 문제에 적힌 오늘의 요일도 달력과 맞아야 한다
      const m = /오늘은 (\d+)일 (.요일)이에요/.exec(q.prompt);
      if (m && (Number(m[1]) !== today || m[2] !== WEEKDAYS_LONG[weekdayOf(cal.year, cal.month, today)])) return '문제 속 오늘 요일이 달력과 다름';
      return null;
    }));

  it('cal.find', () =>
    run('cal.find', ({ q, env }) => {
      const a = q.answer;
      const evOf = (label: string) => env.events.find((e) => q.prompt.startsWith(label) && e.label === label);
      if (a.t === 'calTap') {
        const dim = daysInMonth(a.year, a.month);
        let m: RegExpExecArray | null;
        if ((m = /^(.+?)은 (\d+)월 (\d+)일이에요\. 달력에서/.exec(q.prompt))) {
          const ev = evOf(m[1] as string);
          if (!ev) return '행사가 목록에 없음';
          if (a.month !== Number(m[2]) || a.targets[0] !== Number(m[3]) || a.month !== ev.month || a.targets[0] !== ev.day) return '행사 날짜 불일치';
          return a.targets.length === 1 ? null : '정답 칸 수';
        }
        if ((m = /^(\d+)월 (\d+)일을 찾아/.exec(q.prompt))) return a.month === Number(m[1]) && a.targets.length === 1 && a.targets[0] === Number(m[2]) ? null : '날짜 불일치';
        if (/첫째 날/.test(q.prompt)) return a.targets.length === 1 && a.targets[0] === 1 ? null : '첫째 날 아님';
        if (/마지막 날/.test(q.prompt)) return a.targets.length === 1 && a.targets[0] === dim ? null : '마지막 날 아님';
        if ((m = /^(\d+)월의 (첫|두) 번째 (.요일)을/.exec(q.prompt))) {
          const wd = WEEKDAYS_LONG.indexOf(m[3] as (typeof WEEKDAYS_LONG)[number]);
          const nth = m[2] === '첫' ? 1 : 2;
          const days = Array.from({ length: dim }, (_, i) => i + 1).filter((d) => weekdayOf(a.year, a.month, d) === wd);
          return a.targets.length === 1 && a.targets[0] === days[nth - 1] ? null : 'n번째 요일 불일치';
        }
        if ((m = /^(\d+)월 (\d+)일과 같은 요일인 날을 모두/.exec(q.prompt))) {
          const base = Number(m[2]);
          const wd = weekdayOf(a.year, a.month, base);
          const want = Array.from({ length: dim }, (_, i) => i + 1).filter((d) => d !== base && weekdayOf(a.year, a.month, d) === wd);
          return JSON.stringify([...a.targets].sort((x, y) => x - y)) === JSON.stringify(want) ? null : '같은 요일 목록 불일치';
        }
        return `알 수 없는 질문`;
      }
      if (a.t === 'choice') {
        const m = /^(.+?)은 (\d+)월 (\d+)일이에요\. 그날은 무슨 요일/.exec(q.prompt);
        const cal = calOfQ(q);
        if (!m || !cal) return '행사 요일 질문을 못 읽음';
        const ev = evOf(m[1] as string);
        if (!ev || ev.month !== Number(m[2]) || ev.day !== Number(m[3]) || cal.month !== ev.month) return '행사 불일치';
        return Number(correctOpt(q).key) === weekdayOf(cal.year, ev.month, ev.day) ? null : '요일 불일치';
      }
      return '확인 불가';
    }));

  it('행사가 있는 환경에서 2월 29일은 평년 달력에 쓰이지 않는다', () => {
    const env = ENVS[1]!;
    for (let seed = 1; seed <= 600; seed++) {
      for (const level of LEVELS) {
        const q = generate({ skill: 'cal.find', level, seed }, env);
        if (q.answer.t === 'calTap' && /윤일 생일/.test(q.prompt)) expect(daysInMonth(q.answer.year, 2)).toBeGreaterThanOrEqual(29);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 비교하기
// ---------------------------------------------------------------------------

const labelOfText = (t: string): string => t.replace(/^\S+\s/, '');
const WEIGHT_KG: Record<string, number> = {
  코끼리: 5000, 강아지: 10, 햄스터: 0.1, 버스: 10000, 자동차: 1500, 자전거: 12, 수박: 5, 사과: 0.2, 체리: 0.01, 곰: 200, 토끼: 2, 병아리: 0.05,
  고래: 100000, 거북이: 150, 꿀벌: 0.0001, 호박: 3, 귤: 0.1, 사탕: 0.005, 바위: 100, 감자: 0.2, 깃털: 0.001, 기린: 800, 고양이: 4, 생쥐: 0.03,
};

describe('비교하기 정답이 맞다', () => {
  it('cmp.length', () =>
    run('cmp.length', ({ q }) => {
      const vs = flat(q.visual);
      const bars = vs.find((v): v is Extract<Visual, { k: 'bars' }> => v.k === 'bars');
      const bigWord = /긴|길|높/.test(q.prompt);
      const smallWord = /짧|낮/.test(q.prompt);
      const valueOf = (label: string): number | null => bars?.items.find((i) => i.label === label)?.value ?? null;
      const a = q.answer;
      // 말로 이어 생각하기(그림 없음)
      if (!bars) {
        const rel: [string, string, number][] = [];
        const sentences = q.prompt.split('. ');
        for (const s of sentences) {
          const mm = /^(.+?)(?:은|는) (.+?)보다 (길어요|짧아요|높아요|낮아요)\.?$/.exec(s.trim());
          if (mm) rel.push([mm[1] as string, mm[2] as string, /길|높/.test(mm[3] as string) ? 1 : -1]);
        }
        if (rel.length !== 2 || a.t !== 'choice') return '말 비교를 읽지 못함';
        // 점수: 앞 이름이 더 크면 +1
        const score = new Map<string, number>();
        for (const [x, y, dir] of rel) {
          score.set(x, (score.get(x) ?? 0) + dir);
          score.set(y, (score.get(y) ?? 0) - dir);
        }
        const names = [...score.keys()];
        const want = /가장 (긴|높은)/.test(q.prompt) ? names.reduce((p, n) => ((score.get(n) as number) > (score.get(p) as number) ? n : p)) : names.reduce((p, n) => ((score.get(n) as number) < (score.get(p) as number) ? n : p));
        return labelOfText(correctOpt(q).text as string) === want ? null : `정답 ${correctOpt(q).text} 계산 ${want}`;
      }
      if (a.t === 'choice' && !/몇 칸/.test(q.prompt)) {
        const label = labelOfText(correctOpt(q).text as string);
        const v = valueOf(label);
        if (v === null) return '정답 막대를 못 찾음';
        const vals = bars.items.map((i) => i.value);
        if (new Set(vals).size !== vals.length) return '막대 길이가 같음';
        if (bigWord === smallWord) return '질문에서 큰/작은 말을 못 읽음';
        return v === (bigWord ? Math.max(...vals) : Math.min(...vals)) ? null : '정답이 가장 긴/짧은 것이 아님';
      }
      if (a.t === 'order') {
        const asc = /^(짧은|낮은)/.test(q.prompt);
        const desc = /^(긴|높은)/.test(q.prompt);
        if (asc === desc) return '순서 방향 못 읽음';
        const vals = a.correct.map((k) => valueOf(a.items.find((i) => i.key === k)?.say ?? '') as number);
        for (let i = 1; i < vals.length; i++) if (asc ? (vals[i] as number) <= (vals[i - 1] as number) : (vals[i] as number) >= (vals[i - 1] as number)) return '순서가 틀림';
        return null;
      }
      if (a.t === 'choice' || correctNumber(q) !== null) {
        const vals = bars.items.map((i) => i.value);
        if (new Set(vals).size !== vals.length) return '막대 길이가 같음';
        return correctNumber(q) === (bigWord ? Math.max(...vals) : Math.min(...vals)) ? null : '칸 수 불일치';
      }
      return '확인 불가';
    }));

  it('cmp.length 칸 수 문제는 숫자 답', () => {
    let n = 0;
    for (const { q, level } of cases('cmp.length', 150)) {
      if (level === 3 && q.answer.t === 'choice' && /몇 칸/.test(q.prompt)) {
        n++;
        const bars = flat(q.visual).find((v): v is Extract<Visual, { k: 'bars' }> => v.k === 'bars');
        const vals = bars!.items.map((i) => i.value);
        const want = /가장 (긴|높은)/.test(q.prompt) ? Math.max(...vals) : Math.min(...vals);
        expect(Number(correctOpt(q).key), q.prompt).toBe(want);
      }
    }
    expect(n).toBeGreaterThan(5);
  });

  it('game.lineup', () =>
    run('game.lineup', ({ q }) => {
      const a = q.answer;
      if (a.t !== 'order') return 'order 아님';
      const asc = /^낮은/.test(q.prompt);
      const vals = a.correct.map((k) => {
        const it = a.items.find((i) => i.key === k);
        const v = it?.visual;
        return v?.k === 'bars' ? (v.items[0] as { value: number }).value : NaN;
      });
      if (vals.some(Number.isNaN)) return '막대 값 없음';
      if (new Set(vals).size !== vals.length) return '높이가 같은 막대';
      for (let i = 1; i < vals.length; i++) if (asc ? (vals[i] as number) <= (vals[i - 1] as number) : (vals[i] as number) >= (vals[i - 1] as number)) return '순서가 틀림';
      return null;
    }));

  const weightCheck = ({ q }: Case): string | null => {
    const vs = flat(q.visual);
    const seesaws = vs.filter((v): v is Extract<Visual, { k: 'seesaw' }> => v.k === 'seesaw');
    const heavyWord = /무거/.test(q.prompt);
    const lightWord = /가벼/.test(q.prompt);
    if (heavyWord === lightWord) return '무겁다/가볍다를 못 읽음';
    const a = q.answer;
    if (a.t !== 'choice') return 'choice 아님';
    const key = correctOpt(q).key;
    const nameOf = (o: Option): string => (o.key === 'left' || o.key === 'right' ? o.key : labelOfText(o.text as string));

    if (seesaws.length === 1) {
      const s = seesaws[0] as Extract<Visual, { k: 'seesaw' }>;
      if (!s.tilt || s.tilt === 'level') return '기울기 없음';
      const lowSide = s.tilt;
      const lowGroup = lowSide === 'left' ? s.left : s.right;
      const highGroup = lowSide === 'left' ? s.right : s.left;
      if (key === 'left' || key === 'right') {
        if (lowGroup.emoji !== highGroup.emoji || lowGroup.n <= highGroup.n) return '같은 물건 시소가 아니거나 개수가 안 맞음';
        const want = heavyWord ? lowSide : lowSide === 'left' ? 'right' : 'left';
        return key === want ? null : '기울어진 쪽과 정답이 다름';
      }
      // 서로 다른 두 물건: 내려간 쪽이 더 무겁다
      const emojiOfAnswer = (correctOpt(q).text as string).split(' ')[0];
      const want = heavyWord ? lowGroup.emoji : highGroup.emoji;
      if (emojiOfAnswer !== want) return '내려간 쪽과 정답이 다름';
      // 실제 무게도 그림과 맞아야 한다
      const names = a.options.map((o) => ({ e: (o.text as string).split(' ')[0], n: nameOf(o) }));
      const lowName = names.find((x) => x.e === lowGroup.emoji)?.n;
      const highName = names.find((x) => x.e === highGroup.emoji)?.n;
      if (!lowName || !highName || (WEIGHT_KG[lowName] as number) <= (WEIGHT_KG[highName] as number)) return '시소가 실제 무게와 반대';
      return null;
    }
    if (seesaws.length === 2) {
      // 두 시소를 이어서 가장 무거운/가벼운 것 찾기
      const score = new Map<string, number>();
      for (const s of seesaws) {
        if (!s.tilt || s.tilt === 'level') return '기울기 없음';
        const low = s.tilt === 'left' ? s.left : s.right;
        const high = s.tilt === 'left' ? s.right : s.left;
        score.set(low.emoji, (score.get(low.emoji) ?? 0) + 1);
        score.set(high.emoji, (score.get(high.emoji) ?? 0) - 1);
      }
      const emojis = [...score.keys()];
      if (emojis.length !== 3) return '물건이 세 가지가 아님';
      const best = heavyWord ? emojis.reduce((p, e) => ((score.get(e) as number) > (score.get(p) as number) ? e : p)) : emojis.reduce((p, e) => ((score.get(e) as number) < (score.get(p) as number) ? e : p));
      return (correctOpt(q).text as string).split(' ')[0] === best ? null : '정답이 시소 결과와 다름';
    }
    // 시소 없이 상식으로 비교
    const shown = vs.filter((v): v is Extract<Visual, { k: 'big' }> => v.k === 'big');
    if (shown.length < 2) return '비교할 물건이 없음';
    const kg = shown.map((s) => WEIGHT_KG[s.sub as string] as number);
    if (kg.some((x) => x === undefined)) return '무게표에 없음';
    const want = heavyWord ? Math.max(...kg) : Math.min(...kg);
    return WEIGHT_KG[key] === want ? null : `상식 무게와 다름 ${key}`;
  };
  it('cmp.weight', () => run('cmp.weight', weightCheck));
  it('game.seesaw', () => run('game.seesaw', weightCheck));

  it('cmp.area', () =>
    run('cmp.area', ({ q }) => {
      const a = q.answer;
      const count = (v: Visual | undefined): number => (v?.k === 'cells' ? (v.fill ?? v.cols * v.rows) : NaN);
      if (a.t === 'tapTargets') {
        const counts = a.items.map((it) => count(it.visual));
        if (counts.some(Number.isNaN)) return '칸 그림 아님';
        if (new Set(counts).size !== counts.length) return '칸 수가 같은 모양이 있음';
        const wide = /넓은/.test(q.prompt);
        const narrow = /좁은/.test(q.prompt);
        if (wide === narrow) return '넓다/좁다를 못 읽음';
        const want = wide ? Math.max(...counts) : Math.min(...counts);
        const idx = counts.indexOf(want);
        return a.targets.length === 1 && a.targets[0] === (a.items[idx] as { key: string }).key ? null : '가장 넓은/좁은 모양이 정답이 아님';
      }
      if (a.t === 'choice') {
        const n = count(q.visual);
        return Number(correctOpt(q).key) === n ? null : `칸 수 ${n}인데 정답 ${correctOpt(q).key}`;
      }
      return '확인 불가';
    }));

  it('cells 모양의 줄·칸 수가 서로 맞다', () => {
    for (const { q } of cases('cmp.area', 100)) {
      const visuals = [q.visual, ...(q.answer.t === 'tapTargets' ? q.answer.items.map((i) => i.visual) : []), q.hint?.visual].filter(Boolean) as Visual[];
      for (const v of visuals) {
        if (v.k === 'cells' && v.fill !== undefined) {
          expect(v.fill).toBeLessThanOrEqual(v.cols * v.rows);
          expect(v.rows).toBe(Math.ceil(v.fill / v.cols));
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 하루 일과
// ---------------------------------------------------------------------------

const ORDER_OF = new Map(DAY.map((s, i) => [s.key, i]));
const LABEL_TO_KEY = new Map(DAY.map((s) => [s.label, s.key]));

describe('하루 일과 정답이 맞다', () => {
  it('life.routine', () =>
    run('life.routine', ({ q }) => {
      const a = q.answer;
      if (a.t === 'order') {
        const idx = a.correct.map((k) => ORDER_OF.get(k));
        if (idx.some((x) => x === undefined)) return '알 수 없는 일과';
        for (let i = 1; i < idx.length; i++) if ((idx[i] as number) <= (idx[i - 1] as number)) return '순서가 하루 흐름과 다름';
        return null;
      }
      if (a.t !== 'choice') return 'choice 아님';
      const key = correctOpt(q).key;
      const idxOf = (k: string) => ORDER_OF.get(k) as number;
      let m: RegExpExecArray | null;
      if ((m = /^(.+) 바로 다음에 하는 일/.exec(q.prompt))) {
        const anchor = LABEL_TO_KEY.get(m[1] as string);
        if (!anchor) return '기준 일과를 못 찾음';
        if (idxOf(key) !== idxOf(anchor) + 1) return '다음 일이 아님';
        for (const w of wrongOpts(q)) if (idxOf(w.key) >= idxOf(anchor)) return '오답이 지난 일이 아님';
        return null;
      }
      if ((m = /^(.+) 바로 전에 하는 일/.exec(q.prompt))) {
        const anchor = LABEL_TO_KEY.get(m[1] as string);
        if (!anchor) return '기준 일과를 못 찾음';
        if (idxOf(key) !== idxOf(anchor) - 1) return '바로 전 일이 아님';
        for (const w of wrongOpts(q)) if (idxOf(w.key) <= idxOf(anchor)) return '오답이 나중 일이 아님';
        return null;
      }
      if (/가장 먼저|가장 나중에/.test(q.prompt)) {
        const items = (flat(q.visual).find((v) => v.k === 'routine') as Extract<Visual, { k: 'routine' }> | undefined)?.items ?? [];
        const idxs = items.map((it) => idxOf(LABEL_TO_KEY.get(it.label) as string));
        const want = /가장 먼저/.test(q.prompt) ? Math.min(...idxs) : Math.max(...idxs);
        return idxOf(key) === want ? null : '가장 먼저/나중이 아님';
      }
      return '알 수 없는 질문';
    }));

  const tableTimes = (q: Question): { label: string; t: { h: number; m: number } }[] => {
    const tbl = flat(q.visual).find((v) => v.k === 'routine') as Extract<Visual, { k: 'routine' }> | undefined;
    return (tbl?.items ?? []).map((it) => ({ label: it.label, t: timeFromPrompt(it.time ?? '') as { h: number; m: number } }));
  };

  const timeCheck = ({ q }: Case): string | null => {
    const rows = tableTimes(q);
    if (rows.length < 3 || rows.some((r) => !r.t)) return '일과표를 읽지 못함';
    const faces = new Set(rows.map((r) => `${wrap12(r.t.h)}:${r.t.m}`));
    if (faces.size !== rows.length) return '일과표에 같은 시각이 둘 이상';
    const a = q.answer;
    if (a.t === 'choice') {
      const clk = clocksOf(flat(q.visual))[0];
      if (clk) {
        // 시계를 보고 일과 찾기
        const row = rows.find((r) => sameTime(r.t, clk));
        if (!row) return '일과표에 그 시각이 없음';
        return labelOfText(correctOpt(q).text as string) === row.label ? null : '시각에 맞는 일이 아님';
      }
      // 일과의 시각을 시계로 고르기
      const m = /일과표를 보고 (.+) 시각의 시계/.exec(q.prompt);
      const row = rows.find((r) => r.label === m?.[1]);
      if (!row) return '질문의 일과를 못 찾음';
      const got = optionTime(correctOpt(q));
      if (!got || !sameTime(got, row.t)) return '고른 시계 시각이 일과표와 다름';
      for (const w of wrongOpts(q)) {
        const wt = optionTime(w);
        if (wt && sameTime(wt, row.t)) return '오답 시계가 같은 시각';
      }
      return null;
    }
    if (a.t === 'match') {
      for (const p of a.pairs) {
        const label = labelOfText(p.a.text as string);
        const row = rows.find((r) => r.label === label);
        const clk = p.b.visual?.k === 'clock' ? p.b.visual : null;
        if (!row || !clk || !sameTime(row.t, clk)) return `짝 불일치 ${label}`;
      }
      return null;
    }
    return '확인 불가';
  };
  it('life.routineTime', () => run('life.routineTime', timeCheck));
  it('game.routineMatch', () => run('game.routineMatch', timeCheck));

  it('일과표 시각은 하루 순서대로 늘어나고 시계 그림이 겹치지 않는다', () => {
    for (const halves of [false, true]) {
      for (let seed = 1; seed <= 400; seed++) {
        for (const n of [3, 4]) {
          const plan = planDay(makeRng('plan', halves ? 1 : 0, n, seed), n, halves);
          expect(plan).toHaveLength(n);
          for (let i = 1; i < plan.length; i++) {
            const prev = plan[i - 1]!;
            const cur = plan[i]!;
            expect(cur.h24 * 60 + cur.m, `seed ${seed}`).toBeGreaterThan(prev.h24 * 60 + prev.m);
            expect(DAY.findIndex((s) => s.key === cur.step.key)).toBeGreaterThan(DAY.findIndex((s) => s.key === prev.step.key));
          }
          expect(new Set(plan.map((p) => `${p.h}:${p.m}`)).size).toBe(n);
          if (halves) expect(plan.some((p) => p.m === 30)).toBe(true);
        }
      }
    }
  });
});

describe('등록 현황', () => {
  it('새 스킬이 모두 등록되어 있다', () => {
    const ids = new Set(allSkills().map((s) => s.id));
    for (const id of [...ARITH, 'clk.half.see', 'clk.half.a', 'clk.half.b', 'clk.read.mix', 'clk.set.half', 'cal.today', 'cal.dateRead', 'cal.relday', 'cal.find', 'cmp.length', 'cmp.weight', 'cmp.area', 'life.routine', 'life.routineTime']) {
      expect(ids.has(id), id).toBe(true);
    }
  });
});
