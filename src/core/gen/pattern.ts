import { josa } from '../ko';
import { chance, int, pick, sample, shuffle, type Rng } from '../rng';
import type { GenCtx, Option, Question, ShapeKind, TapItem, Tone, Visual } from '../types';
import { buildChoice, dj, mk, range } from './util';

// ---------------------------------------------------------------------------
// 규칙 찾기: 색·그림·모양·수가 되풀이되거나 일정하게 변하는 나열
// ---------------------------------------------------------------------------

export type PKind = 'color' | 'emoji' | 'shape';

/** 나열에 쓰는 낱개 하나. 화면 그림, 보기, 읽는 이름을 한곳에 모은다 */
interface Sym {
  key: string;
  ko: string;
  option: Option;
  /** 눌러 보는 칸에 쓰는 모양 */
  tap: Pick<TapItem, 'visual' | 'text'>;
  /** 줄 세운 보기(규칙의 한 덩어리)에 쓰는 작은 그림 */
  small: Visual;
}

const COLORS: { key: Tone; ko: string }[] = [
  { key: 'tomato', ko: '빨간색' },
  { key: 'sky', ko: '파란색' },
  { key: 'sun', ko: '노란색' },
  { key: 'leaf', ko: '초록색' },
  { key: 'grape', ko: '보라색' },
  { key: 'tangerine', ko: '주황색' },
];

const ICONS: { e: string; ko: string }[] = [
  { e: '🍎', ko: '사과' },
  { e: '🍓', ko: '딸기' },
  { e: '🍪', ko: '쿠키' },
  { e: '🌸', ko: '꽃' },
  { e: '⭐', ko: '별' },
  { e: '🐥', ko: '병아리' },
  { e: '🦋', ko: '나비' },
  { e: '🐟', ko: '물고기' },
  { e: '🎈', ko: '풍선' },
  { e: '🍬', ko: '사탕' },
];

const SHAPES: { shape: ShapeKind; tone: Tone; ko: string }[] = [
  { shape: 'circle', tone: 'sky', ko: '동그라미' },
  { shape: 'triangle', tone: 'tangerine', ko: '세모' },
  { shape: 'square', tone: 'leaf', ko: '네모' },
  { shape: 'star', tone: 'sun', ko: '별' },
  { shape: 'heart', tone: 'rose', ko: '하트' },
];

const shapeVis = (shape: ShapeKind, color: Tone, size: number): Visual => ({ k: 'shape', shape, color, size });

export function symbolsOf(kind: PKind): Sym[] {
  if (kind === 'color') {
    return COLORS.map((c) => ({
      key: c.key,
      ko: c.ko,
      option: { key: c.key, visual: shapeVis('circle', c.key, 52), say: c.ko },
      tap: { visual: shapeVis('circle', c.key, 44) },
      small: shapeVis('circle', c.key, 30),
    }));
  }
  if (kind === 'emoji') {
    return ICONS.map((i) => ({
      key: i.e,
      ko: i.ko,
      option: { key: i.e, text: i.e, say: i.ko },
      tap: { text: i.e },
      small: { k: 'big', text: i.e },
    }));
  }
  return SHAPES.map((s) => ({
    key: `${s.shape}:${s.tone}`,
    ko: s.ko,
    option: { key: `${s.shape}:${s.tone}`, visual: shapeVis(s.shape, s.tone, 52), say: s.ko },
    tap: { visual: shapeVis(s.shape, s.tone, 44) },
    small: shapeVis(s.shape, s.tone, 30),
  }));
}

export const UNITS = {
  AB: [0, 1],
  AAB: [0, 0, 1],
  ABB: [0, 1, 1],
  ABC: [0, 1, 2],
  AABB: [0, 0, 1, 1],
} as const;
export type UnitName = keyof typeof UNITS;

const KIND_WORD: Record<PKind, string> = { color: '색', emoji: '그림', shape: '모양' };

function seqOf(keys: readonly string[], unit: readonly number[], n: number): string[] {
  return Array.from({ length: n }, (_, i) => keys[unit[i % unit.length] as number] as string);
}

/**
 * 빈칸을 뺀 나머지가 p칸마다 되풀이된다고 볼 때(p=1~4, 두 번 이상 보이는 규칙만) 빈칸에 들어갈 수 있는 값들.
 * 값이 하나뿐이어야 문제로 쓴다.
 */
export function blankAnswers(seq: readonly string[], blank: number): Set<string> {
  const out = new Set<string>();
  for (let p = 1; p <= 4 && p * 2 <= seq.length; p++) {
    const val = new Map<number, string>();
    let ok = true;
    for (let i = 0; i < seq.length && ok; i++) {
      if (i === blank) continue;
      const prev = val.get(i % p);
      if (prev === undefined) val.set(i % p, seq[i] as string);
      else if (prev !== seq[i]) ok = false;
    }
    if (!ok) continue;
    out.add(val.get(blank % p) ?? '?');
  }
  return out;
}

function unitKo(syms: Sym[], unit: readonly number[]): string {
  return unit.map((u) => (syms[u] as Sym).ko).join(', ');
}

function patVisual(kind: PKind, seq: string[], blanks: number[]): Visual {
  return { k: 'pattern', seq, ...(blanks.length ? { blanks } : {}), kind };
}

/** 빈칸 하나에 들어갈 것을 고르는 문제 */
function blankQ(c: GenCtx, kind: PKind, unitName: UnitName, n: number, where: 'end' | 'any'): Question {
  const r = c.rng;
  const unit = UNITS[unitName];
  const k = Math.max(...unit) + 1;
  const syms = sample(r, symbolsOf(kind), k);
  const keys = syms.map((s) => s.key);
  const seq = seqOf(keys, unit, n);
  let blank = n - 1;
  if (where === 'any') {
    for (const cand of shuffle(r, range(unit.length, n - 1))) {
      const set = blankAnswers(seq, cand);
      if (set.size === 1 && set.has(seq[cand] as string)) {
        blank = cand;
        break;
      }
    }
  }
  const ansKey = seq[blank] as string;
  const all = symbolsOf(kind);
  const ans = all.find((s) => s.key === ansKey) as Sym;
  const inUnit = syms.filter((s) => s.key !== ansKey);
  const others = shuffle(r, all.filter((s) => !keys.includes(s.key)));
  const wrongs = [...shuffle(r, inUnit), ...others].map((s) => s.option);
  const text = `규칙에 맞게 빈칸에 알맞은 ${KIND_WORD[kind]}을 골라 보세요.`;
  return mk(c, {
    prompt: text,
    say: text,
    visual: patVisual(kind, seq, [blank]),
    answer: buildChoice(r, ans.option, wrongs, 3, kind === 'emoji' ? 3 : undefined),
    hint: { say: '앞에서부터 하나씩 읽으면서 되풀이되는 부분을 찾아봐요.' },
    explain: `${unitKo(syms, unit)} 순서가 되풀이돼요. 그래서 빈칸에는 ${ans.ko}${josa(ans.ko, '이/가')} 들어가요.`,
  });
}

/** 색·그림·모양 규칙 (빈칸 하나) */
export function patternGen(kind: PKind) {
  return (c: GenCtx): Question => {
    const r = c.rng;
    if (c.level === 1) return blankQ(c, kind, 'AB', int(r, 6, 7), 'end');
    if (c.level === 2) {
      const u = pick<UnitName>(r, ['AB', 'AB', 'AAB', 'ABB', 'ABC']);
      return blankQ(c, kind, u, u === 'AB' ? 7 : 8, chance(r, 0.55) ? 'end' : 'any');
    }
    const u = pick<UnitName>(r, ['AAB', 'ABB', 'ABC', 'ABC', 'AABB']);
    return blankQ(c, kind, u, u === 'AABB' ? 9 : 8, 'any');
  };
}

// ---------------------------------------------------------------------------
// 규칙 말하기: 되풀이되는 부분 고르기, 규칙에 맞지 않는 것 찾기
// ---------------------------------------------------------------------------

/** 어느 자리에서 시작하든 cand를 되풀이해 나열을 채울 수 있는가(한 덩어리의 돌려쓰기 포함) */
const tiles = (cand: readonly string[], seq: readonly string[]): boolean =>
  cand.some((_, o) => seq.every((s, i) => s === cand[(i + o) % cand.length]));

function unitOption(kind: PKind, syms: Sym[], keys: string[]): Option {
  const parts = keys.map((k) => syms.find((s) => s.key === k) as Sym);
  const key = keys.join('|');
  const say = parts.map((s) => s.ko).join(', ');
  if (kind === 'emoji') return { key, text: parts.map((s) => s.key).join(''), say };
  return { key, visual: { k: 'row', items: parts.map((s) => s.small), gap: 4 }, say };
}

function unitQ(c: GenCtx, kind: PKind, unitName: UnitName): Question {
  const r = c.rng;
  const unit = UNITS[unitName];
  const k = Math.max(...unit) + 1;
  const all = symbolsOf(kind);
  const syms = sample(r, all, k);
  const keys = syms.map((s) => s.key);
  const n = unit.length === 2 ? 6 : 8;
  const seq = seqOf(keys, unit, n);
  const trueKeys = unit.map((u) => keys[u] as string);
  // 틀린 보기: 같은 낱개로 만든, 나열을 되풀이로 채우지 못하는 덩어리
  const pool = [...keys, ...sample(r, all.filter((s) => !keys.includes(s.key)), 1).map((s) => s.key)];
  const seen = new Set<string>([trueKeys.join('|')]);
  const wrongKeys: string[][] = [];
  for (let t = 0; t < 80 && wrongKeys.length < 4; t++) {
    const len = int(r, Math.max(1, unit.length - 1), Math.min(4, unit.length + 1));
    const cand = Array.from({ length: len }, () => pick(r, pool));
    const id = cand.join('|');
    if (seen.has(id) || tiles(cand, seq) || new Set(cand).size < 2) continue;
    seen.add(id);
    wrongKeys.push(cand);
  }
  if (wrongKeys.length < 2) return blankQ(c, kind, unitName, n, 'end');
  const everySyms = all;
  const correct = unitOption(kind, everySyms, trueKeys);
  const wrongs = wrongKeys.map((w) => unitOption(kind, everySyms, w));
  const text = '이 규칙에서 되풀이되는 부분은 어느 것일까요?';
  return mk(c, {
    prompt: text,
    say: text,
    visual: patVisual(kind, seq, []),
    answer: buildChoice(r, correct, wrongs, 3, 1),
    hint: { say: '같은 모습이 처음으로 다시 나올 때까지를 한 덩어리로 봐요.' },
    explain: `${unitKo(syms, unit)} 순서가 되풀이되는 규칙이에요.`,
  });
}

/** p칸마다 되풀이된다고 볼 때 고쳐야 하는 칸들. 한 자리에서 가장 많은 값이 둘이면(정할 수 없으면) null */
function fixesFor(seq: readonly string[], p: number): number[] | null {
  const out: number[] = [];
  for (let cls = 0; cls < p; cls++) {
    const members: number[] = [];
    for (let i = cls; i < seq.length; i += p) members.push(i);
    const count = new Map<string, number>();
    for (const i of members) count.set(seq[i] as string, (count.get(seq[i] as string) ?? 0) + 1);
    const sorted = [...count.entries()].sort((a, b) => b[1] - a[1]);
    const first = sorted[0] as [string, number];
    const second = sorted[1];
    if (second && second[1] === first[1]) return null;
    for (const i of members) if (seq[i] !== first[0]) out.push(i);
  }
  return out;
}

/** 한 칸만 틀린 나열이고, 그 칸이 하나로 정해지는지 */
function oneOdd(seq: readonly string[], odd: number, p: number): boolean {
  for (let q = 1; q <= 4 && q * 2 <= seq.length; q++) {
    const f = fixesFor(seq, q);
    if (q === p) {
      if (!f || f.length !== 1 || f[0] !== odd) return false;
    } else if (f && f.length === 1) {
      return false;
    }
  }
  return true;
}

function oddQ(c: GenCtx, kind: PKind, unitName: UnitName): Question | null {
  const r = c.rng;
  const unit = UNITS[unitName];
  const k = Math.max(...unit) + 1;
  const all = symbolsOf(kind);
  const syms = sample(r, all, k);
  const keys = syms.map((s) => s.key);
  const n = 8;
  const base = seqOf(keys, unit, n);
  for (let t = 0; t < 30; t++) {
    const odd = int(r, unit.length, n - 1);
    const bad = pick(r, all.filter((s) => s.key !== base[odd]));
    const seq = base.slice();
    seq[odd] = bad.key;
    if (!oneOdd(seq, odd, unit.length)) continue;
    const items: TapItem[] = seq.map((key, i) => {
      const s = all.find((x) => x.key === key) as Sym;
      return { key: `c${i}`, ...s.tap, say: s.ko };
    });
    const text = '규칙에 맞지 않는 것 하나를 찾아 눌러 보세요.';
    const want = (all.find((x) => x.key === base[odd]) as Sym).ko;
    return mk(c, {
      prompt: text,
      say: text,
      answer: { t: 'tapTargets', items, targets: [`c${odd}`], cols: 4, need: 'one' },
      hint: { say: '왼쪽부터 차례로 읽으면서 되풀이되는 순서에서 벗어나는 칸을 찾아봐요.' },
      explain: `${unitKo(syms, unit)} 순서가 되풀이돼야 해요. 이 칸에는 ${want}${josa(want, '이/가')} 와야 해요.`,
    });
  }
  return null;
}

/** 규칙 말하기와 틀린 것 찾기 */
export function patternRuleGen(c: GenCtx): Question {
  const r = c.rng;
  const kind = pick<PKind>(r, ['color', 'emoji', 'shape']);
  if (c.level === 1) return unitQ(c, kind, 'AB');
  if (c.level === 2) {
    if (chance(r, 0.5)) return unitQ(c, kind, pick<UnitName>(r, ['AAB', 'ABB', 'ABC']));
    return oddQ(c, kind, pick<UnitName>(r, ['AB', 'AB', 'AAB'])) ?? unitQ(c, kind, 'AAB');
  }
  if (chance(r, 0.4)) return unitQ(c, kind, pick<UnitName>(r, ['ABC', 'AABB', 'ABB']));
  return oddQ(c, kind, pick<UnitName>(r, ['AAB', 'ABB', 'ABC'])) ?? unitQ(c, kind, 'ABC');
}

// ---------------------------------------------------------------------------
// 수 규칙
// ---------------------------------------------------------------------------

interface NumRule {
  seq: number[];
  /** 규칙 이름: "2씩 커져요" */
  name: string;
  step: number;
  dir: 'up' | 'down' | 'repeat';
}

function stepSeq(r: Rng, step: number, dir: 'up' | 'down', len: number, cap: number): NumRule {
  const span = step * (len - 1);
  let start: number;
  if (dir === 'up') {
    start = step >= 5 ? step * int(r, 1, Math.max(1, Math.floor((cap - span) / step))) : int(r, 1, Math.max(1, cap - span));
  } else {
    start = step >= 5 ? step * int(r, Math.ceil((span + 1) / step), Math.floor(cap / step)) : int(r, span + 1, cap);
  }
  const seq = Array.from({ length: len }, (_, i) => (dir === 'up' ? start + step * i : start - step * i));
  return { seq, name: `${step}씩 ${dir === 'up' ? '커져요' : '작아져요'}`, step, dir };
}

function repeatSeq(r: Rng, len: number): NumRule {
  const form = pick<number[]>(r, [[1, 2], [1, 2, 3], [1, 1, 2], [2, 1]]);
  const hi = Math.max(...form);
  const a = int(r, 1, 9 - hi);
  const seq = Array.from({ length: len }, (_, i) => (form[i % form.length] as number) + a - 1);
  return { seq, name: '같은 순서가 되풀이돼요', step: 0, dir: 'repeat' };
}

/** 틀린 보기: 이미 나열에 보이는 수는 피한다. 되풀이 규칙이면 같이 도는 다른 수를 먼저 쓴다 */
function numWrongs(ans: number, step: number, seq: readonly number[], repeat: boolean): Option[] {
  const near = [ans + step, ans - step, ans + 1, ans - 1, ans + 2, ans - 2];
  const cand = repeat ? [...seq.filter((v) => v !== ans), ans + 1, ans - 1] : near;
  const ok = (v: number): boolean => v >= 0 && v !== ans;
  const fresh = cand.filter((v) => ok(v) && !seq.includes(v));
  const list = fresh.length >= 2 ? fresh : [...fresh, ...cand.filter((v) => ok(v) && seq.includes(v))];
  return [...new Set(list)].map((v) => ({ key: String(v), text: String(v) }));
}

export function patternNumGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  let rule: NumRule;
  if (L === 1) rule = stepSeq(r, pick(r, [1, 2]), 'up', 5, 12);
  else if (L === 2) rule = chance(r, 0.3) ? repeatSeq(r, 7) : stepSeq(r, pick(r, [2, 5, 10, 5]), 'up', 5, 50);
  else {
    const step = pick(r, [1, 2, 5, 10]);
    rule = chance(r, 0.25) ? repeatSeq(r, 8) : stepSeq(r, step, chance(r, 0.7) ? 'down' : 'up', 5, step <= 2 ? 20 : 50);
  }
  const len = rule.seq.length;

  // 규칙 이름 맞히기(2단계 이상에서 가끔)
  if (L >= 2 && rule.dir !== 'repeat' && chance(r, 0.3)) {
    const steps = [...new Set([rule.step, 1, 2, 5, 10])].filter((s) => s !== rule.step);
    const opts: Option[] = [rule.step, ...steps].map((s) => ({ key: String(s), text: `${s}씩`, say: `${s}씩` }));
    const word = rule.dir === 'up' ? '커지고' : '작아지고';
    const text = `수가 몇씩 ${word} 있을까요?`;
    return mk(c, {
      prompt: text,
      say: text,
      visual: { k: 'pattern', seq: rule.seq.map(String), kind: 'text' },
      answer: buildChoice(r, opts[0] as Option, opts.slice(1), 3),
      hint: { say: '이웃한 두 수를 골라 얼마나 차이가 나는지 세어 봐요.' },
      explain: `${rule.step}씩 ${rule.dir === 'up' ? '커지는' : '작아지는'} 규칙이에요.`,
    });
  }

  const seqText = rule.seq.map(String);
  let blank = rule.dir === 'repeat' ? len - 1 : L === 1 ? int(r, 2, len - 1) : int(r, 1, len - 1);
  if (rule.dir === 'repeat') {
    for (const cand of shuffle(r, range(3, len - 1))) {
      const set = blankAnswers(seqText, cand);
      if (set.size === 1 && set.has(seqText[cand] as string)) {
        blank = cand;
        break;
      }
    }
  }
  const ans = rule.seq[blank] as number;
  const text = '규칙에 맞게 빈칸에 알맞은 수를 골라 보세요.';
  return mk(c, {
    prompt: text,
    say: text,
    visual: { k: 'pattern', seq: seqText, blanks: [blank], kind: 'text' },
    answer: buildChoice(r, { key: String(ans), text: String(ans) }, numWrongs(ans, rule.step || 1, rule.seq, rule.dir === 'repeat'), 3),
    hint: { say: rule.dir === 'repeat' ? '앞에서부터 읽으면서 되풀이되는 부분을 찾아봐요.' : '이웃한 두 수가 얼마나 차이 나는지 살펴봐요.' },
    explain:
      rule.dir === 'repeat'
        ? `같은 순서가 되풀이돼요. 그래서 빈칸에는 ${dj(ans, '이/가')} 들어가요.`
        : `${rule.name}. 그래서 빈칸에는 ${dj(ans, '이/가')} 들어가요.`,
  });
}
