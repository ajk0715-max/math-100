import { OBJECTS, type Obj } from '../objects';
import { countKo, josa } from '../ko';
import { chance, int, pick, sample, shuffle, type Rng } from '../rng';
import type { GenCtx, Option, Question, TapItem, Visual } from '../types';
import { buildChoice, mk, numChoice } from './util';

// ---------------------------------------------------------------------------
// 덧셈·뺄셈 공통 도구
// ---------------------------------------------------------------------------

export type Op = '+' | '−';

/** 한 개의 식. 답은 value */
export interface Eq {
  a: number;
  op: Op;
  b: number;
  value: number;
}

const eqKey = (e: Eq): string => `${e.a}${e.op}${e.b}`;
export const eqText = (e: Eq): string => `${e.a} ${e.op} ${e.b}`;
const eqFull = (e: Eq): string => `${e.a} ${e.op} ${e.b} = ${e.value}`;
const jo = (n: number, kind: Parameters<typeof josa>[1]): string => josa(String(n), kind);

/** "2 + 3은 5예요." */
export const resultSentence = (e: Eq): string => `${e.a} ${e.op} ${e.b}${jo(e.b, '은/는')} ${e.value}${jo(e.value, '이에요/예요')}.`;

const eqVisual = (parts: string[], tone: 'sky' | 'tangerine' | 'grape' = 'sky'): Visual => ({ k: 'eq', parts, tone });
const askVisual = (e: Eq): Visual => eqVisual([String(e.a), e.op, String(e.b), '=', '?'], e.op === '+' ? 'sky' : 'tangerine');
const askText = (e: Eq): string => `${e.a} ${e.op} ${e.b}${jo(e.b, '은/는')} 얼마일까요?`;

/** 그림으로 보여 주는 식: 더하기는 두 무리, 빼기는 한 무리에서 일부를 지운다 */
export function picture(obj: Obj, e: Eq, size: 'sm' | 'md' = 'md'): Visual {
  if (e.op === '+') return { k: 'groups', a: { emoji: obj.emoji, n: e.a }, b: { emoji: obj.emoji, n: e.b }, op: '+' };
  return { k: 'objects', emoji: obj.emoji, n: e.a, crossed: e.b, layout: 'row', size };
}

/** 식 조합 전부: 더하기는 합이 lo~hi, 빼기는 처음 수가 lo~hi이고 답이 1 이상 */
export function allEquations(op: Op, lo: number, hi: number): Eq[] {
  const out: Eq[] = [];
  if (op === '+') {
    for (let a = 1; a < hi; a++) for (let b = 1; a + b <= hi; b++) if (a + b >= lo) out.push({ a, op, b, value: a + b });
  } else {
    for (let a = Math.max(2, lo); a <= hi; a++) for (let b = 1; b < a; b++) out.push({ a, op, b, value: a - b });
  }
  return out;
}

function randomEq(r: Rng, op: Op, lo: number, hi: number, cap?: number): Eq {
  const top = Math.max(2, Math.min(hi, cap ?? hi));
  const base = Math.min(top, Math.max(2, lo));
  if (op === '+') {
    const sum = int(r, base, top);
    const a = int(r, 1, sum - 1);
    return { a, op, b: sum - a, value: sum };
  }
  const a = int(r, base, top);
  const b = int(r, 1, a - 1);
  return { a, op, b, value: a - b };
}

/** 거짓인 식 보기(식 고르기용). 참인 식은 절대 넣지 않는다. */
function falseOptions(e: Eq, hi: number): Option[] {
  const outs = new Map<string, Option>();
  const add = (x: number, y: number, v: number) => {
    if (v < 1 || v > hi + 1 || x < 1 || y < 1) return;
    const truth = e.op === '+' ? x + y : x - y;
    if (truth === v) return;
    const text = `${x} ${e.op} ${y} = ${v}`;
    outs.set(text, { key: `${x}${e.op}${y}=${v}`, text, say: text });
  };
  add(e.a, e.b, e.value + 1);
  add(e.a, e.b, e.value - 1);
  add(e.a, e.b, e.value + 2);
  add(e.a, e.b + 1, e.value);
  add(e.a + 1, e.b, e.value);
  return [...outs.values()];
}

const trueOption = (e: Eq): Option => ({ key: `${eqKey(e)}=${e.value}`, text: eqFull(e), say: eqFull(e) });

// ---------------------------------------------------------------------------
// 덧셈 또는 뺄셈 한 가지를 그림 중심(pic) 또는 식 중심(eq)으로
// ---------------------------------------------------------------------------

export interface ArithCfg {
  op: Op;
  /** 합(더하기) 또는 처음 수(빼기)의 범위 */
  lo: number;
  hi: number;
  /** 1단계에서 쓰는 수의 최대 */
  l1hi: number;
  form: 'pic' | 'eq';
}

export function arithGen(cfg: ArithCfg) {
  return (c: GenCtx): Question => {
    const r = c.rng;
    const L = c.level;
    const obj = pick(r, OBJECTS);
    const cn = obj.counter;
    const e = randomEq(r, cfg.op, cfg.lo, cfg.hi, L === 1 ? cfg.l1hi : undefined);
    const plus = cfg.op === '+';
    const pic = picture(obj, e);
    const small = picture(obj, e, 'sm');
    const ask = askText(e);
    const explain = `${resultSentence(e)} ${plus ? '두 무리를 합쳐서 세면 돼요.' : '지워진 것을 빼고 남은 것을 세면 돼요.'}`;
    const hintAll: Visual = { k: 'objects', emoji: obj.emoji, n: e.value, numbered: true, layout: 'row' };
    const hint = { say: plus ? '두 무리를 합쳐서 하나씩 세어 봐요.' : '지워지지 않은 것만 하나씩 세어 봐요.', visual: hintAll };

    if (cfg.form === 'pic') {
      if (L === 1) {
        const text = plus
          ? `${obj.name} ${e.a}${cn}와 ${e.b}${cn}를 합치면 모두 몇 ${cn}일까요?`
          : `${obj.name} ${e.a}${cn} 중에서 ${e.b}${cn}를 가져가면 몇 ${cn}가 남을까요?`;
        return mk(c, {
          prompt: text,
          say: text,
          visual: pic,
          answer: numChoice(r, e.value, 1, cfg.hi + 1, { say: (n) => countKo(n, cn) }),
          hint,
          explain,
        });
      }
      if (L === 2) {
        return mk(c, {
          prompt: ask,
          say: ask,
          visual: { k: 'col', items: [small, askVisual(e)], gap: 10 },
          answer: numChoice(r, e.value, 1, cfg.hi + 1, { say: (n) => String(n) }),
          hint,
          explain,
        });
      }
      if (chance(r, 0.55)) {
        return mk(c, {
          prompt: '그림에 알맞은 식은 어느 것일까요?',
          say: '그림에 알맞은 식은 어느 것일까요?',
          visual: pic,
          answer: buildChoice(r, trueOption(e), falseOptions(e, cfg.hi), 3),
          hint: { say: plus ? '왼쪽과 오른쪽의 수를 먼저 세고, 합한 수를 확인해 봐요.' : '처음 개수와 지운 개수를 세고, 남은 수를 확인해 봐요.', visual: hintAll },
          explain,
        });
      }
      return mk(c, {
        prompt: ask,
        say: ask,
        visual: pic,
        answer: { t: 'number', correct: e.value, maxDigits: 1 },
        hint,
        explain,
      });
    }

    // ---- 식 중심 ----
    if (L === 1) {
      return mk(c, {
        prompt: ask,
        say: ask,
        visual: { k: 'col', items: [askVisual(e), small], gap: 10 },
        answer: numChoice(r, e.value, 1, cfg.hi + 1, { say: (n) => String(n) }),
        hint,
        explain,
      });
    }
    if (L === 2) {
      return mk(c, {
        prompt: ask,
        say: ask,
        visual: askVisual(e),
        answer: numChoice(r, e.value, 1, cfg.hi + 1, { say: (n) => String(n) }),
        hint: { ...hint, visual: pic },
        explain,
      });
    }
    const roll = r();
    if (roll < 0.5) {
      return mk(c, {
        prompt: ask,
        say: ask,
        visual: askVisual(e),
        answer: { t: 'number', correct: e.value, maxDigits: 1 },
        hint: { ...hint, visual: pic },
        explain,
      });
    }
    if (roll < 0.78) {
      // 빈칸 찾기: 3 + ? = 5 / 5 − ? = 2
      const q = plus ? `${e.a}에 얼마를 더하면 ${e.value}${jo(e.value, '이/가')} 될까요?` : `${e.a}에서 얼마를 빼면 ${e.value}${jo(e.value, '이/가')} 될까요?`;
      return mk(c, {
        prompt: q,
        say: q,
        visual: eqVisual([String(e.a), e.op, '?', '=', String(e.value)], plus ? 'sky' : 'tangerine'),
        answer: numChoice(r, e.b, 1, cfg.hi, { say: (n) => String(n) }),
        hint: { say: plus ? `${e.value}에서 ${e.a}만큼 덜어 내면 더한 수가 나와요.` : `${e.a}에서 ${e.value}${jo(e.value, '을/를')} 빼면 뺀 수가 나와요.`, visual: pic },
        explain: `${eqFull(e)}${jo(e.value, '이에요/예요')}. 물음표는 ${e.b}${jo(e.b, '이에요/예요')}.`,
      });
    }
    return equalAnswerTap(c, cfg.op, cfg.lo, cfg.hi, 6, false);
  };
}

/** "답이 N인 식(풍선)을 모두 눌러 보세요" 문제 */
export function equalAnswerTap(c: GenCtx, op: Op | 'mix', lo: number, hi: number, size: number, balloon: boolean): Question {
  const r = c.rng;
  const pool: Eq[] = op === 'mix' ? [...allEquations('+', lo, hi), ...allEquations('−', 2, hi)] : allEquations(op, lo, hi);
  const values = [...new Set(pool.map((e) => e.value))].filter((v) => pool.filter((e) => e.value !== v).length >= 3);
  const target = pick(r, values);
  const hits = pool.filter((e) => e.value === target);
  const targets = sample(r, hits, Math.min(hits.length, int(r, 1, 3)));
  const others = pool.filter((e) => e.value !== target);
  const rest = sample(r, others, Math.min(size - targets.length, others.length));
  const items: TapItem[] = shuffle(r, [...targets, ...rest]).map((e) => ({ key: eqKey(e), text: eqText(e), say: eqText(e) }));
  const noun = balloon ? '풍선' : '식';
  const act = balloon ? '터뜨려' : '눌러';
  const text = `답이 ${target}인 ${noun}${josa(noun, '을/를')} ${targets.length === 1 ? '' : '모두 '}${act} 보세요.`;
  return mk(c, {
    prompt: text,
    say: text,
    answer: { t: 'tapTargets', items, targets: targets.map(eqKey), cols: 3, need: targets.length === 1 ? 'one' : 'all' },
    hint: { say: '식을 하나씩 계산해서 답이 맞는지 확인해 봐요.' },
    explain: `답이 ${target}인 식은 ${targets.map(eqText).join(', ')}${jo(targets[targets.length - 1]?.b ?? 1, '이에요/예요')}.`,
  });
}

// ---------------------------------------------------------------------------
// 더하기·빼기 섞기
// ---------------------------------------------------------------------------

const OPS: Option[] = [
  { key: '+', text: '+ 더하기', say: '더하기' },
  { key: '−', text: '− 빼기', say: '빼기' },
];

export function mixGen(cfg: { hi: number; l1hi: number }) {
  return (c: GenCtx): Question => {
    const r = c.rng;
    const L = c.level;
    const obj = pick(r, OBJECTS);
    const cn = obj.counter;
    const op: Op = chance(r, 0.5) ? '+' : '−';
    const e = randomEq(r, op, 2, cfg.hi, L === 1 ? cfg.l1hi : undefined);
    const plus = op === '+';
    const pic = picture(obj, e);
    const ask = askText(e);
    const explain = resultSentence(e);
    const hintPic = { say: plus ? '더하기는 두 무리를 합치는 거예요.' : '빼기는 한 무리에서 덜어 내는 거예요.', visual: pic };
    const right = OPS[plus ? 0 : 1] as Option;
    const wrong = OPS[plus ? 1 : 0] as Option;

    if (L === 1) {
      const text = plus
        ? `${obj.name} ${e.a}${cn}가 있었는데 ${e.b}${cn}를 더 받았어요. 어느 계산일까요?`
        : `${obj.name} ${e.a}${cn}가 있었는데 ${e.b}${cn}를 가져갔어요. 어느 계산일까요?`;
      return mk(c, {
        prompt: text,
        say: text,
        visual: pic,
        answer: buildChoice(r, right, [wrong], 2, 2),
        hint: { say: '더 받으면 많아지니까 더하기, 가져가면 적어지니까 빼기예요.' },
        explain: plus ? '더 받아서 많아졌으니 더하기예요.' : '가져가서 적어졌으니 빼기예요.',
      });
    }
    if (L === 2) {
      if (chance(r, 0.45)) {
        const q = `${e.a}${jo(e.a, '과/와')} ${e.b} 사이에 어떤 기호를 넣으면 ${e.value}${jo(e.value, '이/가')} 될까요?`;
        return mk(c, {
          prompt: q,
          say: q,
          visual: eqVisual([String(e.a), '?', String(e.b), '=', String(e.value)], 'grape'),
          answer: buildChoice(r, right, [wrong], 2, 2),
          hint: { say: `${e.a}에서 ${e.value}${jo(e.value, '으로/로')} ${plus ? '커졌으니 더하기예요.' : '작아졌으니 빼기예요.'}`, visual: pic },
          explain: `${e.a} ${e.op} ${e.b} = ${e.value}${jo(e.value, '이에요/예요')}.`,
        });
      }
      return mk(c, {
        prompt: ask,
        say: ask,
        visual: askVisual(e),
        answer: numChoice(r, e.value, 1, cfg.hi + 1, { say: (n) => String(n) }),
        hint: hintPic,
        explain,
      });
    }
    const roll = r();
    if (roll < 0.4) {
      return mk(c, {
        prompt: ask,
        say: ask,
        visual: askVisual(e),
        answer: { t: 'number', correct: e.value, maxDigits: 1 },
        hint: hintPic,
        explain,
      });
    }
    if (roll < 0.7) {
      const text = plus
        ? `접시에 ${obj.name} ${e.a}${cn}가 있어요. ${e.b}${cn}를 더 올렸어요. 모두 몇 ${cn}일까요?`
        : `접시에 ${obj.name} ${e.a}${cn}가 있어요. ${e.b}${cn}를 덜어 냈어요. 몇 ${cn}가 남았을까요?`;
      return mk(c, {
        prompt: text,
        say: text,
        answer: numChoice(r, e.value, 1, cfg.hi + 1, { say: (n) => countKo(n, cn) }),
        hint: hintPic,
        explain,
      });
    }
    return equalAnswerTap(c, 'mix', 2, cfg.hi, 6, false);
  };
}

// ---------------------------------------------------------------------------
// 풍선 터뜨리기: 식의 답이 적힌 풍선을 눌러 터뜨린다
// ---------------------------------------------------------------------------

export function balloonsArithGen(cfg: { op: Op | 'mix'; lo: number; hi: number }) {
  return (c: GenCtx): Question => {
    const r = c.rng;
    const L = c.level;
    if (L === 1) {
      const op: Op = cfg.op === 'mix' ? (chance(r, 0.5) ? '+' : '−') : cfg.op;
      const e = randomEq(r, op, cfg.lo, cfg.hi, Math.max(cfg.lo, 5));
      const nums = new Set<number>([e.value]);
      for (let g = 0; g < 60 && nums.size < 4; g++) nums.add(int(r, 1, cfg.hi));
      const items: TapItem[] = shuffle(r, [...nums]).map((n) => ({ key: String(n), text: String(n), say: String(n) }));
      const text = `${e.a} ${e.op} ${e.b}의 답이 적힌 풍선을 터뜨려 보세요.`;
      return mk(c, {
        prompt: text,
        say: text,
        visual: askVisual(e),
        answer: { t: 'tapTargets', items, targets: [String(e.value)], cols: 2, need: 'one' },
        hint: { say: '식을 먼저 계산하고, 그 수가 적힌 풍선을 찾아요.' },
        explain: resultSentence(e),
      });
    }
    return equalAnswerTap(c, cfg.op, cfg.lo, cfg.hi, L === 2 ? 6 : 8, true);
  };
}
