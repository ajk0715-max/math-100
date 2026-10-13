import { chance, int, pick, sample, shuffle } from '../rng';
import { withJosa } from '../ko';
import type { GenCtx, MatchPair, Option, OrderItem, Question, TapItem, Visual } from '../types';
import { buildChoice, mk, shuffleDiff } from './util';

// ---------------------------------------------------------------------------
// 동전: 10원, 50원, 100원, 500원
// ---------------------------------------------------------------------------

export const DENOMS = [10, 50, 100, 500] as const;
export const coinVis = (coins: number[]): Visual => ({ k: 'coins', coins });
export const wonOpt = (w: number): Option => ({ key: String(w), text: `${w}원`, say: `${w}원` });

/** 돈 문제에서 헷갈린 쌍을 설명한다 */
export const moneyConfuse = (e: string, g: string): string | null => {
  const a = Number(e);
  const b = Number(g);
  if (!Number.isInteger(a) || !Number.isInteger(b) || a === b) return null;
  const d = Math.abs(a - b);
  if (d === 100) return '100원 차이로 틀림';
  if (d === 50) return '50원 동전을 잘못 셈';
  if (d === 10) return '10원 동전을 잘못 셈';
  return null;
};

const sumOf = (coins: readonly number[]): number => coins.reduce((a, b) => a + b, 0);

/** 합이 sum이 되는 동전 묶음. 큰 동전 위주로, 개수는 maxCoins 이하로 만든다. */
export function composeCoins(r: GenCtx['rng'], sum: number, maxCoins: number, denoms: readonly number[] = DENOMS): number[] {
  const sorted = [...denoms].sort((a, b) => b - a);
  for (let t = 0; t < 40; t++) {
    const out: number[] = [];
    let left = sum;
    while (left > 0 && out.length <= maxCoins) {
      const fit = sorted.filter((d) => d <= left);
      if (fit.length === 0) break;
      // 큰 동전이 더 자주 나오게 한다
      const d = chance(r, 0.55) ? (fit[0] as number) : pick(r, fit);
      out.push(d);
      left -= d;
    }
    if (left === 0 && out.length <= maxCoins) return out.sort((a, b) => b - a);
  }
  // 가장 적은 동전으로
  const out: number[] = [];
  let left = sum;
  for (const d of sorted) {
    while (left >= d) {
      out.push(d);
      left -= d;
    }
  }
  return out;
}

/** 합이 sum이 되는 동전 묶음을 모두 찾는다(동전 maxCoins개 이하) */
export function decompositions(sum: number, maxCoins: number, denoms: readonly number[] = DENOMS): number[][] {
  const sorted = [...denoms].sort((a, b) => b - a);
  const out: number[][] = [];
  const walk = (left: number, from: number, acc: number[]): void => {
    if (left === 0) {
      out.push([...acc]);
      return;
    }
    if (acc.length >= maxCoins) return;
    for (let i = from; i < sorted.length; i++) {
      const d = sorted[i] as number;
      if (d > left) continue;
      acc.push(d);
      walk(left - d, i, acc);
      acc.pop();
    }
  };
  walk(sum, 0, []);
  return out;
}

const sameCoins = (a: readonly number[], b: readonly number[]): boolean => [...a].sort().join() === [...b].sort().join();

const COIN_HINT = '동전에 쓰인 숫자를 읽어 봐요. 갈색 동전은 10원이고, 가장 큰 동전은 500원이에요.';

/** 동전 알아보기 */
export function coinNameGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  const w = pick(r, DENOMS);
  const hint = { say: COIN_HINT, visual: coinVis([...DENOMS]) };

  if (L === 1) {
    return mk(c, {
      prompt: '이 동전은 얼마짜리일까요?',
      say: '이 동전은 얼마짜리일까요?',
      visual: coinVis([w]),
      answer: buildChoice(r, wonOpt(w), DENOMS.filter((x) => x !== w).map(wonOpt), 3),
      hint,
      explain: `이 동전은 ${w}원짜리예요.`,
    });
  }
  if (L === 2) {
    const items: TapItem[] = shuffle(r, [...DENOMS]).map((x) => ({ key: `w${x}`, visual: coinVis([x]), say: `${x}원` }));
    return mk(c, {
      prompt: `${w}원짜리 동전을 찾아 눌러 보세요.`,
      say: `${w}원짜리 동전을 찾아 눌러 보세요.`,
      answer: { t: 'tapTargets', items, targets: [`w${w}`], cols: 2, need: 'one' },
      hint,
      explain: `${w}원짜리 동전은 여기에 있어요.`,
    });
  }
  if (chance(r, 0.5)) {
    const pairs: MatchPair[] = DENOMS.map((x) => ({ key: `w${x}`, a: { visual: coinVis([x]) }, b: { text: `${x}원` } }));
    return mk(c, {
      prompt: '동전과 알맞은 값을 이어 보세요.',
      say: '동전과 알맞은 값을 이어 보세요.',
      answer: { t: 'match', pairs },
      hint,
      explain: '동전에 쓰인 숫자가 그 동전의 값이에요.',
    });
  }
  const ws = sample(r, [...DENOMS], 3);
  const smallFirst = chance(r, 0.6);
  const correctWs = [...ws].sort((a, b) => (smallFirst ? a - b : b - a));
  const items: OrderItem[] = ws.map((x) => ({ key: `w${x}`, visual: coinVis([x]), say: `${x}원` }));
  const correct = correctWs.map((x) => `w${x}`);
  const text = smallFirst ? '값이 작은 동전부터 차례대로 눌러 보세요.' : '값이 큰 동전부터 차례대로 눌러 보세요.';
  return mk(c, {
    prompt: text,
    say: text,
    answer: { t: 'order', items: shuffleDiff(r, items, correct), correct, style: 'cards' },
    hint: { say: '10원, 50원, 100원, 500원 순서로 값이 커져요.', visual: coinVis([...DENOMS]) },
    explain: `${correctWs.map((x) => `${x}원`).join(', ')} 순서예요.`,
  });
}

/** 동전 값 비교, 돈이 더 많은 쪽 */
export function coinCompareGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;

  if (L === 1) {
    const [a, b] = sample(r, [...DENOMS], 2) as [number, number];
    const askBig = chance(r, 0.6);
    const right = (askBig ? a > b : a < b) ? 'L' : 'R';
    const word = askBig ? '큰' : '작은';
    return mk(c, {
      prompt: `값이 더 ${word} 동전은 어느 쪽일까요?`,
      say: `값이 더 ${word} 동전은 어느 쪽일까요?`,
      answer: {
        t: 'tapTargets',
        items: [
          { key: 'L', visual: coinVis([a]), say: `${a}원` },
          { key: 'R', visual: coinVis([b]), say: `${b}원` },
        ],
        targets: [right],
        cols: 2,
        need: 'one',
      },
      hint: { say: '동전에 쓰인 숫자를 읽어 봐요. 숫자가 클수록 값이 커요.', visual: coinVis([...DENOMS]) },
      explain: `${askBig ? Math.max(a, b) : Math.min(a, b)}원이 더 ${word} 동전이에요.`,
    });
  }

  if (L === 2) {
    // 동전 수가 많다고 돈이 많은 것은 아니다
    let pickA: number[] = [];
    let pickB: number[] = [];
    for (let t = 0; t < 80; t++) {
      const ga = composeCoins(r, int(r, 4, 40) * 10, 5);
      const gb = composeCoins(r, int(r, 4, 40) * 10, 5);
      const sa = sumOf(ga);
      const sb = sumOf(gb);
      if (sa === sb || Math.abs(sa - sb) < 30) continue;
      pickA = ga;
      pickB = gb;
      // 처음에는 "동전 수가 많은 쪽이 오히려 적은 돈"인 경우를 우선한다
      if ((ga.length - gb.length) * (sa - sb) < 0) break;
    }
    if (pickA.length === 0) {
      pickA = [500];
      pickB = [100, 100];
    }
    const sa = sumOf(pickA);
    const sb = sumOf(pickB);
    const askMore = chance(r, 0.65);
    const right = (askMore ? sa > sb : sa < sb) ? 'L' : 'R';
    return mk(c, {
      prompt: `돈이 더 ${askMore ? '많은' : '적은'} 쪽을 눌러 보세요.`,
      say: `돈이 더 ${askMore ? '많은' : '적은'} 쪽을 눌러 보세요.`,
      answer: {
        t: 'tapTargets',
        items: [
          { key: 'L', visual: coinVis(pickA), say: `${sa}원` },
          { key: 'R', visual: coinVis(pickB), say: `${sb}원` },
        ],
        targets: [right],
        cols: 2,
        need: 'one',
      },
      hint: { say: '동전이 많다고 돈이 많은 것은 아니에요. 각각 얼마인지 세어서 비교해 봐요.' },
      explain: `왼쪽은 ${sa}원, 오른쪽은 ${sb}원이에요. ${askMore ? Math.max(sa, sb) : Math.min(sa, sb)}원인 쪽이 돈이 더 ${askMore ? '많아요' : '적어요'}.`,
    });
  }

  // 같은 돈 찾기: 다른 동전으로 모아도 같은 돈이다
  let target = int(r, 10, 60) * 10;
  let ways = decompositions(target, 6);
  for (let t = 0; t < 20 && ways.length < 2; t++) {
    target = int(r, 10, 60) * 10;
    ways = decompositions(target, 6);
  }
  if (ways.length < 2) {
    target = 200;
    ways = decompositions(target, 6);
  }
  const [base, same] = sample(r, ways, 2) as [number[], number[]];
  const wrongSums = [target + 100, target - 100, target + 50, target - 50, target + 10, target - 10].filter((s2) => s2 >= 20 && s2 !== target && s2 <= 900);
  const wrongs: Option[] = shuffle(r, wrongSums)
    .slice(0, 3)
    .map((s2) => ({ key: `s${s2}`, visual: coinVis(composeCoins(r, s2, 7)), say: `${s2}원` }));
  return mk(c, {
    prompt: '왼쪽 돈과 같은 돈을 찾아 보세요.',
    say: '왼쪽 돈과 같은 돈을 찾아 보세요.',
    visual: coinVis(base),
    answer: buildChoice(r, { key: `s${target}`, visual: coinVis(same), say: `${target}원` }, wrongs, 3, 1),
    hint: { say: '먼저 왼쪽 돈이 모두 얼마인지 세어 보고, 보기의 돈도 하나씩 세어 비교해 봐요.' },
    explain: `왼쪽 돈은 ${target}원이에요. 다른 동전으로 모아도 ${target}원이면 같은 돈이에요.`,
  });
}

// ---------------------------------------------------------------------------
// 동전 바꾸기
// ---------------------------------------------------------------------------

/** [큰 동전, 작은 동전, 작은 동전 개수] */
const SWAPS: [number, number, number][] = [
  [100, 50, 2],
  [500, 100, 5],
  [50, 10, 5],
  [100, 10, 10],
  [500, 50, 10],
];

const countOpt = (n: number): Option => ({ key: String(n), text: `${n}개`, say: `${n}개` });

export function exchangeGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  const pool = L === 1 ? SWAPS.slice(0, 3) : SWAPS;
  const [big, small, n] = pick(r, pool);
  const explain = `${big}원은 ${small}원짜리 동전 ${n}개와 같아요.`;
  const hint = { say: `${small}원짜리 동전을 ${n}개 모으면 ${big}원이 돼요.`, visual: coinVis(Array.from({ length: n }, () => small)) };

  if (L === 1 || (L === 2 && chance(r, 0.5))) {
    const wrongs = [n - 1, n + 1, n * 2, Math.floor(n / 2), 100].filter((x) => x >= 1 && x !== n && x <= 100);
    const ask = chance(r, 0.5) ? `${big}원은 ${small}원짜리 동전 몇 개와 같을까요?` : `${big}원짜리 동전 하나를 ${small}원짜리 동전으로 바꾸면 모두 몇 개가 될까요?`;
    return mk(c, {
      prompt: ask,
      say: ask,
      visual: coinVis([big]),
      answer: buildChoice(r, countOpt(n), wrongs.map(countOpt), 3),
      hint,
      explain,
    });
  }
  if (L === 2) {
    const near = [(n - 1) * small, (n + 1) * small, big + 50, big + 100, big - 50, big - 100, big * 2];
    const wrongs = near.filter((x) => x >= 10 && x % 10 === 0 && x !== big && x <= 1000);
    return mk(c, {
      prompt: `${small}원짜리 동전 ${n}개는 얼마와 같을까요?`,
      say: `${small}원짜리 동전 ${n}개는 얼마와 같을까요?`,
      visual: coinVis(Array.from({ length: n }, () => small)),
      answer: buildChoice(r, wonOpt(big), wrongs.map(wonOpt), 3),
      hint,
      explain,
    });
  }
  if (n <= 5 && chance(r, 0.55)) {
    return mk(c, {
      prompt: `${big}원을 ${small}원짜리 동전으로 바꿔서 지갑에 담아 보세요.`,
      say: `${big}원을 ${small}원짜리 동전으로 바꿔서 지갑에 담아 보세요.`,
      answer: { t: 'coins', target: big, denoms: [small], showSum: true },
      hint,
      explain,
    });
  }
  return mk(c, {
    prompt: `${big}원은 ${small}원짜리 동전 몇 개와 같을까요? 숫자를 눌러 알려 주세요.`,
    say: `${big}원은 ${small}원짜리 동전 몇 개와 같을까요? 숫자를 눌러 알려 주세요.`,
    answer: { t: 'number', correct: n, maxDigits: 2 },
    hint,
    explain,
  });
}

// ---------------------------------------------------------------------------
// 돈 세기
// ---------------------------------------------------------------------------

function sumWrongs(sum: number): number[] {
  return [sum + 100, sum - 100, sum + 10, sum - 10, sum + 50, sum - 50].filter((x) => x >= 10 && x <= 990 && x !== sum);
}

export function coinCountGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;

  if (L === 1) {
    // 같은 동전 여러 개
    const w = pick(r, [100, 100, 50, 10]);
    const n = int(r, 2, w === 100 ? 5 : 6);
    const coins = Array.from({ length: n }, () => w);
    const sum = w * n;
    const wrongs = [sum + w, sum - w, w * (n + 2), n * 10].filter((x) => x >= 10 && x <= 990 && x !== sum);
    return mk(c, {
      prompt: '동전은 모두 얼마일까요?',
      say: '동전은 모두 얼마일까요?',
      visual: coinVis(coins),
      answer: buildChoice(r, wonOpt(sum), wrongs.map(wonOpt), 3),
      hint: { say: `${w}원짜리가 ${n}개예요. ${w}원씩 뛰어 세어 봐요.`, visual: { k: 'stones', seq: Array.from({ length: Math.min(n, 12) }, (_, i) => (i + 1) * w) } },
      explain: `${w}원짜리 동전이 ${n}개니까 모두 ${sum}원이에요.`,
    });
  }

  if (L === 2) {
    // 두 가지 동전: 큰 동전부터 차례로 세기
    const kinds = sample(r, [10, 50, 100, 500], 2).sort((a, b) => b - a) as [number, number];
    const bigN = kinds[0] === 500 ? 1 : int(r, 1, 3);
    const smallN = int(r, 1, 3);
    const coins = [...Array.from({ length: bigN }, () => kinds[0]), ...Array.from({ length: smallN }, () => kinds[1])];
    const sum = sumOf(coins);
    const bigPart = kinds[0] * bigN;
    return mk(c, {
      prompt: '동전은 모두 얼마일까요?',
      say: '동전은 모두 얼마일까요?',
      visual: coinVis(coins),
      answer: buildChoice(r, wonOpt(sum), sumWrongs(sum).map(wonOpt), 3),
      hint: { say: `큰 동전부터 세요. ${kinds[0]}원짜리 ${bigN}개는 ${bigPart}원이에요. 거기에 ${kinds[1]}원짜리를 이어서 더해 봐요.` },
      explain: `${bigPart}원에서 ${kinds[1]}원짜리 ${smallN}개를 더하면 ${sum}원이에요.`,
    });
  }

  if (chance(r, 0.55)) {
    const target = int(r, 8, 70) * 10;
    return mk(c, {
      prompt: `${target}원이 되도록 동전을 지갑에 담아 보세요.`,
      say: `${target}원이 되도록 동전을 지갑에 담아 보세요.`,
      answer: { t: 'coins', target, denoms: [10, 50, 100, 500], showSum: true },
      hint: { say: '큰 동전부터 담고 남은 돈을 작은 동전으로 채워 봐요.', visual: coinVis(composeCoins(r, target, 8)) },
      explain: `${target}원은 이렇게 담을 수 있어요.`,
    });
  }
  const coins = composeCoins(r, int(r, 6, 80) * 10, 8);
  const shuffled = shuffle(r, coins);
  const sum = sumOf(coins);
  return mk(c, {
    prompt: '동전은 모두 얼마일까요? 숫자를 눌러 알려 주세요.',
    say: '동전은 모두 얼마일까요? 숫자를 눌러 알려 주세요.',
    visual: coinVis(shuffled),
    answer: { t: 'number', correct: sum, maxDigits: 3 },
    hint: { say: '큰 동전부터 차례로 세어 보세요.', visual: coinVis(coins) },
    explain: `${[...coins].join('원, ')}원을 모두 더하면 ${sum}원이에요.`,
  });
}

// ---------------------------------------------------------------------------
// 500원 안에서 물건 사기
// ---------------------------------------------------------------------------

const GOODS = [
  { emoji: '🍬', name: '사탕' },
  { emoji: '🍪', name: '과자' },
  { emoji: '🍌', name: '바나나' },
  { emoji: '🥛', name: '우유' },
  { emoji: '🍙', name: '주먹밥' },
  { emoji: '🍩', name: '도넛' },
  { emoji: '🍦', name: '아이스크림' },
  { emoji: '✏️', name: '연필' },
  { emoji: '📒', name: '공책' },
  { emoji: '🧽', name: '지우개' },
  { emoji: '🎈', name: '풍선' },
  { emoji: '🍎', name: '사과' },
];

const priceVis = (g: { emoji: string; name: string }, won: number): Visual => ({ k: 'price', emoji: g.emoji, name: g.name, won });

export function buyGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  const goods = sample(r, GOODS, 4);
  const g = goods[0] as (typeof GOODS)[number];
  const h = (n: number): number => n * 100;

  if (L === 1) {
    // 가진 돈으로 살 수 있을까요?
    const canBuy = chance(r, 0.5);
    const coinsN = int(r, 1, 4);
    const money = h(coinsN);
    const price = canBuy ? h(int(r, 1, coinsN)) : h(int(r, coinsN + 1, 5));
    const yes: Option = { key: 'yes', text: '살 수 있어요', say: '살 수 있어요' };
    const no: Option = { key: 'no', text: '살 수 없어요', say: '살 수 없어요' };
    return mk(c, {
      prompt: `${g.name} 값은 ${price}원이에요. 가진 돈으로 살 수 있을까요?`,
      say: `${g.name} 값은 ${price}원이에요. 가진 돈으로 살 수 있을까요?`,
      visual: { k: 'row', items: [coinVis(Array.from({ length: coinsN }, () => 100)), priceVis(g, price)], gap: 14, wrap: true },
      answer: buildChoice(r, canBuy ? yes : no, [canBuy ? no : yes], 2, 2),
      hint: { say: '가진 돈이 물건 값과 같거나 더 많으면 살 수 있어요. 돈이 모자라면 살 수 없어요.' },
      explain: canBuy ? `가진 돈은 ${money}원이고 값은 ${price}원이니까 살 수 있어요.` : `가진 돈은 ${money}원인데 값이 ${price}원이라서 ${price - money}원이 모자라요.`,
    });
  }

  if (L === 2) {
    if (chance(r, 0.4)) {
      const [a, b] = sample(r, [100, 200, 300, 400, 500], 2) as [number, number];
      const ga = goods[0] as (typeof GOODS)[number];
      const gb = goods[1] as (typeof GOODS)[number];
      const askHigh = chance(r, 0.6);
      const right = (askHigh ? a > b : a < b) ? 'L' : 'R';
      const word = askHigh ? '비싼' : '싼';
      return mk(c, {
        prompt: `값이 더 ${word} 물건을 눌러 보세요.`,
        say: `값이 더 ${word} 물건을 눌러 보세요.`,
        answer: {
          t: 'tapTargets',
          items: [
            { key: 'L', visual: priceVis(ga, a), say: `${ga.name}, ${a}원` },
            { key: 'R', visual: priceVis(gb, b), say: `${gb.name}, ${b}원` },
          ],
          targets: [right],
          cols: 2,
          need: 'one',
        },
        hint: { say: '값에 쓰인 숫자를 읽어 봐요. 숫자가 클수록 비싸요.' },
        explain: `${askHigh ? Math.max(a, b) : Math.min(a, b)}원인 쪽이 더 ${word} 물건이에요.`,
      });
    }
    const amount = h(int(r, 2, 4));
    const prices = shuffle(r, [100, 200, 300, 400, 500]).slice(0, 4);
    if (!prices.some((p) => p <= amount)) prices[0] = amount;
    if (!prices.some((p) => p > amount)) prices[1] = Math.min(500, amount + 100);
    const items: TapItem[] = prices.map((p, i) => ({ key: `g${i}`, visual: priceVis(goods[i] as (typeof GOODS)[number], p), say: `${(goods[i] as (typeof GOODS)[number]).name}, ${p}원` }));
    const targets = items.filter((_, i) => (prices[i] as number) <= amount).map((it) => it.key);
    return mk(c, {
      prompt: `${amount}원으로 살 수 있는 물건을 모두 골라 보세요.`,
      say: `${amount}원으로 살 수 있는 물건을 모두 골라 보세요.`,
      visual: coinVis(composeCoins(r, amount, 5, [100, 500])),
      answer: { t: 'tapTargets', items, targets, cols: 2, need: 'all' },
      hint: { say: `값이 ${amount}원보다 크지 않은 물건은 살 수 있어요.` },
      explain: `${amount}원 이하인 물건을 살 수 있어요.`,
    });
  }

  const roll = r();
  if (roll < 0.4) {
    const price = pick(r, [100, 200, 300, 400, 150, 250, 350]);
    const change = 500 - price;
    const wrongs = [change + 100, change - 100, change + 50, price, change - 50].filter((x) => x >= 10 && x !== change && x < 500);
    return mk(c, {
      prompt: `500원으로 ${price}원짜리 ${withJosa(g.name, '을/를')} 샀어요. 남은 돈은 얼마일까요?`,
      say: `500원으로 ${price}원짜리 ${withJosa(g.name, '을/를')} 샀어요. 남은 돈은 얼마일까요?`,
      visual: { k: 'row', items: [coinVis([500]), priceVis(g, price)], gap: 14, wrap: true },
      answer: buildChoice(r, wonOpt(change), wrongs.map(wonOpt), 3),
      hint: { say: `500원에서 ${price}원을 빼면 돼요. 쓰고 남은 돈을 구하는 거예요.`, visual: { k: 'eq', parts: ['500', '−', String(price), '=', '?'] } },
      explain: `500 − ${price} = ${change}, 남은 돈은 ${change}원이에요.`,
    });
  }
  const pa = pick(r, [100, 200, 300]);
  const pb = pick(r, [100, 200, 300, 400].filter((x) => pa + x <= 500));
  const gb = goods[1] as (typeof GOODS)[number];
  if (roll < 0.75) {
    const sum = pa + pb;
    const wrongs = [sum + 100, sum - 100, sum + 200, pa, pb].filter((x) => x >= 100 && x !== sum && x <= 600);
    return mk(c, {
      prompt: `${g.name} ${pa}원과 ${gb.name} ${pb}원을 모두 사려면 얼마가 필요할까요?`,
      say: `${g.name} ${pa}원과 ${gb.name} ${pb}원을 모두 사려면 얼마가 필요할까요?`,
      visual: { k: 'row', items: [priceVis(g, pa), priceVis(gb, pb)], gap: 14, wrap: true },
      answer: buildChoice(r, wonOpt(sum), wrongs.map(wonOpt), 3),
      hint: { say: `두 값을 더해요. ${pa}원과 ${pb}원을 이어서 세어 봐요.`, visual: { k: 'eq', parts: [String(pa), '+', String(pb), '=', '?'] } },
      explain: `${pa} + ${pb} = ${sum}, 모두 ${sum}원이 필요해요.`,
    });
  }
  const pc = pick(r, [200, 300, 400]);
  const pd = pick(r, [200, 300, 400]);
  const total = pc + pd;
  const ok = total <= 500;
  const yes: Option = { key: 'yes', text: '살 수 있어요', say: '살 수 있어요' };
  const no: Option = { key: 'no', text: '살 수 없어요', say: '살 수 없어요' };
  return mk(c, {
    prompt: `${g.name} ${pc}원과 ${gb.name} ${pd}원이에요. 500원으로 둘 다 살 수 있을까요?`,
    say: `${g.name} ${pc}원과 ${gb.name} ${pd}원이에요. 오백 원으로 둘 다 살 수 있을까요?`,
    visual: { k: 'row', items: [coinVis([500]), priceVis(g, pc), priceVis(gb, pd)], gap: 10, wrap: true },
    answer: buildChoice(r, ok ? yes : no, [ok ? no : yes], 2, 2),
    hint: { say: '두 물건 값을 더한 돈이 500원보다 많으면 살 수 없어요.', visual: { k: 'eq', parts: [String(pc), '+', String(pd), '=', '?'] } },
    explain: ok ? `${pc} + ${pd} = ${total}이라서 500원으로 살 수 있어요.` : `${pc} + ${pd} = ${total}이라서 500원보다 많아요. 살 수 없어요.`,
  });
}

/** 보너스 게임: 마을 가게. 동전을 담아 값을 맞게 낸다. */
export function shopPayGen(cfg: { denoms: number[]; maxWon: number; fine?: boolean }) {
  return (c: GenCtx): Question => {
    const r = c.rng;
    const L = c.level;
    const g = pick(r, GOODS);
    const units = Math.floor(cfg.maxWon / 100);
    const hi = L === 1 ? Math.min(3, units) : units;
    let price = int(r, 1, Math.max(1, hi)) * 100;
    const deltas = cfg.denoms.includes(10) ? [50, 10, 40] : cfg.denoms.includes(50) ? [50] : [];
    if (cfg.fine && L >= 2 && deltas.length > 0 && chance(r, 0.5)) price = Math.max(50, price - pick(r, deltas));
    const denoms = cfg.denoms.filter((d) => d <= price);
    const hintCoins = composeCoins(r, price, 8, denoms.length ? denoms : [10]);
    return mk(c, {
      prompt: `${g.name} ${price}원이에요. 동전을 담아서 값을 내 보세요.`,
      say: `${g.name} ${price}원이에요. 동전을 담아서 값을 내 보세요.`,
      visual: priceVis(g, price),
      answer: { t: 'coins', target: price, denoms: cfg.denoms, showSum: true },
      hint: { say: '동전을 눌러 지갑에 담아요. 담은 돈이 물건 값과 같아질 때까지 담아 봐요.', visual: coinVis(hintCoins) },
      explain: `${price}원은 이렇게 낼 수 있어요.`,
    });
  };
}

