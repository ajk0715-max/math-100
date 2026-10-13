import { josa, ordinalKo } from '../ko';
import { OBJECTS, type Obj } from '../objects';
import { chance, int, pick, sample, shuffle, type Rng } from '../rng';
import type { GenCtx, MatchPair, Option, Question, Visual } from '../types';
import { buildChoice, mk, numChoice } from './util';

// ---------------------------------------------------------------------------
// 수학 용어: 몇째, 앞뒤·사이, 모두·남은·더 많은
// ---------------------------------------------------------------------------

interface Pal {
  e: string;
  ko: string;
}

const PALS: Pal[] = [
  { e: '🐶', ko: '강아지' },
  { e: '🐱', ko: '고양이' },
  { e: '🐰', ko: '토끼' },
  { e: '🐻', ko: '곰' },
  { e: '🐸', ko: '개구리' },
  { e: '🐼', ko: '판다' },
  { e: '🐥', ko: '병아리' },
  { e: '🦊', ko: '여우' },
  { e: '🐯', ko: '호랑이' },
];

const palOpt = (p: Pal): Option => ({ key: p.e, text: `${p.e} ${p.ko}`, say: p.ko });
const ordOpt = (n: number): Option => ({ key: String(n), text: ordinalKo(n), say: ordinalKo(n) });
const isE = (w: string): string => `${w}${josa(w, '이에요/예요')}`;

const queueVis = (pals: Pal[], mark?: number): Visual => ({ k: 'queue', items: pals.map((p) => p.e), ...(mark !== undefined ? { mark } : {}), sides: true });

const SIDE_KO = { left: '왼쪽', right: '오른쪽' } as const;

// ---------------------------------------------------------------------------
// 몇째
// ---------------------------------------------------------------------------

function whichOrdQ(c: GenCtx, n: number, side: 'left' | 'right'): Question {
  const r = c.rng;
  const pals = sample(r, PALS, n);
  const idx = int(r, 0, n - 1);
  const k = side === 'left' ? idx + 1 : n - idx;
  const mirror = side === 'left' ? n - idx : idx + 1;
  const wrongs = [mirror, k - 1, k + 1, k + 2].filter((v) => v >= 1 && v <= n && v !== k).map(ordOpt);
  const text = `표시한 친구는 ${SIDE_KO[side]}에서 몇째일까요?`;
  return mk(c, {
    prompt: text,
    say: text,
    visual: queueVis(pals, idx),
    answer: buildChoice(r, ordOpt(k), wrongs, 3),
    hint: { say: `${SIDE_KO[side]} 끝에서부터 하나, 둘, 셋 하고 세어 가며 표시한 친구까지 가 봐요.` },
    explain: `${SIDE_KO[side]}에서부터 차례로 세면 ${isE(ordinalKo(k))}.`,
  });
}

function kthQ(c: GenCtx, n: number, side: 'left' | 'right'): Question {
  const r = c.rng;
  const pals = sample(r, PALS, n);
  const k = int(r, 1, n);
  const idx = side === 'left' ? k - 1 : n - k;
  const mirror = side === 'left' ? n - k : k - 1;
  const target = pals[idx] as Pal;
  const rest = pals.filter((_, i) => i !== idx);
  const mirrored = mirror !== idx ? [pals[mirror] as Pal] : [];
  const wrongs = [...mirrored, ...shuffle(r, rest)].map(palOpt);
  const text = `${SIDE_KO[side]}에서 ${ordinalKo(k)} 친구는 누구일까요?`;
  return mk(c, {
    prompt: text,
    say: text,
    visual: queueVis(pals),
    answer: buildChoice(r, palOpt(target), wrongs, 3),
    hint: { say: `${SIDE_KO[side]} 끝에서부터 ${ordinalKo(k)}까지 차례로 세어 봐요.` },
    explain: `${SIDE_KO[side]}에서 ${ordinalKo(k)} 친구는 ${target.ko}${josa(target.ko, '이에요/예요')}.`,
  });
}

/** 순서를 말하는 말과 개수를 말하는 말 구별 */
function ordOrCountQ(c: GenCtx): Question {
  const r = c.rng;
  const n = int(r, 2, 9);
  const counter = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉'][n] as string;
  const unit = pick(r, ['마리', '개', '명']);
  const ordinal = ordinalKo(n);
  const countWord = `${counter} ${unit}`;
  const forOrder = chance(r, 0.5);
  const opts: Option[] = [
    { key: 'ord', text: ordinal, say: ordinal },
    { key: 'cnt', text: countWord, say: countWord },
  ];
  const text = forOrder ? '줄에서 몇 번째 자리인지, 순서를 나타내는 말은 어느 것일까요?' : '모두 몇인지, 개수를 나타내는 말은 어느 것일까요?';
  const right = forOrder ? 'ord' : 'cnt';
  return mk(c, {
    prompt: text,
    say: text,
    answer: buildChoice(r, opts.find((o) => o.key === right) as Option, opts.filter((o) => o.key !== right), 2),
    hint: { say: '“째”가 붙는 말은 순서를 말하고, “개·마리·명”이 붙는 말은 개수를 말해요.' },
    explain: forOrder ? `${isE(ordinal)}. 순서를 나타내는 말이에요.` : `${isE(countWord)}. 개수를 나타내는 말이에요.`,
  });
}

/** 한쪽에서 몇째인지 알 때 다른 쪽에서 몇째인지 */
function flipQ(c: GenCtx): Question {
  const r = c.rng;
  const n = int(r, 6, 9);
  const pals = sample(r, PALS, n);
  const idx = int(r, 1, n - 2);
  const side = pick<'left' | 'right'>(r, ['left', 'right']);
  const other: 'left' | 'right' = side === 'left' ? 'right' : 'left';
  const k = side === 'left' ? idx + 1 : n - idx;
  const ans = n + 1 - k;
  const pal = pals[idx] as Pal;
  const text = `${pal.ko}${josa(pal.ko, '은/는')} ${SIDE_KO[side]}에서 ${ordinalKo(k)}예요. ${SIDE_KO[other]}에서는 몇째일까요?`;
  const wrongs = [k, ans - 1, ans + 1, ans + 2].filter((v) => v >= 1 && v <= n && v !== ans).map(ordOpt);
  return mk(c, {
    prompt: text,
    say: text,
    visual: queueVis(pals, idx),
    answer: buildChoice(r, ordOpt(ans), wrongs, 3),
    hint: { say: `${SIDE_KO[other]} 끝에서부터 세어 봐요. 같은 친구라도 세는 쪽에 따라 몇째인지가 달라져요.` },
    explain: `${SIDE_KO[other]}에서부터 차례로 세면 ${isE(ordinalKo(ans))}.`,
  });
}

export function ordGen(c: GenCtx): Question {
  const r = c.rng;
  if (c.level === 1) return chance(r, 0.7) ? whichOrdQ(c, 5, 'left') : kthQ(c, 5, 'left');
  if (c.level === 2) {
    const roll = r();
    if (roll < 0.35) return whichOrdQ(c, int(r, 5, 7), 'right');
    if (roll < 0.7) return kthQ(c, int(r, 5, 7), pick<'left' | 'right'>(r, ['left', 'right']));
    if (roll < 0.85) return whichOrdQ(c, int(r, 6, 8), 'left');
    return ordOrCountQ(c);
  }
  const roll = r();
  if (roll < 0.4) return flipQ(c);
  if (roll < 0.65) return kthQ(c, int(r, 7, 9), 'right');
  if (roll < 0.85) return whichOrdQ(c, int(r, 7, 9), pick<'left' | 'right'>(r, ['left', 'right']));
  return ordOrCountQ(c);
}

// ---------------------------------------------------------------------------
// 위치 말: 바로 옆, 사이, 가장 왼쪽·오른쪽, 오른쪽에 몇 마리
// ---------------------------------------------------------------------------

function nextToQ(c: GenCtx): Question {
  const r = c.rng;
  const n = 5;
  const pals = sample(r, PALS, n);
  const idx = int(r, 1, n - 2);
  const side = pick<'left' | 'right'>(r, ['left', 'right']);
  const nb = side === 'left' ? idx - 1 : idx + 1;
  const target = pals[nb] as Pal;
  const other = pals[side === 'left' ? idx + 1 : idx - 1] as Pal;
  const rest = pals.filter((_, i) => i !== nb && i !== idx && pals[i] !== other);
  const wrongs = [other, ...shuffle(r, rest)].map(palOpt);
  const text = `표시한 친구의 바로 ${SIDE_KO[side]}에 있는 친구는 누구일까요?`;
  return mk(c, {
    prompt: text,
    say: text,
    visual: queueVis(pals, idx),
    answer: buildChoice(r, palOpt(target), wrongs, 3),
    hint: { say: `표시한 친구에서 ${SIDE_KO[side]}으로 한 칸만 가 봐요.` },
    explain: `바로 ${SIDE_KO[side]}에 있는 친구는 ${target.ko}${josa(target.ko, '이에요/예요')}.`,
  });
}

function betweenQ(c: GenCtx): Question {
  const r = c.rng;
  const n = 5;
  const pals = sample(r, PALS, n);
  const i = int(r, 0, n - 3);
  const a = pals[i] as Pal;
  const b = pals[i + 2] as Pal;
  const mid = pals[i + 1] as Pal;
  const rest = pals.filter((p) => p !== a && p !== b && p !== mid);
  const wrongs = shuffle(r, rest).map(palOpt);
  const text = `${a.ko}${josa(a.ko, '과/와')} ${b.ko} 사이에 있는 친구는 누구일까요?`;
  return mk(c, {
    prompt: text,
    say: text,
    visual: queueVis(pals),
    answer: buildChoice(r, palOpt(mid), wrongs, 3),
    hint: { say: `${a.ko}와 ${b.ko}를 먼저 찾고, 두 친구 가운데에 있는 친구를 찾아요.` },
    explain: `${a.ko}${josa(a.ko, '과/와')} ${b.ko} 사이에는 ${mid.ko}${josa(mid.ko, '이/가')} 있어요.`,
  });
}

function endQ(c: GenCtx): Question {
  const r = c.rng;
  const n = int(r, 5, 7);
  const pals = sample(r, PALS, n);
  const side = pick<'left' | 'right'>(r, ['left', 'right']);
  const target = pals[side === 'left' ? 0 : n - 1] as Pal;
  const wrongs = shuffle(
    r,
    pals.filter((p) => p !== target),
  ).map(palOpt);
  const text = `가장 ${SIDE_KO[side]}에 있는 친구는 누구일까요?`;
  return mk(c, {
    prompt: text,
    say: text,
    visual: queueVis(pals),
    answer: buildChoice(r, palOpt(target), wrongs, 3),
    hint: { say: `줄의 ${SIDE_KO[side]} 끝을 봐요.` },
    explain: `가장 ${SIDE_KO[side]}에 있는 친구는 ${target.ko}${josa(target.ko, '이에요/예요')}.`,
  });
}

function sideCountQ(c: GenCtx): Question {
  const r = c.rng;
  const n = int(r, 5, 8);
  const pals = sample(r, PALS, n);
  const side = pick<'left' | 'right'>(r, ['left', 'right']);
  const idx = int(r, 1, n - 2);
  const ans = side === 'left' ? idx : n - 1 - idx;
  const text = `표시한 친구의 ${SIDE_KO[side]}에는 모두 몇 마리가 있을까요?`;
  return mk(c, {
    prompt: text,
    say: text,
    visual: queueVis(pals, idx),
    answer: numChoice(r, ans, 1, 7, { say: (v) => `${v}마리`, text: (v) => `${v}마리` }),
    hint: { say: `표시한 친구는 빼고, ${SIDE_KO[side]}에 있는 친구만 세어 봐요.` },
    explain: `표시한 친구의 ${SIDE_KO[side]}에는 ${ans}마리가 있어요.`,
  });
}

export function posGen(c: GenCtx): Question {
  const r = c.rng;
  if (c.level === 1) return nextToQ(c);
  if (c.level === 2) return chance(r, 0.5) ? betweenQ(c) : chance(r, 0.5) ? nextToQ(c) : endQ(c);
  const roll = r();
  if (roll < 0.4) return sideCountQ(c);
  if (roll < 0.7) return betweenQ(c);
  return endQ(c);
}

// ---------------------------------------------------------------------------
// 낱말: 모두, 남은, 더 많은·더 적은·같은
// ---------------------------------------------------------------------------

/** 같은 세는 말을 쓰는 사물 두 가지 */
export function twoSameCounter(r: Rng): [Obj, Obj] {
  for (let t = 0; t < 20; t++) {
    const [a, b] = sample(r, OBJECTS, 2) as [Obj, Obj];
    if (a.counter === b.counter) return [a, b];
  }
  const eats = OBJECTS.filter((o) => ['apple', 'cookie', 'candy', 'strawberry'].includes(o.key));
  return sample(r, eats, 2) as [Obj, Obj];
}

export const EATS = OBJECTS.filter((o) => ['apple', 'cookie', 'candy', 'strawberry'].includes(o.key));
const cnt = (n: number, c: string): string => `${n}${c}`;

function allQ(c: GenCtx): Question {
  const r = c.rng;
  const [a, b] = twoSameCounter(r);
  const na = int(r, 1, 6);
  const nb = int(r, 1, 9 - na);
  const sum = na + nb;
  const text = `${a.name} ${cnt(na, a.counter)}${josa(a.counter, '과/와')} ${b.name} ${cnt(nb, b.counter)}${josa(b.counter, '이/가')} 있어요. 모두 몇 ${a.counter}일까요?`;
  return mk(c, {
    prompt: text,
    say: text,
    visual: { k: 'groups', a: { emoji: a.emoji, n: na }, b: { emoji: b.emoji, n: nb }, op: '+' },
    answer: numChoice(r, sum, 2, 10, { say: (v) => cnt(v, a.counter), text: (v) => cnt(v, a.counter) }),
    hint: { say: '“모두”는 두 무리를 합쳐서 센다는 뜻이에요.' },
    explain: `모두는 합쳐서 세는 거예요. ${na} + ${nb} = ${sum}이니까 모두 ${cnt(sum, a.counter)}예요.`,
  });
}

function leftQ(c: GenCtx): Question {
  const r = c.rng;
  const o = pick(r, EATS);
  const n = int(r, 3, 9);
  const m = int(r, 1, n - 1);
  const rest = n - m;
  const text = `${o.name} ${cnt(n, o.counter)} 중에서 ${cnt(m, o.counter)}${josa(o.counter, '을/를')} 먹었어요. 남은 ${o.name}${josa(o.name, '은/는')} 몇 ${o.counter}일까요?`;
  return mk(c, {
    prompt: text,
    say: text,
    visual: { k: 'objects', emoji: o.emoji, n, crossed: m, layout: 'row', size: 'md' },
    answer: numChoice(r, rest, 1, 9, { say: (v) => cnt(v, o.counter), text: (v) => cnt(v, o.counter) }),
    hint: { say: '“남은”은 먹거나 덜어 내고 난 뒤에 남아 있는 것이라는 뜻이에요.' },
    explain: `남은 것은 처음에서 먹은 만큼을 뺀 거예요. ${n} − ${m} = ${rest}이니까 ${cnt(rest, o.counter)}예요.`,
  });
}

function moreLessQ(c: GenCtx): Question {
  const r = c.rng;
  const [a, b] = twoSameCounter(r);
  const same = chance(r, 0.2);
  const na = int(r, 2, 8);
  let nb = na;
  if (!same) {
    do nb = int(r, 1, 9);
    while (nb === na);
  }
  const ask = pick<'more' | 'less'>(r, ['more', 'less']);
  const key = same ? 'same' : (ask === 'more') === na > nb ? 'left' : 'right';
  const opts: Option[] = [
    { key: 'left', text: '왼쪽', say: '왼쪽' },
    { key: 'right', text: '오른쪽', say: '오른쪽' },
    { key: 'same', text: '같아요', say: '같아요' },
  ];
  const text = `왼쪽과 오른쪽 중 어느 쪽이 ${ask === 'more' ? '더 많을까요' : '더 적을까요'}? 같으면 ‘같아요’를 눌러요.`;
  const keyWrong = opts.filter((o) => o.key !== key);
  return mk(c, {
    prompt: text,
    say: text,
    visual: { k: 'groups', a: { emoji: a.emoji, n: na }, b: { emoji: b.emoji, n: nb }, op: 'vs' },
    answer: buildChoice(r, opts.find((o) => o.key === key) as Option, keyWrong, 3),
    hint: { say: '두 쪽을 각각 세어서 어느 쪽 수가 더 큰지 비교해 봐요.' },
    explain: same ? `양쪽 모두 ${cnt(na, a.counter)}로 같아요.` : `왼쪽은 ${cnt(na, a.counter)}, 오른쪽은 ${cnt(nb, b.counter)}예요. ${ask === 'more' ? '더 많은' : '더 적은'} 쪽은 ${key === 'left' ? '왼쪽' : '오른쪽'}${josa(key === 'left' ? '왼쪽' : '오른쪽', '이에요/예요')}.`,
  });
}

const PLUS_WORDS = ['모두 몇 개일까요?', '합치면 몇 개일까요?', '더 받으면 몇 개일까요?', '두 상자를 합하면 몇 개일까요?'];
const MINUS_WORDS = ['남은 것은 몇 개일까요?', '먹고 나면 몇 개가 남을까요?', '몇 개 더 많을까요?', '몇 개 덜어 내면 될까요?'];

function opWordQ(c: GenCtx): Question {
  const r = c.rng;
  const plus = chance(r, 0.5);
  const right = pick(r, plus ? PLUS_WORDS : MINUS_WORDS);
  const wrongs = sample(r, plus ? MINUS_WORDS : PLUS_WORDS, 2);
  const text = plus ? '더하기로 풀어야 하는 질문은 어느 것일까요?' : '빼기로 풀어야 하는 질문은 어느 것일까요?';
  const toOpt = (w: string): Option => ({ key: w, text: w, say: w });
  return mk(c, {
    prompt: text,
    say: text,
    answer: buildChoice(r, toOpt(right), wrongs.map(toOpt), 3, 1),
    hint: { say: plus ? '합치거나 더 받는다는 뜻의 말을 찾아요.' : '덜어 내거나 남는다는 뜻의 말, 또는 얼마나 더 많은지를 묻는 말을 찾아요.' },
    explain: plus ? `“${right}”는 합치는 말이라서 더하기로 풀어요.` : `“${right}”는 덜어 내거나 차이를 구하는 말이라서 빼기로 풀어요.`,
  });
}

function matchWordsQ(c: GenCtx): Question {
  const r = c.rng;
  const [a, b] = twoSameCounter(r);
  const n1 = int(r, 1, 4);
  const n2 = int(r, 1, 4);
  const o = pick(r, EATS);
  const t = int(r, 4, 7);
  const m = int(r, 1, 3);
  const eqN = int(r, 2, 5);
  const pairs: MatchPair[] = [
    { key: 'all', a: { text: '모두' }, b: { visual: { k: 'groups', a: { emoji: a.emoji, n: n1 }, b: { emoji: b.emoji, n: n2 }, op: '+' } } },
    { key: 'left', a: { text: '남은' }, b: { visual: { k: 'objects', emoji: o.emoji, n: t, crossed: m, layout: 'row', size: 'sm' } } },
    { key: 'same', a: { text: '같은 수' }, b: { visual: { k: 'groups', a: { emoji: a.emoji, n: eqN }, b: { emoji: b.emoji, n: eqN }, op: 'vs' } } },
  ];
  const text = '낱말과 어울리는 그림을 이어 보세요.';
  return mk(c, {
    prompt: text,
    say: text,
    answer: { t: 'match', pairs },
    hint: { say: '“모두”는 합친 그림, “남은”은 지우고 남은 그림, “같은 수”는 양쪽 수가 같은 그림이에요.' },
    explain: '모두는 합친 것, 남은은 덜어 내고 남은 것, 같은 수는 양쪽이 똑같은 것이에요.',
  });
}

export function wordGen(c: GenCtx): Question {
  const r = c.rng;
  if (c.level === 1) return chance(r, 0.5) ? allQ(c) : leftQ(c);
  if (c.level === 2) return chance(r, 0.45) ? moreLessQ(c) : chance(r, 0.5) ? allQ(c) : leftQ(c);
  const roll = r();
  if (roll < 0.4) return opWordQ(c);
  if (roll < 0.7) return matchWordsQ(c);
  if (roll < 0.85) return moreLessQ(c);
  return chance(r, 0.5) ? allQ(c) : leftQ(c);
}
