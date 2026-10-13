import { josa } from '../ko';
import { chance, int, pick, sample, shuffle, type Rng } from '../rng';
import type { GenCtx, Option, Question, ShapeKind, TapItem, Tone, Visual } from '../types';
import { buildChoice, mk, numChoice } from './util';

// ---------------------------------------------------------------------------
// 분류하기, 세어서 비교하기, 표와 그림그래프 읽기
// ---------------------------------------------------------------------------

export interface Item {
  e: string;
  ko: string;
}

interface Cat {
  key: string;
  name: string;
  /** 세는 말: 개, 마리, 대 */
  counter: string;
  items: Item[];
}

export const CATS: Cat[] = [
  {
    key: 'fruit',
    name: '과일',
    counter: '개',
    items: [
      { e: '🍎', ko: '사과' },
      { e: '🍌', ko: '바나나' },
      { e: '🍇', ko: '포도' },
      { e: '🍓', ko: '딸기' },
      { e: '🍊', ko: '귤' },
      { e: '🍉', ko: '수박' },
    ],
  },
  {
    key: 'animal',
    name: '동물',
    counter: '마리',
    items: [
      { e: '🐶', ko: '강아지' },
      { e: '🐱', ko: '고양이' },
      { e: '🐰', ko: '토끼' },
      { e: '🐻', ko: '곰' },
      { e: '🐸', ko: '개구리' },
      { e: '🐼', ko: '판다' },
    ],
  },
  {
    key: 'vehicle',
    name: '탈것',
    counter: '대',
    items: [
      { e: '🚗', ko: '자동차' },
      { e: '🚌', ko: '버스' },
      { e: '🚲', ko: '자전거' },
      { e: '✈️', ko: '비행기' },
      { e: '🚑', ko: '구급차' },
      { e: '🚂', ko: '기차' },
    ],
  },
  {
    key: 'school',
    name: '학용품',
    counter: '개',
    items: [
      { e: '✏️', ko: '연필' },
      { e: '📏', ko: '자' },
      { e: '✂️', ko: '가위' },
      { e: '📚', ko: '책' },
      { e: '🎒', ko: '가방' },
      { e: '📒', ko: '공책' },
    ],
  },
];

export const lab = (it: Item): string => `${it.e} ${it.ko}`;
export const labOpt = (it: Item): Option => ({ key: it.e, text: lab(it), say: it.ko });
const catOf = (it: Item): Cat => CATS.find((c) => c.items.some((i) => i.e === it.e)) as Cat;
/** 3마리, 4개처럼 그림 종류에 맞는 세는 말을 붙인다 */
const num = (n: number, it: Item): string => `${n}${catOf(it).counter}`;
const cntOpt = (n: number, counter: string): Option => ({ key: String(n), text: `${n}${counter}`, say: `${n}${counter}` });
const cntFmt = (counter: string) => ({ say: (v: number) => `${v}${counter}`, text: (v: number) => `${v}${counter}` });

function bagVisual(r: Rng, counts: [Item, number][]): Visual {
  return { k: 'bag', items: shuffle(r, counts.flatMap(([it, n]) => Array.from({ length: n }, () => it.e))) };
}

/** 종류가 다른 그림 n개를 pool에서 되풀이를 허용해 뽑는다 */
function draw(r: Rng, pool: Item[], n: number): Item[] {
  const out: Item[] = [];
  const bag = shuffle(r, pool);
  for (let i = 0; i < n; i++) out.push(bag[i % bag.length] as Item);
  return out;
}

const TONES: { key: Tone; ko: string }[] = [
  { key: 'tomato', ko: '빨간색' },
  { key: 'sky', ko: '파란색' },
  { key: 'sun', ko: '노란색' },
  { key: 'leaf', ko: '초록색' },
];
const FORMS: ShapeKind[] = ['circle', 'square', 'triangle', 'star', 'heart'];

// ---------------------------------------------------------------------------
// 분류하기
// ---------------------------------------------------------------------------

function sortCountQ(c: GenCtx): Question {
  const r = c.rng;
  const [a, b] = sample(r, CATS, 2) as [Cat, Cat];
  const na = int(r, 2, 5);
  const nb = int(r, 2, 4);
  const itemsA = draw(r, sample(r, a.items, 3), na);
  const itemsB = draw(r, sample(r, b.items, 3), nb);
  const text = `${a.name}${josa(a.name, '은/는')} 모두 몇 ${a.counter}일까요?`;
  const wrongs = [nb, na + 1, na - 1, na + 2].filter((v) => v >= 1 && v !== na).map((v) => cntOpt(v, a.counter));
  return mk(c, {
    prompt: text,
    say: text,
    visual: { k: 'bag', items: shuffle(r, [...itemsA, ...itemsB].map((x) => x.e)) },
    answer: buildChoice(r, cntOpt(na, a.counter), wrongs, 3),
    hint: { say: `${a.name}만 하나씩 짚으면서 세어 봐요. ${b.name}${josa(b.name, '은/는')} 세지 않아요.` },
    explain: `${a.name}${josa(a.name, '은/는')} 모두 ${na}${a.counter}예요.`,
  });
}

function sortTapCatQ(c: GenCtx): Question {
  const r = c.rng;
  const [a, ...rest] = shuffle(r, CATS) as [Cat, ...Cat[]];
  const total = int(r, 6, 8);
  const nt = int(r, 2, 4);
  const targets = sample(r, a.items, nt);
  const others = sample(r, rest.slice(0, 2).flatMap((x) => x.items), total - nt);
  const items: TapItem[] = shuffle(r, [...targets, ...others]).map((it) => ({ key: it.e, text: it.e, say: it.ko }));
  const text = `${a.name}${josa(a.name, '을/를')} 모두 찾아 눌러 보세요.`;
  return mk(c, {
    prompt: text,
    say: text,
    answer: { t: 'tapTargets', items, targets: targets.map((t) => t.e), cols: 4, need: 'all' },
    hint: { say: `${a.name}에 속하는 것만 찾아요. 하나씩 이름을 말해 보면 쉬워요.` },
    explain: `${a.name}${josa(a.name, '은/는')} ${targets.map((t) => t.ko).join(', ')} ${nt}가지예요.`,
  });
}

function sortTapColorQ(c: GenCtx): Question {
  const r = c.rng;
  const tones = sample(r, TONES, 3);
  const target = tones[0] as (typeof TONES)[number];
  const total = 8;
  const nt = int(r, 2, 4);
  const cells: { shape: ShapeKind; tone: Tone }[] = [];
  for (let i = 0; i < total; i++) {
    const tone = i < nt ? target.key : (pick(r, tones.slice(1)) as (typeof TONES)[number]).key;
    cells.push({ shape: pick(r, FORMS), tone });
  }
  const mixed = shuffle(r, cells);
  const items: TapItem[] = mixed.map((x, i) => ({ key: `s${i}`, visual: { k: 'shape', shape: x.shape, color: x.tone, size: 44 } }));
  const hits = mixed.map((x, i) => (x.tone === target.key ? `s${i}` : '')).filter(Boolean);
  const text = `${target.ko}을 모두 찾아 눌러 보세요.`;
  return mk(c, {
    prompt: text,
    say: text,
    answer: { t: 'tapTargets', items, targets: hits, cols: 4, need: 'all' },
    hint: { say: `모양은 달라도 색깔이 ${target.ko}인 것을 찾아요.` },
    explain: `${target.ko} 모양은 모두 ${hits.length}개예요.`,
  });
}

function oddOneQ(c: GenCtx): Question {
  const r = c.rng;
  const [a, b] = sample(r, CATS, 2) as [Cat, Cat];
  const same = sample(r, a.items, 3);
  const odd = pick(r, b.items);
  const items: TapItem[] = shuffle(r, [...same, odd]).map((it) => ({ key: it.e, text: it.e, say: it.ko }));
  const text = '다른 것 하나를 찾아 눌러 보세요.';
  return mk(c, {
    prompt: text,
    say: text,
    answer: { t: 'tapTargets', items, targets: [odd.e], cols: 4, need: 'one' },
    hint: { say: '하나씩 이름을 말해 보고, 같은 무리끼리 묶어 봐요.' },
    explain: `나머지는 모두 ${a.name}인데 ${odd.ko}${josa(odd.ko, '은/는')} ${b.name}${josa(b.name, '이에요/예요')}.`,
  });
}

function groupNameQ(c: GenCtx): Question {
  const r = c.rng;
  const a = pick(r, CATS);
  const n = int(r, 4, 6);
  const items = draw(r, sample(r, a.items, 4), n);
  const opts: Option[] = CATS.map((x) => ({ key: x.key, text: x.name, say: x.name }));
  const text = '무엇끼리 모아 놓은 것일까요?';
  return mk(c, {
    prompt: text,
    say: text,
    visual: { k: 'bag', items: items.map((x) => x.e) },
    answer: buildChoice(r, opts.find((o) => o.key === a.key) as Option, opts.filter((o) => o.key !== a.key), 3),
    hint: { say: '그림을 하나씩 보고 어떤 점이 같은지 생각해 봐요.' },
    explain: `모두 ${a.name}${josa(a.name, '이에요/예요')}.`,
  });
}

export function sortGen(c: GenCtx): Question {
  const r = c.rng;
  if (c.level === 1) return chance(r, 0.65) ? sortCountQ(c) : sortTapCatQ(c);
  if (c.level === 2) return chance(r, 0.5) ? sortTapCatQ(c) : sortTapColorQ(c);
  const roll = r();
  if (roll < 0.35) return oddOneQ(c);
  if (roll < 0.65) return groupNameQ(c);
  if (roll < 0.85) return sortTapColorQ(c);
  return sortCountQ(c);
}

// ---------------------------------------------------------------------------
// 세어서 비교하기
// ---------------------------------------------------------------------------

/** 서로 다른 개수 n개 (lo~hi) */
function distinctCounts(r: Rng, n: number, lo: number, hi: number): number[] {
  const pool: number[] = [];
  for (let v = lo; v <= hi; v++) pool.push(v);
  return sample(r, pool, n);
}

function pickKinds(r: Rng, n: number): Item[] {
  const cat = pick(r, CATS);
  return sample(r, cat.items, n);
}

export function countCompareGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;

  if (L === 1) {
    const kinds = pickKinds(r, 2);
    const counts = distinctCounts(r, 2, 1, 6);
    const target = int(r, 0, 1);
    const it = kinds[target] as Item;
    const n = counts[target] as number;
    const cn = catOf(it).counter;
    const text = `${it.ko}${josa(it.ko, '은/는')} 모두 몇 ${cn}일까요?`;
    return mk(c, {
      prompt: text,
      say: text,
      visual: bagVisual(r, kinds.map((k, i) => [k, counts[i] as number] as [Item, number])),
      answer: buildChoice(r, cntOpt(n, cn), [counts[1 - target] as number, n + 1, n - 1, n + 2].filter((v) => v >= 1 && v !== n).map((v) => cntOpt(v, cn)), 3),
      hint: { say: `${it.ko}만 하나씩 짚으면서 세어 봐요.` },
      explain: `${it.ko}${josa(it.ko, '은/는')} 모두 ${n}${cn}예요.`,
    });
  }

  if (L === 2) {
    const kinds = pickKinds(r, 3);
    const counts = distinctCounts(r, 3, 1, 6);
    const most = chance(r, 0.6);
    const idx = counts.indexOf(most ? Math.max(...counts) : Math.min(...counts));
    const right = kinds[idx] as Item;
    const text = `${most ? '가장 많은' : '가장 적은'} 것은 무엇일까요?`;
    return mk(c, {
      prompt: text,
      say: text,
      visual: bagVisual(r, kinds.map((k, i) => [k, counts[i] as number] as [Item, number])),
      answer: buildChoice(r, labOpt(right), kinds.filter((k) => k !== right).map(labOpt), 3),
      hint: { say: '종류별로 따로 세어서 어느 것이 더 많은지 비교해 봐요.' },
      explain: `${kinds.map((k, i) => `${k.ko} ${num(counts[i] as number, k)}`).join(', ')}이니까 ${most ? '가장 많은' : '가장 적은'} 것은 ${right.ko}${josa(right.ko, '이에요/예요')}.`,
    });
  }

  const kinds = pickKinds(r, 2);
  const counts = distinctCounts(r, 2, 1, 7);
  const big = counts[0] as number >= (counts[1] as number) ? 0 : 1;
  const a = kinds[big] as Item;
  const b = kinds[1 - big] as Item;
  const diff = Math.abs((counts[0] as number) - (counts[1] as number));
  const vis = bagVisual(r, kinds.map((k, i) => [k, counts[i] as number] as [Item, number]));
  if (chance(r, 0.65)) {
    const cn = catOf(a).counter;
    const text = `${a.ko}${josa(a.ko, '은/는')} ${b.ko}보다 몇 ${cn} 더 많을까요?`;
    return mk(c, {
      prompt: text,
      say: text,
      visual: vis,
      answer: numChoice(r, diff, 1, 6, cntFmt(cn)),
      hint: { say: `${a.ko}${josa(a.ko, '과/와')} ${b.ko}${josa(b.ko, '을/를')} 각각 세고, 큰 수에서 작은 수를 빼 봐요.` },
      explain: `${a.ko} ${num(counts[big] as number, a)}, ${b.ko} ${num(counts[1 - big] as number, b)}이니까 ${num(diff, a)} 더 많아요.`,
    });
  }
  const sum = (counts[0] as number) + (counts[1] as number);
  const cn2 = catOf(a).counter;
  const text = `${a.ko}${josa(a.ko, '과/와')} ${b.ko}${josa(b.ko, '은/는')} 모두 몇 ${cn2}일까요?`;
  return mk(c, {
    prompt: text,
    say: text,
    visual: vis,
    answer: numChoice(r, sum, 2, 13, cntFmt(cn2)),
    hint: { say: `${a.ko}${josa(a.ko, '과/와')} ${b.ko}${josa(b.ko, '을/를')} 각각 세고 합쳐 봐요.` },
    explain: `${a.ko} ${num(counts[big] as number, a)}와 ${b.ko} ${num(counts[1 - big] as number, b)}를 합치면 ${num(sum, a)}예요.`,
  });
}

// ---------------------------------------------------------------------------
// 표 읽기
// ---------------------------------------------------------------------------

function tableVisual(cat: Cat, kinds: Item[], counts: (number | null)[], tone: Tone = 'sky'): Visual {
  return { k: 'table', head: [cat.name, '개수'], rows: kinds.map((k, i) => [lab(k), counts[i] as number | null]), tone };
}

export function tableGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  const cat = pick(r, CATS);
  const kinds = sample(r, cat.items, 3);

  if (L === 1) {
    const counts = distinctCounts(r, 3, 1, 8);
    const t = int(r, 0, 2);
    const it = kinds[t] as Item;
    const n = counts[t] as number;
    const text = `표를 보고 ${it.ko}${josa(it.ko, '은/는')} 몇 ${cat.counter}인지 골라 보세요.`;
    return mk(c, {
      prompt: text,
      say: text,
      visual: tableVisual(cat, kinds, counts),
      answer: numChoice(r, n, 1, 8, cntFmt(cat.counter)),
      hint: { say: `${it.ko}${josa(it.ko, '이/가')} 있는 줄에서 오른쪽의 수를 읽어요.` },
      explain: `${it.ko}${josa(it.ko, '은/는')} ${n}${cat.counter}예요.`,
    });
  }

  if (L === 2) {
    const counts = distinctCounts(r, 3, 1, 9);
    const most = chance(r, 0.55);
    const idx = counts.indexOf(most ? Math.max(...counts) : Math.min(...counts));
    const right = kinds[idx] as Item;
    const text = `표에서 ${most ? '가장 많은' : '가장 적은'} 것은 무엇일까요?`;
    return mk(c, {
      prompt: text,
      say: text,
      visual: tableVisual(cat, kinds, counts, 'tangerine'),
      answer: buildChoice(r, labOpt(right), kinds.filter((k) => k !== right).map(labOpt), 3),
      hint: { say: '오른쪽의 수를 모두 읽고 서로 비교해 봐요.' },
      explain: `${right.ko}${josa(right.ko, '이/가')} ${counts[idx]}${cat.counter}로 ${most ? '가장 많아요' : '가장 적어요'}.`,
    });
  }

  const roll = r();
  if (roll < 0.45) {
    // 그림을 세어 표의 빈칸 채우기
    const counts = distinctCounts(r, 3, 1, 5);
    const q = int(r, 0, 2);
    const shown = counts.map((v, i) => (i === q ? null : v));
    const it = kinds[q] as Item;
    const n = counts[q] as number;
    const text = `그림을 세어서 표의 물음표에 알맞은 수를 골라 보세요.`;
    return mk(c, {
      prompt: text,
      say: text,
      visual: { k: 'col', items: [bagVisual(r, kinds.map((k, i) => [k, counts[i] as number] as [Item, number])), tableVisual(cat, kinds, shown, 'grape')], gap: 8 },
      answer: numChoice(r, n, 1, 6, cntFmt(cat.counter)),
      hint: { say: `${it.ko}만 그림에서 찾아 세어 봐요.` },
      explain: `그림에서 ${it.ko}${josa(it.ko, '은/는')} ${n}${cat.counter}예요.`,
    });
  }
  if (roll < 0.75) {
    const counts = distinctCounts(r, 3, 1, 6);
    const sum = counts.reduce((a, b) => a + b, 0);
    const text = `표를 보고 모두 몇 ${cat.counter}인지 골라 보세요.`;
    return mk(c, {
      prompt: text,
      say: text,
      visual: tableVisual(cat, kinds, counts, 'leaf'),
      answer: numChoice(r, sum, 3, 16, cntFmt(cat.counter)),
      hint: { say: '표의 수를 모두 더해 봐요.' },
      explain: `${counts.join(' + ')} = ${sum}이니까 모두 ${sum}${cat.counter}예요.`,
    });
  }
  const counts = distinctCounts(r, 3, 1, 9);
  const [i, j] = sample(r, [0, 1, 2], 2) as [number, number];
  const hi = (counts[i] as number) >= (counts[j] as number) ? i : j;
  const lo = hi === i ? j : i;
  const a = kinds[hi] as Item;
  const b = kinds[lo] as Item;
  const diff = (counts[hi] as number) - (counts[lo] as number);
  const text = `${a.ko}${josa(a.ko, '은/는')} ${b.ko}보다 몇 ${cat.counter} 더 많을까요?`;
  return mk(c, {
    prompt: text,
    say: text,
    visual: tableVisual(cat, kinds, counts, 'sky'),
    answer: numChoice(r, diff, 1, 8, cntFmt(cat.counter)),
    hint: { say: `${a.ko}의 수에서 ${b.ko}의 수를 빼 봐요.` },
    explain: `${counts[hi]} − ${counts[lo]} = ${diff}이니까 ${diff}${cat.counter} 더 많아요.`,
  });
}

// ---------------------------------------------------------------------------
// 그림그래프 읽기
// ---------------------------------------------------------------------------

function pictoRows(kinds: Item[], counts: number[]): Visual {
  return { k: 'pictograph', rows: kinds.map((k, i) => ({ emoji: k.e, n: counts[i] as number, label: k.ko })) };
}

export function pictoGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  const cat = pick(r, CATS);

  if (L === 1) {
    const kinds = sample(r, cat.items, 3);
    const counts = distinctCounts(r, 3, 1, 7);
    const most = chance(r, 0.6);
    const idx = counts.indexOf(most ? Math.max(...counts) : Math.min(...counts));
    const right = kinds[idx] as Item;
    const text = `${most ? '가장 많은' : '가장 적은'} 것은 무엇일까요?`;
    return mk(c, {
      prompt: text,
      say: text,
      visual: pictoRows(kinds, counts),
      answer: buildChoice(r, labOpt(right), kinds.filter((k) => k !== right).map(labOpt), 3),
      hint: { say: '그림이 가장 긴 줄(또는 가장 짧은 줄)을 찾아요.' },
      explain: `${right.ko}${josa(right.ko, '은/는')} 그림이 ${counts[idx]}개로 ${most ? '가장 많아요' : '가장 적어요'}.`,
    });
  }

  if (L === 2) {
    const kinds = sample(r, cat.items, 3);
    const counts = distinctCounts(r, 3, 1, 8);
    const t = int(r, 0, 2);
    const it = kinds[t] as Item;
    const n = counts[t] as number;
    const text = `${it.ko}${josa(it.ko, '은/는')} 몇 ${cat.counter}일까요?`;
    return mk(c, {
      prompt: text,
      say: text,
      visual: pictoRows(kinds, counts),
      answer: numChoice(r, n, 1, 8, cntFmt(cat.counter)),
      hint: { say: `${it.ko} 줄의 그림을 하나씩 세어 봐요.` },
      explain: `${it.ko}${josa(it.ko, '은/는')} ${n}${cat.counter}예요.`,
    });
  }

  const kinds = sample(r, cat.items, 3);
  const roll = r();
  if (roll < 0.4) {
    const counts = distinctCounts(r, 3, 1, 8);
    const [i, j] = sample(r, [0, 1, 2], 2) as [number, number];
    const hi = (counts[i] as number) >= (counts[j] as number) ? i : j;
    const lo = hi === i ? j : i;
    const a = kinds[hi] as Item;
    const b = kinds[lo] as Item;
    const diff = (counts[hi] as number) - (counts[lo] as number);
    const text = `${a.ko}${josa(a.ko, '은/는')} ${b.ko}보다 몇 ${cat.counter} 더 많을까요?`;
    return mk(c, {
      prompt: text,
      say: text,
      visual: pictoRows(kinds, counts),
      answer: numChoice(r, diff, 1, 7, cntFmt(cat.counter)),
      hint: { say: `두 줄의 그림을 각각 세고 큰 수에서 작은 수를 빼 봐요.` },
      explain: `${counts[hi]} − ${counts[lo]} = ${diff}이니까 ${diff}${cat.counter} 더 많아요.`,
    });
  }
  if (roll < 0.75) {
    const counts = distinctCounts(r, 3, 1, 6);
    const sum = counts.reduce((a, b) => a + b, 0);
    const text = '그림이 모두 몇 개일까요?';
    return mk(c, {
      prompt: text,
      say: text,
      visual: pictoRows(kinds, counts),
      answer: numChoice(r, sum, 3, 16, cntFmt('개')),
      hint: { say: '세 줄의 그림을 모두 세어서 더해 봐요.' },
      explain: `${counts.join(' + ')} = ${sum}이니까 모두 ${sum}개예요.`,
    });
  }
  // 개수가 다른 한 줄 찾기
  const same = int(r, 2, 7);
  const other = pick(
    r,
    [1, 2, 3, 4, 5, 6, 7, 8].filter((v) => v !== same),
  );
  const counts3 = shuffle(r, [same, same, other]);
  const oddIdx = counts3.findIndex((v) => v !== same);
  const odd = kinds[oddIdx] as Item;
  const sameNames = kinds.filter((_, k) => k !== oddIdx).map((x) => x.ko) as [string, string];
  const text = '개수가 다른 한 줄을 골라 보세요.';
  return mk(c, {
    prompt: text,
    say: text,
    visual: pictoRows(kinds, counts3),
    answer: buildChoice(r, labOpt(odd), kinds.filter((_, k) => k !== oddIdx).map(labOpt), 3),
    hint: { say: '세 줄을 각각 세어 보면 두 줄은 같고 한 줄은 달라요.' },
    explain: `${sameNames[0]}${josa(sameNames[0], '과/와')} ${sameNames[1]}${josa(sameNames[1], '은/는')} ${same}${cat.counter}로 같고, ${odd.ko}${josa(odd.ko, '은/는')} ${other}${cat.counter}로 달라요.`,
  });
}
