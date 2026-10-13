import { josa, withJosa } from '../ko';
import { chance, int, pick, sample, shuffle, type Rng } from '../rng';
import type { GenCtx, Group, Option, OrderItem, Question, TapItem, Tone, Visual } from '../types';
import { buildChoice, mk, numChoice, shuffleDiff } from './util';

// ---------------------------------------------------------------------------
// 길이·높이 비교: 색 막대
// ---------------------------------------------------------------------------

interface Hue {
  adj: string;
  tone: Tone;
  dot: string;
}

const HUES: Hue[] = [
  { adj: '빨간', tone: 'tomato', dot: '🔴' },
  { adj: '파란', tone: 'sky', dot: '🔵' },
  { adj: '노란', tone: 'sun', dot: '🟡' },
  { adj: '초록색', tone: 'leaf', dot: '🟢' },
  { adj: '보라색', tone: 'grape', dot: '🟣' },
  { adj: '주황색', tone: 'tangerine', dot: '🟠' },
];

const LONG_THINGS = ['연필', '리본', '끈', '막대', '색연필'];
const TALL_THINGS = ['탑', '블록 탑', '기둥'];

const labelOf = (h: Hue, thing: string): string => `${h.adj} ${thing}`;

interface Bar {
  hue: Hue;
  value: number;
  label: string;
}

/** 서로 gap 이상 차이 나는 서로 다른 값 n개 (lo~hi) */
/** 서로 gap 이상 떨어진 n개의 값(lo~hi)을 섞어서 돌려준다. 자리가 모자라면 간격을 줄인다 */
function spacedValues(r: Rng, n: number, lo: number, hi: number, gap: number): number[] {
  const g = Math.max(1, Math.min(gap, Math.floor((hi - lo) / Math.max(1, n - 1))));
  const slack = hi - lo - g * (n - 1);
  const cuts = Array.from({ length: n }, () => int(r, 0, slack)).sort((a, b) => a - b);
  return shuffle(
    r,
    cuts.map((cut, i) => lo + cut + i * g),
  );
}

function makeBars(r: Rng, n: number, thing: string, gap: number, lo = 2, hi = 10): Bar[] {
  const hues = sample(r, HUES, n);
  const values = spacedValues(r, n, lo, hi, gap);
  return hues.map((hue, i) => ({ hue, value: values[i] as number, label: labelOf(hue, thing) }));
}

const barsVisual = (bars: Bar[], dir: 'h' | 'v', extra: { showValues?: boolean; grid?: boolean } = {}): Visual => ({
  k: 'bars',
  dir,
  unitMax: 10,
  items: bars.map((b) => ({ label: b.label, value: b.value, tone: b.hue.tone })),
  ...extra,
});

const barOpt = (b: Bar): Option => ({ key: b.hue.adj, text: `${b.hue.dot} ${b.label}`, say: b.label });
const barItem = (b: Bar): OrderItem => ({ key: b.hue.adj, text: `${b.hue.dot} ${b.label}`, say: b.label });

const WORDS = {
  h: {
    big: '긴',
    small: '짧은',
    bigYo: '길어요',
    smallYo: '짧아요',
    bigQ: '길까요',
    smallQ: '짧을까요',
    hint: '왼쪽 끝을 맞추고, 오른쪽 끝이 더 멀리 나간 쪽이 더 길어요.',
  },
  v: {
    big: '높은',
    small: '낮은',
    bigYo: '높아요',
    smallYo: '낮아요',
    bigQ: '높을까요',
    smallQ: '낮을까요',
    hint: '바닥을 맞추고, 위쪽 끝이 더 높이 올라간 쪽이 더 높아요.',
  },
} as const;

export function lengthGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  const dir: 'h' | 'v' = chance(r, L === 1 ? 0.25 : 0.4) ? 'v' : 'h';
  const thing = pick(r, dir === 'h' ? LONG_THINGS : TALL_THINGS);
  const w = WORDS[dir];
  const hintBase = { say: w.hint };

  if (L === 1) {
    const bars = makeBars(r, 2, thing, 3);
    const wantBig = chance(r, 0.7);
    const sorted = [...bars].sort((a, b) => a.value - b.value);
    const right = wantBig ? (sorted[1] as Bar) : (sorted[0] as Bar);
    const wrong = wantBig ? (sorted[0] as Bar) : (sorted[1] as Bar);
    const text = `어느 ${thing}${josa(thing, '이/가')} 더 ${wantBig ? w.bigQ : w.smallQ}?`;
    return mk(c, {
      prompt: text,
      say: text,
      visual: barsVisual(bars, dir),
      answer: buildChoice(r, barOpt(right), [barOpt(wrong)], 2, 2),
      hint: { ...hintBase, visual: barsVisual(bars, dir, { showValues: true, grid: true }) },
      explain: `${withJosa(right.label, '이/가')} 더 ${wantBig ? w.bigYo : w.smallYo}.`,
    });
  }

  if (L === 2) {
    const bars = makeBars(r, 3, thing, 2);
    const sorted = [...bars].sort((a, b) => a.value - b.value);
    const wantBig = chance(r, 0.6);
    const right = wantBig ? (sorted[2] as Bar) : (sorted[0] as Bar);
    const text = `가장 ${wantBig ? w.big : w.small} ${thing}${josa(thing, '은/는')} 어느 것일까요?`;
    return mk(c, {
      prompt: text,
      say: text,
      visual: barsVisual(bars, dir),
      answer: buildChoice(r, barOpt(right), bars.filter((b) => b !== right).map(barOpt), 3, 3),
      hint: { ...hintBase, visual: barsVisual(bars, dir, { showValues: true, grid: true }) },
      explain: `${withJosa(right.label, '이/가')} 가장 ${wantBig ? w.bigYo : w.smallYo}.`,
    });
  }

  const roll = r();
  if (roll < 0.4) {
    // 차례대로 놓기
    const n = chance(r, 0.5) ? 3 : 4;
    const bars = makeBars(r, n, thing, 1, 1, 10);
    const asc = chance(r, 0.5);
    const sorted = [...bars].sort((a, b) => (asc ? a.value - b.value : b.value - a.value));
    const correct = sorted.map((b) => b.hue.adj);
    const items = bars.map(barItem);
    const text = `${asc ? w.small : w.big} 것부터 차례대로 눌러 보세요.`;
    return mk(c, {
      prompt: text,
      say: text,
      visual: barsVisual(bars, dir),
      answer: { t: 'order', items: shuffleDiff(r, items, correct), correct, style: 'cards' },
      hint: { ...hintBase, visual: barsVisual(bars, dir, { showValues: true, grid: true }) },
      explain: `${sorted.map((b) => b.label).join(', ')} 순서예요.`,
    });
  }
  if (roll < 0.72) {
    // 말로 된 비교를 이어서 생각하기
    const bars = makeBars(r, 3, thing, 2);
    const sorted = [...bars].sort((a, b) => b.value - a.value);
    const [big, mid, small] = sorted as [Bar, Bar, Bar];
    const wantBig = chance(r, 0.5);
    const right = wantBig ? big : small;
    const flip = chance(r, 0.5);
    // "A는 B보다 길어요. B는 C보다 길어요." 또는 짧은 쪽을 먼저 말한다
    const s1 = flip ? `${withJosa(small.label, '은/는')} ${mid.label}보다 ${w.smallYo}.` : `${withJosa(big.label, '은/는')} ${mid.label}보다 ${w.bigYo}.`;
    const s2 = flip ? `${withJosa(mid.label, '은/는')} ${big.label}보다 ${w.smallYo}.` : `${withJosa(mid.label, '은/는')} ${small.label}보다 ${w.bigYo}.`;
    const text = `${s1} ${s2} 가장 ${wantBig ? w.big : w.small} ${thing}${josa(thing, '은/는')} 어느 것일까요?`;
    return mk(c, {
      prompt: text,
      say: text,
      answer: buildChoice(r, barOpt(right), bars.filter((b) => b !== right).map(barOpt), 3, 3),
      hint: { say: '두 문장을 이어서 생각해 봐요. 그림으로 그려 보면 쉬워요.', visual: barsVisual(bars, dir) },
      explain: `${big.label}, ${mid.label}, ${small.label} 순서로 ${w.bigYo}. 그래서 가장 ${wantBig ? w.big : w.small} 것은 ${right.label}${josa(right.label, '이에요/예요')}.`,
    });
  }
  // 칸 수로 비교하기
  const bars = makeBars(r, 3, thing, 1, 2, 10);
  const wantBig = chance(r, 0.5);
  const sorted = [...bars].sort((a, b) => a.value - b.value);
  const target = wantBig ? (sorted[2] as Bar) : (sorted[0] as Bar);
  const text = `가장 ${wantBig ? w.big : w.small} 것은 몇 칸일까요?`;
  return mk(c, {
    prompt: text,
    say: text,
    visual: barsVisual(bars, dir, { grid: true }),
    answer: numChoice(r, target.value, 1, 10, { say: (n) => `${n}칸`, text: (n) => `${n}칸` }),
    hint: { say: '칸이 몇 개인지 하나씩 세어 봐요.', visual: barsVisual(bars, dir, { grid: true, showValues: true }) },
    explain: `가장 ${wantBig ? w.big : w.small} 것은 ${target.label}${josa(target.label, '이에요/예요')}. ${target.value}칸이에요.`,
  });
}

/** 보너스 게임: 막대를 높이 순서대로 줄 세우기 */
export function lineupGen(c: GenCtx): Question {
  const r = c.rng;
  const n = c.level === 1 ? 3 : c.level === 2 ? 4 : 5;
  const bars = makeBars(r, n, '막대', c.level === 1 ? 3 : 2, 1, 10);
  const asc = chance(r, 0.6);
  const sorted = [...bars].sort((a, b) => (asc ? a.value - b.value : b.value - a.value));
  const correct = sorted.map((b) => b.hue.adj);
  const items: OrderItem[] = bars.map((b) => ({
    key: b.hue.adj,
    visual: { k: 'bars', dir: 'v', unitMax: 10, items: [{ label: b.label, value: b.value, tone: b.hue.tone }] },
    say: b.label,
  }));
  const text = `${asc ? '낮은' : '높은'} 막대부터 차례대로 줄 세워 보세요.`;
  return mk(c, {
    prompt: text,
    say: text,
    answer: { t: 'order', items: shuffleDiff(r, items, correct), correct, style: 'oneline' },
    hint: { say: '막대 위쪽 끝이 얼마나 올라왔는지 서로 견주어 봐요.' },
    explain: `${sorted.map((b) => b.label).join(', ')} 순서예요.`,
  });
}

// ---------------------------------------------------------------------------
// 무게 비교: 시소
// ---------------------------------------------------------------------------

interface Thing {
  emoji: string;
  name: string;
}

/** 무거운 것부터 가벼운 것 순서의 세 가지 */
const CHAINS: [Thing, Thing, Thing][] = [
  [
    { emoji: '🐘', name: '코끼리' },
    { emoji: '🐕', name: '강아지' },
    { emoji: '🐹', name: '햄스터' },
  ],
  [
    { emoji: '🚌', name: '버스' },
    { emoji: '🚗', name: '자동차' },
    { emoji: '🚲', name: '자전거' },
  ],
  [
    { emoji: '🍉', name: '수박' },
    { emoji: '🍎', name: '사과' },
    { emoji: '🍒', name: '체리' },
  ],
  [
    { emoji: '🐻', name: '곰' },
    { emoji: '🐇', name: '토끼' },
    { emoji: '🐤', name: '병아리' },
  ],
  [
    { emoji: '🐳', name: '고래' },
    { emoji: '🐢', name: '거북이' },
    { emoji: '🐝', name: '꿀벌' },
  ],
  [
    { emoji: '🎃', name: '호박' },
    { emoji: '🍊', name: '귤' },
    { emoji: '🍬', name: '사탕' },
  ],
  [
    { emoji: '🪨', name: '바위' },
    { emoji: '🥔', name: '감자' },
    { emoji: '🪶', name: '깃털' },
  ],
  [
    { emoji: '🦒', name: '기린' },
    { emoji: '🐱', name: '고양이' },
    { emoji: '🐭', name: '생쥐' },
  ],
];

const group = (t: Thing, n = 1): Group => ({ emoji: t.emoji, n });
const thingOpt = (t: Thing): Option => ({ key: t.name, text: `${t.emoji} ${t.name}`, say: t.name });
const bigThing = (t: Thing): Visual => ({ k: 'big', text: t.emoji, sub: t.name });

/** 시소 그림: heavy가 놓인 쪽이 내려간다 */
function seesawOf(heavy: Group, light: Group, heavyOnLeft: boolean): Visual {
  return heavyOnLeft ? { k: 'seesaw', left: heavy, right: light, tilt: 'left' } : { k: 'seesaw', left: light, right: heavy, tilt: 'right' };
}

export function weightGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  const chain = pick(r, CHAINS);
  const [a, b, d] = chain;

  if (L === 1) {
    const wantHeavy = chance(r, 0.65);
    const heavyOnLeft = chance(r, 0.5);
    let heavy: Thing;
    let light: Thing;
    let visual: Visual;
    let hg: Group;
    let lg: Group;
    if (chance(r, 0.35)) {
      // 같은 물건의 개수 비교
      heavy = pick(r, chain);
      light = heavy;
      hg = group(heavy, int(r, 3, 4));
      lg = group(light, 1);
      visual = seesawOf(hg, lg, heavyOnLeft);
      const text = `시소가 이렇게 기울었어요. 어느 쪽이 더 ${wantHeavy ? '무거울' : '가벼울'}까요?`;
      const sideOpts: Option[] = [
        { key: 'left', text: '왼쪽', say: '왼쪽' },
        { key: 'right', text: '오른쪽', say: '오른쪽' },
      ];
      const heavySide = heavyOnLeft ? 'left' : 'right';
      const rightKey = wantHeavy ? heavySide : heavySide === 'left' ? 'right' : 'left';
      return mk(c, {
        prompt: text,
        say: text,
        visual,
        answer: buildChoice(r, sideOpts.find((o) => o.key === rightKey) as Option, sideOpts.filter((o) => o.key !== rightKey), 2, 2),
        hint: { say: '아래로 내려간 쪽이 더 무거운 쪽이에요.', visual },
        explain: `${wantHeavy ? '아래로 내려간' : '위로 올라간'} ${rightKey === 'left' ? '왼쪽' : '오른쪽'}이 더 ${wantHeavy ? '무거워요' : '가벼워요'}.`,
      });
    }
    [heavy, light] = pick(r, [
      [a, b],
      [b, d],
      [a, d],
    ] as [Thing, Thing][]);
    hg = group(heavy);
    lg = group(light);
    visual = seesawOf(hg, lg, heavyOnLeft);
    const rightT = wantHeavy ? heavy : light;
    const wrongT = wantHeavy ? light : heavy;
    const text = `시소가 이렇게 기울었어요. 어느 쪽이 더 ${wantHeavy ? '무거울' : '가벼울'}까요?`;
    return mk(c, {
      prompt: text,
      say: text,
      visual,
      answer: buildChoice(r, thingOpt(rightT), [thingOpt(wrongT)], 2, 2),
      hint: { say: '아래로 내려간 쪽이 더 무거운 쪽이에요.', visual },
      explain: `${withJosa(heavy.name, '이/가')} 더 무거워서 시소가 그쪽으로 내려갔어요.`,
    });
  }

  if (L === 2) {
    if (chance(r, 0.5)) {
      const [heavy, light] = pick(r, [
        [a, b],
        [b, d],
        [a, d],
      ] as [Thing, Thing][]);
      const wantHeavy = chance(r, 0.6);
      const rightT = wantHeavy ? heavy : light;
      const wrongT = wantHeavy ? light : heavy;
      const pair = shuffle(r, [heavy, light]);
      const text = `둘 중에 어느 것이 더 ${wantHeavy ? '무거울' : '가벼울'}까요?`;
      return mk(c, {
        prompt: text,
        say: text,
        visual: { k: 'row', items: pair.map(bigThing), gap: 14 },
        answer: buildChoice(r, thingOpt(rightT), [thingOpt(wrongT)], 2, 2),
        hint: { say: `손으로 들어 본다고 생각해 봐요. 어느 쪽이 들기 힘들까요?`, visual: seesawOf(group(heavy), group(light), chance(r, 0.5)) },
        explain: `${withJosa(heavy.name, '이/가')} ${light.name}보다 무거워요.`,
      });
    }
    const wantHeavy = chance(r, 0.5);
    const trio = shuffle(r, [a, b, d]);
    const rightT = wantHeavy ? a : d;
    const text = `가장 ${wantHeavy ? '무거운' : '가벼운'} 것은 어느 것일까요?`;
    return mk(c, {
      prompt: text,
      say: text,
      visual: { k: 'row', items: trio.map(bigThing), gap: 10 },
      answer: buildChoice(r, thingOpt(rightT), [a, b, d].filter((t) => t !== rightT).map(thingOpt), 3, 3),
      hint: { say: `손으로 들어 본다고 생각해 봐요. 가장 ${wantHeavy ? '들기 힘든' : '가볍게 들리는'} 것을 찾아요.` },
      explain: `${a.name}, ${b.name}, ${d.name} 순서로 무거워요. 가장 ${wantHeavy ? '무거운' : '가벼운'} 것은 ${rightT.name}이에요.`,
    });
  }

  // 단계 3: 시소 두 개로 세 가지를 견주기
  const wantHeavy = chance(r, 0.5);
  const first = chance(r, 0.5);
  const sw1 = first ? seesawOf(group(a), group(b), chance(r, 0.5)) : seesawOf(group(b), group(d), chance(r, 0.5));
  const sw2 = first ? seesawOf(group(b), group(d), chance(r, 0.5)) : seesawOf(group(a), group(b), chance(r, 0.5));
  const rightT = wantHeavy ? a : d;
  const text = `시소 두 개를 보고 가장 ${wantHeavy ? '무거운' : '가벼운'} 것을 찾아보세요.`;
  const trio = [a, b, d];
  return mk(c, {
    prompt: text,
    say: text,
    visual: { k: 'row', items: [sw1, sw2], gap: 10 },
    answer: buildChoice(r, thingOpt(rightT), trio.filter((t) => t !== rightT).map(thingOpt), 3, 3),
    hint: { say: '두 시소에서 아래로 내려간 쪽을 각각 찾아요. 두 번 다 내려간 것이 가장 무거워요.' },
    explain: `${withJosa(a.name, '은/는')} ${b.name}보다 무겁고, ${withJosa(b.name, '은/는')} ${d.name}보다 무거워요. 가장 ${wantHeavy ? '무거운' : '가벼운'} 것은 ${rightT.name}이에요.`,
  });
}

// ---------------------------------------------------------------------------
// 넓이 비교: 칸 모양
// ---------------------------------------------------------------------------

interface Cells {
  cols: number;
  rows: number;
  /** 색칠한 칸 수(없으면 가득) */
  fill: number;
}

const cellCount = (s: Cells): number => s.fill;

/** 견주는 모양들은 한 칸의 크기가 같아야 하므로, 가장 넓은 모양의 가로 칸 수(fit)에 맞춰 그린다 */
function cellsVisual(s: Cells, tone: Tone, fit: number = s.cols): Visual {
  const full = s.cols * s.rows;
  return { k: 'cells', cols: s.cols, rows: s.rows, tone, fit, ...(s.fill < full ? { fill: s.fill } : {}) };
}

const fitOf = (shapes: Cells[]): number => Math.max(...shapes.map((s) => s.cols));

function rect(cols: number, rows: number): Cells {
  return { cols, rows, fill: cols * rows };
}

const RECTS_SMALL: Cells[] = [rect(2, 2), rect(2, 3), rect(1, 5), rect(3, 2)];
const RECTS_BIG: Cells[] = [rect(4, 3), rect(3, 4), rect(4, 4), rect(5, 3), rect(5, 4), rect(2, 6)];
const AREA_TONES: Tone[] = ['sky', 'tangerine', 'leaf', 'grape', 'rose'];

/** 칸 수가 정확히 n인 모양 하나. 가로 칸 수는 cols로 정하고 마지막 줄은 모자랄 수 있다 */
function shapeWith(r: Rng, n: number, maxCols: number): Cells {
  const cols = int(r, Math.min(maxCols, Math.max(2, Math.ceil(n / 4))), Math.min(maxCols, Math.max(2, n)));
  return { cols, rows: Math.ceil(n / cols), fill: n };
}

export function areaGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  const tones = sample(r, AREA_TONES, 3);

  if (L === 1) {
    const small = pick(r, RECTS_SMALL);
    const big = pick(r, RECTS_BIG.filter((s) => cellCount(s) >= cellCount(small) * 2));
    const wantBig = chance(r, 0.7);
    const bigFirst = chance(r, 0.5);
    const order: [Cells, Tone][] = bigFirst
      ? [
          [big, tones[0] as Tone],
          [small, tones[1] as Tone],
        ]
      : [
          [small, tones[1] as Tone],
          [big, tones[0] as Tone],
        ];
    const fit = fitOf([small, big]);
    const items: TapItem[] = order.map(([s, tone], i) => ({ key: `s${i}`, visual: cellsVisual(s, tone, fit), say: i === 0 ? '왼쪽' : '오른쪽' }));
    const targetIdx = order.findIndex(([s]) => (wantBig ? s === big : s === small));
    const text = `${wantBig ? '더 넓은' : '더 좁은'} 쪽을 눌러 보세요.`;
    return mk(c, {
      prompt: text,
      say: text,
      answer: { t: 'tapTargets', items, targets: [`s${targetIdx}`], cols: 2, need: 'one' },
      hint: { say: '칸이 많이 모여 있는 쪽이 넓은 쪽이에요.' },
      explain: `${wantBig ? '칸이 더 많은' : '칸이 더 적은'} 쪽이 더 ${wantBig ? '넓어요' : '좁아요'}.`,
    });
  }

  if (L === 2) {
    const counts = shuffle(r, [int(r, 4, 6), int(r, 8, 10), int(r, 12, 16)]);
    const shapes = counts.map((n) => shapeWith(r, n, 4));
    const wantBig = chance(r, 0.6);
    const target = wantBig ? Math.max(...counts) : Math.min(...counts);
    const fit = fitOf(shapes);
    const items: TapItem[] = shapes.map((s, i) => ({ key: `s${i}`, visual: cellsVisual(s, tones[i] as Tone, fit), say: ['첫째', '둘째', '셋째'][i] as string }));
    const targetIdx = counts.indexOf(target);
    const text = `가장 ${wantBig ? '넓은' : '좁은'} 모양을 눌러 보세요.`;
    return mk(c, {
      prompt: text,
      say: text,
      answer: { t: 'tapTargets', items, targets: [`s${targetIdx}`], cols: 3, need: 'one' },
      hint: { say: '색칠된 칸이 몇 개인지 어림해서 견주어 봐요.' },
      explain: `칸이 가장 ${wantBig ? '많은' : '적은'} 모양이 가장 ${wantBig ? '넓어요' : '좁아요'}.`,
    });
  }

  if (chance(r, 0.5)) {
    const n = int(r, 5, 18);
    const s = shapeWith(r, n, 5);
    const text = '색칠된 칸은 모두 몇 칸일까요?';
    return mk(c, {
      prompt: text,
      say: text,
      visual: cellsVisual(s, tones[0] as Tone),
      answer: numChoice(r, n, 3, 20, { spread: 2, say: (x) => `${x}칸`, text: (x) => `${x}칸` }),
      hint: { say: '한 줄씩 세어서 더해 봐요.', visual: { k: 'cells', cols: s.cols, rows: s.rows, tone: tones[0] as Tone, ...(s.fill < s.cols * s.rows ? { fill: s.fill } : {}), numbered: true } },
      explain: `색칠된 칸은 모두 ${n}칸이에요.`,
    });
  }
  // 비슷하게 넓은 두 모양
  const base = int(r, 8, 14);
  const diff = int(r, 1, 3);
  const bigN = base + diff;
  const bigS = shapeWith(r, bigN, 5);
  const smallS = shapeWith(r, base, 5);
  const bigFirst = chance(r, 0.5);
  const wantBig = chance(r, 0.6);
  const pair: [Cells, Tone][] = bigFirst
    ? [
        [bigS, tones[0] as Tone],
        [smallS, tones[1] as Tone],
      ]
    : [
        [smallS, tones[1] as Tone],
        [bigS, tones[0] as Tone],
      ];
  const fit = fitOf([bigS, smallS]);
  const items: TapItem[] = pair.map(([s, tone], i) => ({ key: `s${i}`, visual: cellsVisual(s, tone, fit), say: i === 0 ? '왼쪽' : '오른쪽' }));
  const targetIdx = pair.findIndex(([s]) => (wantBig ? s === bigS : s === smallS));
  const text = `칸을 세어 보고 ${wantBig ? '더 넓은' : '더 좁은'} 쪽을 눌러 보세요.`;
  return mk(c, {
    prompt: text,
    say: text,
    answer: { t: 'tapTargets', items, targets: [`s${targetIdx}`], cols: 2, need: 'one' },
    hint: { say: '모양마다 색칠된 칸을 하나씩 세어서 견주어 봐요.' },
    explain: `한쪽은 ${bigN}칸, 다른 쪽은 ${base}칸이에요. ${wantBig ? '칸이 더 많은' : '칸이 더 적은'} 쪽이 더 ${wantBig ? '넓어요' : '좁아요'}.`,
  });
}
