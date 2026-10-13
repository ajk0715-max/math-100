import { OBJECTS } from '../objects';
import { countKo, josa } from '../ko';
import { chance, int, pick, sample, shuffle } from '../rng';
import type { GenCtx, MatchPair, Question, TapItem, Visual } from '../types';
import { numOpt, tensVis } from './place';
import { buildChoice, mk, numChoice, range } from './util';

// ---------------------------------------------------------------------------
// 도우미
// ---------------------------------------------------------------------------

const jo = (n: number, kind: Parameters<typeof josa>[1]): string => josa(String(n), kind);
const eqV = (parts: string[], tone: 'sky' | 'tangerine' | 'grape' = 'sky'): Visual => ({ k: 'eq', parts, tone });
/** 보기 읽어 주기용: 숫자는 speak()가 읽는다 */
const sn9 = (n: number): string => String(n);
const plusSign: Visual = { k: 'big', text: '+', tone: 'ink' };
const minusSign: Visual = { k: 'big', text: '−', tone: 'ink' };

/** 정답 근처 수(±1, ±2, ±10)를 오답 후보로 */
function near(n: number, lo: number, hi: number): number[] {
  return [n + 1, n - 1, n + 2, n - 2, n + 10, n - 10].filter((x) => x >= lo && x <= hi && x !== n);
}

/** 수 하나가 틀린 정도를 설명한다 */
export const calcConfuse = (e: string, g: string): string | null => {
  const a = Number(e);
  const b = Number(g);
  if (!Number.isInteger(a) || !Number.isInteger(b) || a === b) return null;
  const d = Math.abs(a - b);
  if (d === 1) return '계산이 하나 차이로 틀림';
  if (d === 10) return '십의 자리를 잘못 셈';
  return null;
};

// ---------------------------------------------------------------------------
// 10 만들기 (10이 되는 덧셈)
// ---------------------------------------------------------------------------

export function tenPicGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  const obj = pick(r, OBJECTS);
  const cn = obj.counter;
  const k = int(r, 1, 9);
  const need = 10 - k;
  const full: Visual = { k: 'objects', emoji: obj.emoji, n: 10, layout: 'frame10' };
  const explain = `${k}에 ${need}${josa(String(need), '을/를')} 더하면 10이 돼요.`;

  if (L === 1) {
    return mk(c, {
      prompt: `${obj.name} ${k}${cn}가 있어요. 10칸을 모두 채우려면 몇 ${cn}가 더 필요할까요?`,
      say: `${obj.name} ${countKo(k, cn)}가 있어요. 열 칸을 모두 채우려면 몇 ${cn}가 더 필요할까요?`,
      visual: { k: 'objects', emoji: obj.emoji, n: k, layout: 'frame10' },
      answer: numChoice(r, need, 1, 9, { say: (n) => countKo(n, cn), spread: 2 }),
      hint: { say: '비어 있는 칸을 하나씩 세어 봐요.', visual: full },
      explain,
    });
  }
  if (L === 2) {
    return mk(c, {
      prompt: `${obj.name} ${k}${cn}와 몇 ${cn}를 더하면 10${cn}가 될까요?`,
      say: `${obj.name} ${countKo(k, cn)}와 몇 ${cn}를 더하면 ${countKo(10, cn)}가 될까요?`,
      visual: { k: 'groups', a: { emoji: obj.emoji, n: k }, b: { emoji: obj.emoji, n: 0, unknown: true }, op: '+' },
      answer: numChoice(r, need, 1, 9, { say: (n) => countKo(n, cn), spread: 2 }),
      hint: { say: '10칸 틀에서 채워진 칸을 빼고 비어 있는 칸을 세어 봐요.', visual: { k: 'objects', emoji: obj.emoji, n: k, layout: 'frame10' } },
      explain,
    });
  }
  return mk(c, {
    prompt: `${k}에 얼마를 더하면 10이 될까요? 숫자를 눌러 알려 주세요.`,
    say: `${k}에 얼마를 더하면 십이 될까요? 숫자를 눌러 알려 주세요.`,
    visual: eqV([String(k), '+', '?', '=', '10'], 'grape'),
    answer: { t: 'number', correct: need, maxDigits: 1 },
    hint: { say: '10칸 틀을 떠올려 봐요. 채워진 칸이 몇이고 빈 칸이 몇인지 세어 봐요.', visual: { k: 'objects', emoji: obj.emoji, n: k, layout: 'frame10' } },
    explain,
  });
}

export function tenEqGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  const a = int(r, 1, 9);
  const b = 10 - a;
  const obj = pick(r, OBJECTS);
  const explain = `${a} + ${b} = 10이에요. ${a}${jo(a, '과/와')} ${b}${jo(b, '을/를')} 모으면 10이 돼요.`;
  const frame: Visual = { k: 'objects', emoji: obj.emoji, n: a, layout: 'frame10' };

  if (L === 1) {
    return mk(c, {
      prompt: `${a} + ${b}${jo(b, '은/는')} 얼마일까요?`,
      say: `${a} + ${b}${jo(b, '은/는')} 얼마일까요?`,
      visual: { k: 'col', items: [{ k: 'groups', a: { emoji: obj.emoji, n: a }, b: { emoji: obj.emoji, n: b }, op: '+' }, eqV([String(a), '+', String(b), '=', '?'])], gap: 8 },
      answer: buildChoice(r, numOpt(10), [numOpt(9), numOpt(11), numOpt(8)], 3),
      hint: { say: '두 무리를 합쳐서 세어 봐요. 10칸 틀이 꼭 차요.', visual: { k: 'objects', emoji: obj.emoji, n: 10, layout: 'frame10' } },
      explain,
    });
  }
  if (L === 2) {
    const form = pick(r, ['blank', 'sub'] as const);
    if (form === 'blank') {
      return mk(c, {
        prompt: `□ + ${b} = 10에서 □에 알맞은 수는 무엇일까요?`,
        say: `네모 더하기 ${b}는 십에서 네모에 알맞은 수는 무엇일까요?`,
        visual: eqV(['?', '+', String(b), '=', '10'], 'grape'),
        answer: numChoice(r, a, 1, 9, { say: sn9, spread: 2 }),
        hint: { say: `10에서 ${b}${jo(b, '을/를')} 덜어 내면 남는 수가 □예요.`, visual: frame },
        explain,
      });
    }
    return mk(c, {
      prompt: `10 − ${a}${jo(a, '은/는')} 얼마일까요?`,
      say: `10 − ${a}${jo(a, '은/는')} 얼마일까요?`,
      visual: eqV(['10', '−', String(a), '=', '?'], 'tangerine'),
      answer: numChoice(r, b, 1, 9, { say: sn9, spread: 2 }),
      hint: { say: `10칸 틀에서 ${a}칸을 지우면 남은 칸을 세어 봐요.`, visual: { k: 'objects', emoji: obj.emoji, n: 10, crossed: a, layout: 'frame10' } },
      explain: `10 − ${a} = ${b}이에요.`,
    });
  }
  const form = pick(r, ['sum', 'left', 'right', 'sub'] as const);
  if (form === 'sum') {
    return mk(c, {
      prompt: `${a} + ${b}${jo(b, '은/는')} 얼마일까요? 숫자를 눌러 알려 주세요.`,
      say: `${a} + ${b}${jo(b, '은/는')} 얼마일까요? 숫자를 눌러 알려 주세요.`,
      visual: eqV([String(a), '+', String(b), '=', '?']),
      answer: { t: 'number', correct: 10, maxDigits: 2 },
      hint: { say: '짝이 되는 두 수를 더하면 10이에요.', visual: frame },
      explain,
    });
  }
  if (form === 'sub') {
    return mk(c, {
      prompt: `10 − ${a}${jo(a, '은/는')} 얼마일까요? 숫자를 눌러 알려 주세요.`,
      say: `10 − ${a}${jo(a, '은/는')} 얼마일까요? 숫자를 눌러 알려 주세요.`,
      visual: eqV(['10', '−', String(a), '=', '?'], 'tangerine'),
      answer: { t: 'number', correct: b, maxDigits: 1 },
      hint: { say: `${a}${jo(a, '과/와')} 짝이 되는 수를 떠올려 봐요.`, visual: { k: 'objects', emoji: obj.emoji, n: 10, crossed: a, layout: 'frame10' } },
      explain: `10 − ${a} = ${b}이에요.`,
    });
  }
  const parts = form === 'left' ? ['?', '+', String(b), '=', '10'] : [String(a), '+', '?', '=', '10'];
  const given = form === 'left' ? b : a;
  const ans = form === 'left' ? a : b;
  return mk(c, {
    prompt: `물음표에 알맞은 수를 눌러 알려 주세요. ${form === 'left' ? `□ + ${b} = 10` : `${a} + □ = 10`}`,
    say: `물음표에 알맞은 수를 눌러 알려 주세요. ${form === 'left' ? `네모 더하기 ${b}는 십` : `${a} 더하기 네모는 십`}`,
    visual: eqV(parts, 'grape'),
    answer: { t: 'number', correct: ans, maxDigits: 1 },
    hint: { say: `${given}${jo(given, '과/와')} 짝이 되는 수를 찾아요. 더해서 10이 돼야 해요.`, visual: frame },
    explain,
  });
}

export function tenPairsGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;

  if (L <= 2) {
    const n = L === 1 ? 3 : 4;
    const xs = sample(r, range(1, 9), n);
    const pairs: MatchPair[] = xs.map((x) => ({ key: `p${x}`, a: { text: String(x) }, b: { text: String(10 - x) } }));
    return mk(c, {
      prompt: '더해서 10이 되는 두 수를 이어 보세요.',
      say: '더해서 십이 되는 두 수를 이어 보세요.',
      answer: { t: 'match', pairs },
      hint: { say: '1과 9, 2와 8, 3과 7, 4와 6, 5와 5가 짝이에요.', visual: { k: 'row', items: [1, 2, 3, 4].map((x) => eqV([String(x), '+', String(10 - x), '=', '10']) ), gap: 6, wrap: true } },
      explain: `${xs.map((x) => `${x} + ${10 - x} = 10`).join(', ')}이에요.`,
    });
  }
  // 여덟 개 중 더해서 10이 되는 두 수 찾기
  const p = pick(r, [1, 2, 3, 4, 6, 7, 8, 9]);
  const q = 10 - p;
  let others: number[] = [];
  for (let t = 0; t < 80; t++) {
    const pool = shuffle(r, range(1, 9).filter((x) => x !== p && x !== q)).slice(0, 4);
    const ok = pool.every((x, i) => pool.every((y, j) => i === j || x + y !== 10) && x + p !== 10 && x + q !== 10);
    if (ok) {
      others = pool;
      break;
    }
  }
  if (others.length < 4) others = [1, 2, 3, 4].filter((x) => x !== p && x !== q).slice(0, 4);
  const nums = shuffle(r, [p, q, ...others]);
  const items: TapItem[] = nums.map((x, i) => ({ key: `n${i}`, text: String(x), say: String(x) }));
  const targets = items.filter((it) => it.text === String(p) || it.text === String(q)).map((it) => it.key);
  return mk(c, {
    prompt: '더해서 10이 되는 두 수를 눌러 보세요.',
    say: '더해서 십이 되는 두 수를 눌러 보세요.',
    answer: { t: 'tapTargets', items, targets, cols: 3, need: 'all' },
    hint: { say: `${p}${jo(p, '과/와')} 짝이 되는 수를 찾아요. 더해서 10이 돼야 해요.`, visual: { k: 'objects', emoji: '🔵', n: p, layout: 'frame10' } },
    explain: `${p} + ${q} = 10이에요. ${p}${jo(p, '과/와')} ${q}${jo(q, '이/가')} 짝이에요.`,
  });
}

/** 보너스 게임: 짝이 되는 수의 풍선을 터뜨려 10 만들기 */
export function balloonsTenGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  if (L <= 2) {
    const n = L === 1 ? int(r, 1, 9) : pick(r, [1, 2, 3, 4, 6, 7, 8, 9]);
    const need = 10 - n;
    const size = L === 1 ? 4 : 6;
    const pool = shuffle(r, range(1, 9).filter((x) => x !== need)).slice(0, size - 1);
    const nums = shuffle(r, [need, ...pool]);
    const items: TapItem[] = nums.map((x) => ({ key: String(x), text: String(x), say: String(x) }));
    return mk(c, {
      prompt: `${n}${jo(n, '과/와')} 더해서 10이 되는 풍선을 터뜨려 보세요.`,
      say: `${n}${jo(n, '과/와')} 더해서 십이 되는 풍선을 터뜨려 보세요.`,
      visual: { k: 'big', text: String(n), tone: 'sky' },
      answer: { t: 'tapTargets', items, targets: [String(need)], cols: 2, need: 'one' },
      hint: { say: `${n}에 얼마를 더하면 10일까요? 10칸 틀을 떠올려 봐요.`, visual: { k: 'objects', emoji: '🔵', n, layout: 'frame10' } },
      explain: `${n} + ${need} = 10이에요.`,
    });
  }
  return tenPairsGen({ ...c, level: 3 });
}

// ---------------------------------------------------------------------------
// 세 수 계산
// ---------------------------------------------------------------------------

export interface Eq3 {
  a: number;
  op1: '+' | '−';
  b: number;
  op2: '+' | '−';
  c: number;
  first: number;
  value: number;
}

const apply = (x: number, op: '+' | '−', y: number): number => (op === '+' ? x + y : x - y);

/** 세 수 식을 하나 만든다. 중간값과 답이 모두 1 이상이고 cap 이하 */
export function randomEq3(r: GenCtx['rng'], kind: 'add' | 'sub' | 'mix', cap: number): Eq3 {
  for (let t = 0; t < 200; t++) {
    const op1: '+' | '−' = kind === 'add' ? '+' : kind === 'sub' ? '−' : chance(r, 0.5) ? '+' : '−';
    const op2: '+' | '−' = kind === 'add' ? '+' : kind === 'sub' ? '−' : op1 === '+' ? '−' : '+';
    const a = int(r, 1, cap - 1);
    const b = int(r, 1, cap - 1);
    const c = int(r, 1, cap - 1);
    const first = apply(a, op1, b);
    const value = apply(first, op2, c);
    if (first < 1 || value < 1 || first > cap || value > cap) continue;
    return { a, op1, b, op2, c, first, value };
  }
  return { a: 2, op1: '+', b: 3, op2: '+', c: 4, first: 5, value: 9 };
}

const eq3Text = (e: Eq3): string => `${e.a} ${e.op1} ${e.b} ${e.op2} ${e.c}`;
const eq3Parts = (e: Eq3, tail: string[]): string[] => [String(e.a), e.op1, String(e.b), e.op2, String(e.c), ...tail];

export function calc3Gen(cfg: { kind: 'add' | 'sub' | 'mix' }) {
  return (c: GenCtx): Question => {
    const r = c.rng;
    const L = c.level;
    const cap = L === 1 ? 7 : 10;
    const e = randomEq3(r, cfg.kind, cap);
    const obj = pick(r, OBJECTS);
    const cn = obj.counter;
    const explain = `${e.a} ${e.op1} ${e.b} = ${e.first}, ${e.first} ${e.op2} ${e.c} = ${e.value}. 앞에서부터 차례대로 계산해요.`;
    const stepHint: Visual = { k: 'col', items: [eqV([String(e.a), e.op1, String(e.b), '=', String(e.first)]), eqV([String(e.first), e.op2, String(e.c), '=', '?'], 'tangerine')], gap: 6 };
    const hint = { say: '앞의 두 수를 먼저 계산하고, 그 값에 뒤의 수를 이어서 계산해 봐요.', visual: stepHint };
    const ask = `${eq3Text(e)}${jo(e.c, '은/는')} 얼마일까요?`;

    if (L === 1) {
      // 이야기 + 그림
      let text: string;
      if (cfg.kind === 'add') text = `${obj.name} ${e.a}${cn}, ${e.b}${cn}, ${e.c}${cn}를 한곳에 모았어요. 모두 몇 ${cn}일까요?`;
      else if (cfg.kind === 'sub') text = `${obj.name} ${e.a}${cn} 중에서 ${e.b}${cn}를 먹고, 또 ${e.c}${cn}를 먹었어요. 몇 ${cn}가 남았을까요?`;
      else if (e.op1 === '+') text = `${obj.name} ${e.a}${cn}가 있었는데 ${e.b}${cn}를 더 받고, ${e.c}${cn}를 나눠 주었어요. 몇 ${cn}가 남았을까요?`;
      else text = `${obj.name} ${e.a}${cn}가 있었는데 ${e.b}${cn}를 먹고, ${e.c}${cn}를 더 받았어요. 몇 ${cn}가 되었을까요?`;
      return mk(c, {
        prompt: text,
        say: text,
        visual: eqV(eq3Parts(e, ['=', '?']), 'grape'),
        answer: numChoice(r, e.value, 1, cap, { say: (n) => countKo(n, cn) }),
        hint,
        explain,
      });
    }
    if (L === 2) {
      if (chance(r, 0.4)) {
        const mid = e.first;
        return mk(c, {
          prompt: `${eq3Text(e)}에서 먼저 계산하는 부분의 답은 얼마일까요?`,
          say: `${eq3Text(e)}에서 먼저 계산하는 부분의 답은 얼마일까요?`,
          visual: eqV(eq3Parts(e, ['=', '?']), 'grape'),
          answer: buildChoice(r, numOpt(mid), near(mid, 1, 12).map(numOpt), 3),
          hint: { say: '세 수의 계산은 앞에서부터 두 수를 먼저 계산해요.', visual: eqV([String(e.a), e.op1, String(e.b), '=', '?']) },
          explain: `먼저 ${e.a} ${e.op1} ${e.b}${jo(e.b, '을/를')} 계산하면 ${mid}${jo(mid, '이에요/예요')}.`,
        });
      }
      return mk(c, {
        prompt: ask,
        say: ask,
        visual: eqV(eq3Parts(e, ['=', '?']), 'grape'),
        answer: numChoice(r, e.value, 1, cap, { say: sn9 }),
        hint,
        explain,
      });
    }
    const roll = r();
    if (roll < 0.55) {
      return mk(c, {
        prompt: `${ask} 숫자를 눌러 알려 주세요.`,
        say: `${ask} 숫자를 눌러 알려 주세요.`,
        visual: eqV(eq3Parts(e, ['=', '?']), 'grape'),
        answer: { t: 'number', correct: e.value, maxDigits: 2 },
        hint,
        explain,
      });
    }
    // 빈칸 찾기: 마지막 수 맞히기
    return mk(c, {
      prompt: `${e.a} ${e.op1} ${e.b} ${e.op2} □ = ${e.value}에서 □에 알맞은 수는 무엇일까요?`,
      say: `${e.a} ${e.op1} ${e.b} ${e.op2} 네모는 ${e.value}에서 네모에 알맞은 수는 무엇일까요?`,
      visual: eqV([String(e.a), e.op1, String(e.b), e.op2, '?', '=', String(e.value)], 'grape'),
      answer: numChoice(r, e.c, 1, cap, { say: sn9, spread: 2 }),
      hint: { say: `${e.a} ${e.op1} ${e.b} = ${e.first}이니까, ${e.first}에서 ${e.value}${jo(e.value, '이/가')} 되려면 얼마를 ${e.op2 === '+' ? '더해야' : '빼야'} 할까요?` },
      explain: `${e.first} ${e.op2} ${e.c} = ${e.value}이니까 □는 ${e.c}${jo(e.c, '이에요/예요')}.`,
    });
  };
}

// ---------------------------------------------------------------------------
// 20 이내 받아올림·받아내림 없는 덧셈과 뺄셈
// ---------------------------------------------------------------------------

export interface Eq20 {
  a: number;
  b: number;
  op: '+' | '−';
  value: number;
}

export function randomEq20(r: GenCtx['rng'], op: '+' | '−', l1: boolean): Eq20 {
  for (let t = 0; t < 100; t++) {
    if (op === '+') {
      const a = int(r, 10, l1 ? 14 : 18);
      const o = a % 10;
      const b = int(r, 1, Math.min(9 - o, l1 ? 5 : 9));
      if (b >= 1 && a + b <= 19) return { a, b, op, value: a + b };
    } else {
      const a = int(r, 11, l1 ? 16 : 19);
      const o = a % 10;
      if (o < 1) continue;
      const b = int(r, 1, o);
      return { a, b, op, value: a - b };
    }
  }
  return op === '+' ? { a: 12, b: 5, op, value: 17 } : { a: 17, b: 5, op, value: 12 };
}

export function calc20Gen(cfg: { op: '+' | '−' }) {
  return (c: GenCtx): Question => {
    const r = c.rng;
    const L = c.level;
    const e = randomEq20(r, cfg.op, L === 1);
    const plus = cfg.op === '+';
    const o = e.a % 10;
    const ones = plus ? o + e.b : o - e.b;
    const ask = `${e.a} ${e.op} ${e.b}${jo(e.b, '은/는')} 얼마일까요?`;
    const explain = plus
      ? `낱개끼리 ${o} + ${e.b} = ${ones}이고 10개 묶음은 그대로 1개라서 ${e.value}${jo(e.value, '이에요/예요')}.`
      : `낱개끼리 ${o} − ${e.b} = ${ones}이고 10개 묶음은 그대로 1개라서 ${e.value}${jo(e.value, '이에요/예요')}.`;
    const pic: Visual = { k: 'row', items: [tensVis(e.a), plus ? plusSign : minusSign, { k: 'tens', tens: 0, ones: e.b }], gap: 10 };
    const hint = {
      say: plus ? '10개 묶음은 그대로 두고 낱개끼리 더해 봐요.' : '10개 묶음은 그대로 두고 낱개에서 빼 봐요.',
      visual: tensVis(e.value, { caption: true }),
    };
    const wrongs = [e.value + 1, e.value - 1, e.value + 10, e.value - 10, e.value + 2, e.value - 2].filter((x) => x >= 1 && x <= 20 && x !== e.value);

    if (L === 1) {
      return mk(c, {
        prompt: ask,
        say: ask,
        visual: { k: 'col', items: [pic, eqV([String(e.a), e.op, String(e.b), '=', '?'], plus ? 'sky' : 'tangerine')], gap: 8 },
        answer: buildChoice(r, numOpt(e.value), wrongs.map(numOpt), 3),
        hint,
        explain,
      });
    }
    if (L === 2) {
      if (chance(r, 0.5)) {
        return mk(c, {
          prompt: `${e.a} ${e.op} ${e.b}에서 낱개끼리 먼저 ${plus ? '더하면' : '빼면'} 얼마일까요?`,
          say: `${e.a} ${e.op} ${e.b}에서 낱개끼리 먼저 ${plus ? '더하면' : '빼면'} 얼마일까요?`,
          visual: eqV([String(o), e.op, String(e.b), '=', '?'], plus ? 'sky' : 'tangerine'),
          answer: numChoice(r, ones, 0, 9, { say: sn9 }),
          hint: { say: '십의 자리는 그대로 두고 일의 자리 숫자끼리 계산해요.', visual: tensVis(e.a, { caption: true }) },
          explain,
        });
      }
      return mk(c, {
        prompt: ask,
        say: ask,
        visual: eqV([String(e.a), e.op, String(e.b), '=', '?'], plus ? 'sky' : 'tangerine'),
        answer: buildChoice(r, numOpt(e.value), wrongs.map(numOpt), 3),
        hint,
        explain,
      });
    }
    const roll = r();
    if (roll < 0.5) {
      return mk(c, {
        prompt: `${ask} 숫자를 눌러 알려 주세요.`,
        say: `${ask} 숫자를 눌러 알려 주세요.`,
        visual: eqV([String(e.a), e.op, String(e.b), '=', '?'], plus ? 'sky' : 'tangerine'),
        answer: { t: 'number', correct: e.value, maxDigits: 2 },
        hint,
        explain,
      });
    }
    if (roll < 0.8) {
      return mk(c, {
        prompt: `${e.a} ${e.op} □ = ${e.value}에서 □에 알맞은 수는 무엇일까요?`,
        say: `${e.a} ${e.op} 네모는 ${e.value}에서 네모에 알맞은 수는 무엇일까요?`,
        visual: eqV([String(e.a), e.op, '?', '=', String(e.value)], 'grape'),
        answer: numChoice(r, e.b, 1, 9, { say: sn9, spread: 2 }),
        hint: { say: `${e.a}${jo(e.a, '과/와')} ${e.value}의 낱개 수를 비교해 봐요.`, visual: tensVis(e.a, { caption: true }) },
        explain: `${e.a} ${e.op} ${e.b} = ${e.value}이니까 □는 ${e.b}${jo(e.b, '이에요/예요')}.`,
      });
    }
    // 답이 같은 식을 모두 찾기
    const eqs: Eq20[] = [];
    const seen = new Set<string>();
    for (let t = 0; t < 40 && eqs.length < 5; t++) {
      const x = randomEq20(r, pick(r, ['+', '−'] as const), false);
      const k = `${x.a}${x.op}${x.b}`;
      if (seen.has(k) || x.value === e.value) continue;
      seen.add(k);
      eqs.push(x);
    }
    const items: TapItem[] = shuffle(r, [
      { key: 'ans', text: `${e.a} ${e.op} ${e.b}`, say: `${e.a} ${e.op} ${e.b}` },
      ...eqs.slice(0, 3).map((x) => ({ key: `${x.a}${x.op}${x.b}`, text: `${x.a} ${x.op} ${x.b}`, say: `${x.a} ${x.op} ${x.b}` })),
    ]);
    return mk(c, {
      prompt: `답이 ${e.value}인 식을 눌러 보세요.`,
      say: `답이 ${e.value}인 식을 눌러 보세요.`,
      answer: { t: 'tapTargets', items, targets: ['ans'], cols: 2, need: 'one' },
      hint: { say: '식을 하나씩 계산해서 답이 맞는지 확인해 봐요.' },
      explain: `${e.a} ${e.op} ${e.b} = ${e.value}이에요.`,
    });
  };
}

// ---------------------------------------------------------------------------
// (선택) 받아올림 맛보기: 8 + 5
// ---------------------------------------------------------------------------

export function carryTasteGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  const obj = pick(r, OBJECTS);
  let a = 9;
  let b = 4;
  for (let t = 0; t < 60; t++) {
    a = int(r, 6, 9);
    b = int(r, 3, 9);
    if (a + b >= 11 && a + b <= 16 && b > 10 - a) break;
  }
  const toTen = 10 - a;
  const rest = b - toTen;
  const total = a + b;
  const explain = `${a}에 ${toTen}${josa(String(toTen), '을/를')} 더해서 10을 만들고, 남은 ${rest}${josa(String(rest), '을/를')} 더하면 ${total}${josa(String(total), '이에요/예요')}.`;
  const frame: Visual = { k: 'objects', emoji: obj.emoji, n: total, layout: 'frame20' };

  if (L === 1) {
    return mk(c, {
      prompt: `${a}에 얼마를 더하면 10이 될까요?`,
      say: `${a}에 얼마를 더하면 십이 될까요?`,
      visual: { k: 'objects', emoji: obj.emoji, n: a, layout: 'frame10' },
      answer: numChoice(r, toTen, 1, 9, { say: sn9, spread: 2 }),
      hint: { say: '10칸 틀에서 비어 있는 칸을 세어 봐요.', visual: frame },
      explain: `${a} + ${toTen} = 10이에요.`,
    });
  }
  if (L === 2) {
    return mk(c, {
      prompt: `${a} + ${b}에서 ${b}${josa(String(b), '을/를')} ${toTen}${josa(String(toTen), '과/와')} □로 갈랐어요. □는 얼마일까요?`,
      say: `${a} 더하기 ${b}에서 ${b}${josa(String(b), '을/를')} ${toTen}${josa(String(toTen), '과/와')} 네모로 갈랐어요. 네모는 얼마일까요?`,
      visual: eqV([String(a), '+', String(toTen), '+', '?'], 'grape'),
      answer: numChoice(r, rest, 1, 9, { say: sn9, spread: 2 }),
      hint: { say: `${b}에서 ${toTen}${josa(String(toTen), '을/를')} 덜어 내고 남은 수를 구해요.`, visual: frame },
      explain,
    });
  }
  return mk(c, {
    prompt: `${a} + ${b}${josa(String(b), '은/는')} 얼마일까요?`,
    say: `${a} 더하기 ${b}${josa(String(b), '은/는')} 얼마일까요?`,
    visual: { k: 'groups', a: { emoji: obj.emoji, n: a }, b: { emoji: obj.emoji, n: b }, op: '+' },
    answer: numChoice(r, total, 11, 18, { say: sn9, spread: 2 }),
    hint: { say: `${a}에서 10을 먼저 만들어 봐요. ${toTen}${josa(String(toTen), '을/를')} 더하면 10이고, 남은 ${rest}${josa(String(rest), '을/를')} 더해요.`, visual: frame },
    explain,
  });
}

