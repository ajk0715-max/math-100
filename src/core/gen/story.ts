import { josa, type JosaKind } from '../ko';
import { OBJECTS, type Obj } from '../objects';
import { chance, int, pick, shuffle, type Rng } from '../rng';
import type { GenCtx, Option, Question, Visual } from '../types';
import { buildChoice, mk, numChoice } from './util';
import { EATS, twoSameCounter } from './term';

// ---------------------------------------------------------------------------
// 이야기를 읽고 식 세우기 (9 이내)
// ---------------------------------------------------------------------------

interface Verbs {
  more: string;
  mp: JosaKind;
  less: string;
  lp: JosaKind;
}

/** 이야기에 쓰는 사물과 동작. more는 늘어날 때, less는 줄어들 때 */
const VERBS: Record<string, Verbs> = {
  apple: { more: '더 땄어요', mp: '을/를', less: '먹었어요', lp: '을/를' },
  cookie: { more: '더 구웠어요', mp: '을/를', less: '먹었어요', lp: '을/를' },
  candy: { more: '더 받았어요', mp: '을/를', less: '먹었어요', lp: '을/를' },
  strawberry: { more: '더 땄어요', mp: '을/를', less: '먹었어요', lp: '을/를' },
  balloon: { more: '더 샀어요', mp: '을/를', less: '터뜨렸어요', lp: '을/를' },
  ball: { more: '더 가져왔어요', mp: '을/를', less: '잃어버렸어요', lp: '을/를' },
  butterfly: { more: '더 날아왔어요', mp: '이/가', less: '날아갔어요', lp: '이/가' },
  chick: { more: '더 왔어요', mp: '이/가', less: '도망갔어요', lp: '이/가' },
  fish: { more: '더 헤엄쳐 왔어요', mp: '이/가', less: '헤엄쳐 갔어요', lp: '이/가' },
  flower: { more: '더 피었어요', mp: '이/가', less: '시들었어요', lp: '이/가' },
  car: { more: '더 들어왔어요', mp: '이/가', less: '떠났어요', lp: '이/가' },
};
const STORY_OBJS: Obj[] = OBJECTS.filter((o) => VERBS[o.key] !== undefined);

type Op = '+' | '−';

interface Story {
  /** 이야기 본문 */
  text: string;
  /** 마지막 질문 */
  ask: string;
  visual: Visual;
  a: number;
  b: number;
  res: number;
  op: Op;
  unit: string;
}

const cnt = (n: number, c: string): string => `${n}${c}`;
const eqText = (x: number, op: Op, y: number, z: number): string => `${x} ${op} ${y} = ${z}`;

function addStory(r: Rng, hi: number): Story {
  const a = int(r, 1, hi - 1);
  const b = int(r, 1, hi - a);
  const res = a + b;
  if (chance(r, 0.55)) {
    const o = pick(r, STORY_OBJS);
    const v = VERBS[o.key] as Verbs;
    return {
      text: `${o.name} ${cnt(a, o.counter)}${josa(o.counter, '이/가')} 있었어요. ${cnt(b, o.counter)}${josa(o.counter, v.mp)} ${v.more}.`,
      ask: `모두 몇 ${o.counter}일까요?`,
      visual: { k: 'groups', a: { emoji: o.emoji, n: a }, b: { emoji: o.emoji, n: b }, op: '+' },
      a,
      b,
      res,
      op: '+',
      unit: o.counter,
    };
  }
  const [x, y] = twoSameCounter(r);
  return {
    text: `${x.name} ${cnt(a, x.counter)}${josa(x.counter, '과/와')} ${y.name} ${cnt(b, y.counter)}${josa(y.counter, '이/가')} 있어요.`,
    ask: `모두 몇 ${x.counter}일까요?`,
    visual: { k: 'groups', a: { emoji: x.emoji, n: a }, b: { emoji: y.emoji, n: b }, op: '+' },
    a,
    b,
    res,
    op: '+',
    unit: x.counter,
  };
}

function subStory(r: Rng, hi: number): Story {
  const a = int(r, 3, hi);
  const b = int(r, 1, a - 1);
  const res = a - b;
  if (chance(r, 0.65)) {
    const o = pick(r, STORY_OBJS);
    const v = VERBS[o.key] as Verbs;
    return {
      text: `${o.name} ${cnt(a, o.counter)}${josa(o.counter, '이/가')} 있었어요. ${cnt(b, o.counter)}${josa(o.counter, v.lp)} ${v.less}.`,
      ask: `남은 ${o.name}${josa(o.name, '은/는')} 몇 ${o.counter}일까요?`,
      visual: { k: 'objects', emoji: o.emoji, n: a, crossed: b, layout: 'row', size: 'md' },
      a,
      b,
      res,
      op: '−',
      unit: o.counter,
    };
  }
  const [x, y] = twoSameCounter(r);
  return {
    text: `${x.name} ${cnt(a, x.counter)}${josa(x.counter, '과/와')} ${y.name} ${cnt(b, y.counter)}${josa(y.counter, '이/가')} 있어요.`,
    ask: `${x.name}${josa(x.name, '은/는')} ${y.name}보다 몇 ${x.counter} 더 많을까요?`,
    visual: { k: 'groups', a: { emoji: x.emoji, n: a }, b: { emoji: y.emoji, n: b }, op: 'vs' },
    a,
    b,
    res,
    op: '−',
    unit: x.counter,
  };
}

function storyOf(r: Rng, op: Op | 'mix', hi: number): Story {
  const o: Op = op === 'mix' ? (chance(r, 0.5) ? '+' : '−') : op;
  return o === '+' ? addStory(r, hi) : subStory(r, hi);
}

const sameFamily = (s: Story, x: number, y: number, z: number): boolean => [s.a, s.b, s.res].sort().join() === [x, y, z].sort().join();

/** 이야기에 맞는 식 보기: 틀린 식은 연산을 바꾸거나 수 하나를 바꾼 것 */
function equationOptions(r: Rng, s: Story): { correct: Option; wrongs: Option[] } {
  const correctText = s.op === '+' ? eqText(s.a, '+', s.b, s.res) : eqText(s.a, '−', s.b, s.res);
  const cands: string[] = [];
  const push = (x: number, op: Op, y: number): void => {
    const z = op === '+' ? x + y : x - y;
    if (x < 1 || y < 1 || z < 1 || z > 18) return;
    if (sameFamily(s, x, y, z)) return;
    cands.push(eqText(x, op, y, z));
  };
  if (s.op === '+') {
    // 연산을 바꾼 식(큰 수에서 작은 수를 뺀다), 수를 하나 바꾼 식, 같은 수를 두 번 더한 식
    if (s.a !== s.b) push(Math.max(s.a, s.b), '−', Math.min(s.a, s.b));
    push(s.a + 1, '+', s.b);
    push(s.a, '+', s.b + 1);
    push(s.a, '+', s.a);
  } else {
    push(s.a, '+', s.b);
    push(s.a, '−', s.b + 1);
    push(s.a + 1, '−', s.b);
    if (s.b > 1) push(s.a, '−', s.b - 1);
  }
  const toOpt = (t: string): Option => ({ key: t, text: t });
  const uniq = [...new Set(cands)].filter((t) => t !== correctText);
  return { correct: toOpt(correctText), wrongs: shuffle(r, uniq).map(toOpt) };
}

const WHY_PLUS = '합치거나 더 받는 이야기는 더하기로, 덜어 내거나 남는 것을 묻는 이야기는 빼기로 나타내요.';

function pickEquationQ(c: GenCtx, s: Story): Question {
  const r = c.rng;
  const { correct, wrongs } = equationOptions(r, s);
  const text = `${s.text} ${s.ask} 이야기에 맞는 식을 골라 보세요.`;
  return mk(c, {
    prompt: text,
    say: text,
    visual: s.visual,
    answer: buildChoice(r, correct, wrongs, 3, 1),
    hint: { say: `${WHY_PLUS} 이 이야기는 ${s.op === '+' ? '합치는' : '덜어 내거나 비교하는'} 이야기예요.` },
    explain: `${s.op === '+' ? '합치는' : '덜어 내거나 비교하는'} 이야기니까 ${correct.text}${josa(correct.text ?? '', '이에요/예요')}.`,
  });
}

function resultQ(c: GenCtx, s: Story, asNumber: boolean, showPicture: boolean): Question {
  const r = c.rng;
  const text = `${s.text} ${s.ask}`;
  const answer = asNumber
    ? ({ t: 'number', correct: s.res, maxDigits: 1 } as const)
    : numChoice(r, s.res, 1, 9, { say: (v) => cnt(v, s.unit), text: (v) => cnt(v, s.unit) });
  return mk(c, {
    prompt: text,
    say: text,
    ...(showPicture ? { visual: s.visual } : {}),
    answer,
    hint: { say: s.op === '+' ? '두 수를 합쳐 봐요. 그림으로 그려 보면 쉬워요.' : '큰 수에서 작은 수를 빼 봐요. 그림으로 그려 보면 쉬워요.', visual: s.visual },
    explain: `${eqText(s.a, s.op, s.b, s.res)}이니까 ${cnt(s.res, s.unit)}예요.`,
  });
}

/** 처음 수나 덜어 낸 수를 모르는 이야기 */
function missingQ(c: GenCtx, kind: 'start' | 'taken'): Question {
  const r = c.rng;
  if (kind === 'start') {
    const o = pick(r, STORY_OBJS);
    const v = VERBS[o.key] as Verbs;
    const total = int(r, 4, 9);
    const b = int(r, 1, total - 2);
    const start = total - b;
    const text = `${o.name} 몇 ${o.counter}${josa(o.counter, '이/가')} 있었어요. ${cnt(b, o.counter)}${josa(o.counter, v.mp)} ${v.more}. 이제 모두 ${cnt(total, o.counter)}예요. 처음에는 몇 ${o.counter}${josa(o.counter, '이/가')} 있었을까요?`;
    return mk(c, {
      prompt: text,
      say: text,
      answer: { t: 'number', correct: start, maxDigits: 1 },
      hint: {
        say: '모두에서 더한 수를 빼면 처음 수가 나와요.',
        visual: { k: 'groups', a: { emoji: o.emoji, n: start, unknown: true }, b: { emoji: o.emoji, n: b }, op: '+' },
      },
      explain: `${total} − ${b} = ${start}이니까 처음에는 ${cnt(start, o.counter)} 있었어요.`,
    });
  }
  const o = pick(r, EATS);
  const total = int(r, 4, 9);
  const left = int(r, 1, total - 1);
  const taken = total - left;
  const text = `${o.name} ${cnt(total, o.counter)}${josa(o.counter, '이/가')} 있었어요. 그중 몇 ${o.counter}${josa(o.counter, '을/를')} 먹었더니 ${cnt(left, o.counter)}${josa(o.counter, '이/가')} 남았어요. 먹은 ${o.name}${josa(o.name, '은/는')} 몇 ${o.counter}일까요?`;
  return mk(c, {
    prompt: text,
    say: text,
    answer: { t: 'number', correct: taken, maxDigits: 1 },
    hint: { say: '처음 수에서 남은 수를 빼면 먹은 수가 나와요.', visual: { k: 'objects', emoji: o.emoji, n: total, crossed: taken, layout: 'row', size: 'md' } },
    explain: `${total} − ${left} = ${taken}이니까 ${cnt(taken, o.counter)} 먹었어요.`,
  });
}

/** 이야기 식 세우기. op는 더하기·빼기·섞기 */
export function storyGen(cfg: { op: Op | 'mix'; hi?: number }) {
  const hi = cfg.hi ?? 9;
  return (c: GenCtx): Question => {
    const r = c.rng;
    const s = storyOf(r, cfg.op, hi);
    if (c.level === 1) return pickEquationQ(c, s);
    if (c.level === 2) return chance(r, 0.35) ? pickEquationQ(c, s) : resultQ(c, s, false, chance(r, 0.5));
    if (chance(r, 0.3)) {
      const kind = cfg.op === '+' ? 'start' : cfg.op === '−' ? 'taken' : chance(r, 0.5) ? 'start' : 'taken';
      return missingQ(c, kind);
    }
    return resultQ(c, s, true, false);
  };
}
