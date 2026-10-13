import { WEEKDAYS_LONG, WEEKDAYS_SHORT, daysInMonth, weekdayOf } from '../dates';
import { countKo, josa, monthKo, timeKo, timeText, withJosa } from '../ko';
import { chance, distinctInts, int, pick, sample, shuffle } from '../rng';
import type { GenCtx, Level, MatchPair, Option, OrderItem, Question, TapItem, Visual } from '../types';
import { clockVis } from './clock';
import { layoutFor, orderGen } from './number';
import { FLATS, SOLIDS, SOLID_ITEMS, SOLID_NAME, TONES, flatVisual } from './shape';
import { buildChoice, dj, mk, numChoice, range, shuffleDiff, sn } from './util';

// ---------------------------------------------------------------------------
// 별 낚시: 별의 수를 세어 같은 숫자의 물고기를 잡는다
// ---------------------------------------------------------------------------

export function fishGen(cfg: { lo: number; hi: number }) {
  return (c: GenCtx): Question => {
    const r = c.rng;
    const L = c.level;
    const easyHi = Math.max(Math.min(cfg.hi, cfg.hi > 10 ? 12 : 6), Math.min(cfg.hi, cfg.lo + 4));
    const n =
      L === 1
        ? int(r, cfg.lo, easyHi)
        : L === 2
          ? int(r, cfg.lo, cfg.hi)
          : int(r, Math.max(cfg.lo, Math.ceil((cfg.lo + cfg.hi) / 2)), cfg.hi);
    const star = '⭐';
    const hint = {
      say: '하나씩 짚으면서 세어 봐요.',
      visual: { k: 'objects', emoji: star, n, numbered: true, layout: layoutFor(n, 1) } as Visual,
    };
    const explain = `별은 모두 ${countKo(n, '개')}예요.`;

    // 숫자 -> 같은 수의 별을 가진 물고기 (10까지만)
    if (L === 2 && cfg.hi <= 10) {
      const toOpt = (m: number): Option => ({
        key: String(m),
        visual: { k: 'objects', emoji: star, n: m, layout: 'scatter', size: 'sm' },
        say: countKo(m, '개'),
      });
      const wrongs = [n - 1, n + 1, n - 2, n + 2].filter((v) => v >= 1 && v <= cfg.hi + 1);
      return mk(c, {
        prompt: `숫자 ${n}만큼 별이 있는 물고기를 잡아요!`,
        say: `숫자 ${n}만큼 별이 있는 물고기를 잡아요!`,
        visual: { k: 'big', text: String(n), tone: 'sky' },
        answer: buildChoice(r, toOpt(n), wrongs.map(toOpt), 3, 3),
        hint,
        explain: `숫자 ${n}${josa(String(n), '은/는')} 별 ${countKo(n, '개')}를 나타내요.`,
      });
    }

    const visual: Visual = {
      k: 'objects',
      emoji: star,
      n,
      layout: L === 3 ? 'scatter' : layoutFor(n, L === 1 ? 1 : 2),
      countable: L <= 2,
      size: n > 20 ? 'sm' : 'md',
      ...(n > 20 ? { cols: 10 } : {}),
    };
    return mk(c, {
      prompt: '별이 모두 몇 개일까요? 같은 숫자의 물고기를 잡아요!',
      say: '별이 모두 몇 개일까요? 같은 숫자의 물고기를 잡아요!',
      visual,
      answer: numChoice(r, n, Math.max(1, cfg.lo - 1), cfg.hi + 1, { say: (m) => sn(m) }),
      hint,
      explain,
    });
  };
}

// ---------------------------------------------------------------------------
// 징검다리: 빈 돌에 알맞은 수를 놓아 강을 건넌다
// ---------------------------------------------------------------------------

export function stonesGen(cfg: { lo: number; hi: number }) {
  const base = orderGen(cfg);
  return (c: GenCtx): Question => {
    const q = base(c);
    if (q.answer.t === 'gaps') {
      return { ...q, prompt: '강을 건너요! 빈 돌에 알맞은 수를 놓아 보세요.', say: '강을 건너요! 빈 돌에 알맞은 수를 놓아 보세요.' };
    }
    return q;
  };
}

// ---------------------------------------------------------------------------
// 구슬 병: 구슬을 두 병에 가르거나 모은다
// ---------------------------------------------------------------------------

const MARBLE = '🔵';

export function jarsGen(cfg: { lo: number; hi: number; mode: 'split' | 'merge' | 'mix' }) {
  return (c: GenCtx): Question => {
    const r = c.rng;
    const L = c.level;
    const total = int(r, Math.max(2, cfg.lo), cfg.hi);
    const a = int(r, 1, total - 1);
    const b = total - a;
    const mode = cfg.mode === 'mix' ? (chance(r, 0.5) ? 'split' : 'merge') : cfg.mode;
    const digits: 1 | 2 = total >= 10 ? 2 : 1;
    const both: Visual = { k: 'groups', a: { emoji: MARBLE, n: a }, b: { emoji: MARBLE, n: b }, op: '+' };
    const lastB: Visual = { k: 'groups', a: { emoji: MARBLE, n: a }, b: { emoji: MARBLE, n: b, unknown: true }, op: '+' };

    if (mode === 'split') {
      if (L === 1) {
        return mk(c, {
          prompt: `구슬 ${total}개를 왼쪽 병에 ${a}개 담아 보세요.`,
          say: `구슬 ${total}개를 왼쪽 병에 ${a}개 담아 보세요.`,
          answer: { t: 'split', total, left: a, emoji: MARBLE },
          hint: { say: '구슬을 눌러서 왼쪽 병으로 옮겨 봐요.' },
          explain: `왼쪽에 ${countKo(a, '개')}, 오른쪽에 ${countKo(b, '개')}가 남아요.`,
        });
      }
      const ask = `구슬 ${total}개를 두 병에 나눠 담았어요. 왼쪽 병에 ${a}개 있다면 오른쪽 병에는 몇 개 있을까요?`;
      const hint = { say: '전체에서 왼쪽 병의 구슬을 빼면 오른쪽 병의 구슬이에요.', visual: lastB };
      const explain = `오른쪽 병에는 ${countKo(b, '개')}가 있어요. ${dj(a, '과/와')} ${dj(b, '을/를')} 합치면 ${dj(total, '이/가')} 돼요.`;
      if (L === 2) {
        return mk(c, {
          prompt: ask,
          say: ask,
          visual: lastB,
          answer: numChoice(r, b, 1, Math.max(cfg.hi - 1, b + 1), { say: (m) => countKo(m, '개') }),
          hint,
          explain,
        });
      }
      return mk(c, {
        prompt: ask,
        say: ask,
        visual: { k: 'bond', total, a, b: null },
        answer: { t: 'number', correct: b, maxDigits: digits },
        hint,
        explain,
      });
    }

    // 모으기
    const ask = `왼쪽 병에 구슬 ${a}개, 오른쪽 병에 구슬 ${b}개가 있어요. 모두 몇 개일까요?`;
    const explain = `${dj(a, '과/와')} ${dj(b, '을/를')} 모으면 ${dj(total, '이/가')} 돼요. 구슬은 모두 ${countKo(total, '개')}예요.`;
    const hint = { say: '두 병의 구슬을 합쳐서 하나씩 세어 봐요.', visual: { k: 'objects', emoji: MARBLE, n: total, numbered: true, layout: layoutFor(total, 1) } as Visual };
    if (L === 1) {
      return mk(c, {
        prompt: ask,
        say: ask,
        visual: both,
        answer: numChoice(r, total, 1, cfg.hi + 1, { say: (m) => countKo(m, '개') }),
        hint,
        explain,
      });
    }
    const ask2 = `${a}${josa(String(a), '과/와')} ${b}${josa(String(b), '을/를')} 모으면 몇이 될까요?`;
    if (L === 2) {
      return mk(c, {
        prompt: ask2,
        say: ask2,
        visual: { k: 'bond', total: null, a, b },
        answer: numChoice(r, total, 1, cfg.hi + 1, { say: (m) => sn(m) }),
        hint,
        explain,
      });
    }
    return mk(c, {
      prompt: ask2,
      say: ask2,
      visual: { k: 'bond', total: null, a, b },
      answer: { t: 'number', correct: total, maxDigits: digits },
      hint,
      explain,
    });
  };
}

// ---------------------------------------------------------------------------
// 풍선 터뜨리기
// ---------------------------------------------------------------------------

export function balloonsCompareGen(cfg: { lo: number; hi: number }) {
  return (c: GenCtx): Question => {
    const r = c.rng;
    const L = c.level;
    const item = (n: number): TapItem => ({ key: String(n), text: String(n), say: sn(n) });

    if (L === 1) {
      const three = distinctInts(r, cfg.lo, cfg.hi, 3);
      const big = chance(r, 0.6);
      const target = big ? Math.max(...three) : Math.min(...three);
      const word = big ? '가장 큰' : '가장 작은';
      return mk(c, {
        prompt: `${word} 수가 적힌 풍선을 터뜨려 보세요.`,
        say: `${word} 수가 적힌 풍선을 터뜨려 보세요.`,
        answer: { t: 'tapTargets', items: three.map(item), targets: [String(target)], cols: 3, need: 'one' },
        hint: { say: '수를 차례대로 줄 세워 보면 알 수 있어요.', visual: { k: 'stones', seq: range(Math.min(...three), Math.max(...three)) } },
        explain: `${target}${josa(String(target), '이/가')} ${word} 수예요.`,
      });
    }

    const span = cfg.hi - cfg.lo + 1;
    if (L === 2 || span < 8) {
      const pivot = int(r, cfg.lo + 2, cfg.hi - 2);
      const bigger = chance(r, 0.6);
      const pool = range(cfg.lo, cfg.hi).filter((x) => x !== pivot);
      let nums: number[] = [];
      let targets: number[] = [];
      for (let t = 0; t < 30; t++) {
        nums = sample(r, pool, Math.min(6, pool.length));
        targets = nums.filter((x) => (bigger ? x > pivot : x < pivot));
        if (targets.length >= 1 && targets.length <= nums.length - 1) break;
      }
      const word = bigger ? '큰' : '작은';
      const text = `${pivot}보다 ${word} 수가 적힌 풍선을 모두 터뜨려 보세요.`;
      return mk(c, {
        prompt: text,
        say: text,
        answer: { t: 'tapTargets', items: nums.map(item), targets: targets.map(String), cols: 3, need: 'all' },
        hint: { say: `${pivot}보다 ${bigger ? '뒤에' : '앞에'} 오는 수를 찾아요.`, visual: { k: 'stones', seq: range(cfg.lo, cfg.hi) } },
        explain: `${targets.length}개의 풍선을 터뜨려야 해요.`,
      });
    }

    const lo = int(r, cfg.lo, cfg.hi - 4);
    const hi = int(r, lo + 3, Math.min(cfg.hi, lo + 5));
    const pool = range(cfg.lo, cfg.hi).filter((x) => x !== lo && x !== hi);
    let nums: number[] = [];
    let targets: number[] = [];
    for (let t = 0; t < 30; t++) {
      nums = sample(r, pool, Math.min(6, pool.length));
      targets = nums.filter((x) => x > lo && x < hi);
      if (targets.length >= 1 && targets.length <= nums.length - 1) break;
    }
    const text = `${lo}보다 크고 ${hi}보다 작은 수가 적힌 풍선을 모두 터뜨려 보세요.`;
    return mk(c, {
      prompt: text,
      say: text,
      answer: { t: 'tapTargets', items: nums.map(item), targets: targets.map(String), cols: 3, need: 'all' },
      hint: { say: `${dj(lo, '과/와')} ${hi} 사이에 있는 수를 찾아요.`, visual: { k: 'stones', seq: range(lo, hi) } },
      explain: `${dj(lo, '과/와')} ${hi} 사이의 수는 ${range(lo + 1, hi - 1).join(', ')}${josa(String(hi - 1), '이에요/예요')}.`,
    });
  };
}

export function balloonsSolidGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  const s = pick(r, SOLIDS);
  const targetN = L === 1 ? 1 : L === 2 ? 2 : 3;
  const total = L === 1 ? 4 : L === 2 ? 6 : 8;
  const targets = sample(r, SOLID_ITEMS[s], targetN);
  const rest = shuffle(
    r,
    SOLIDS.filter((x) => x !== s).flatMap((x) => SOLID_ITEMS[x]),
  ).slice(0, total - targetN);
  const items: TapItem[] = shuffle(r, [...targets, ...rest]).map((it) => ({ key: it.emoji, text: it.emoji, say: it.name }));
  const name = SOLID_NAME[s];
  return mk(c, {
    prompt: `${name} 물건이 담긴 풍선을 ${targetN === 1 ? '터뜨려' : '모두 터뜨려'} 보세요.`,
    say: `${name} 물건이 담긴 풍선을 ${targetN === 1 ? '터뜨려' : '모두 터뜨려'} 보세요.`,
    answer: { t: 'tapTargets', items, targets: targets.map((t) => t.emoji), cols: total > 6 ? 4 : 3, need: targetN === 1 ? 'one' : 'all' },
    hint: { say: `${name}과 닮은 물건을 찾아 봐요.`, visual: { k: 'solid', solid: s, size: 96 } },
    explain: `${name} 물건은 ${targets.map((t) => t.name).join(', ')}${josa(targets[targets.length - 1]?.name ?? '', '이에요/예요')}.`,
  });
}

export function balloonsShapeGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  const f = pick(r, FLATS);
  const targetN = L === 1 ? 1 : L === 2 ? int(r, 2, 3) : int(r, 2, 4);
  const total = L === 1 ? 4 : L === 2 ? 6 : 8;
  const kinds = shuffle(
    r,
    Array.from({ length: total }, (_, i) => (i < targetN ? f : pick(r, FLATS.filter((x) => x !== f)))),
  );
  const items: TapItem[] = kinds.map((x, i) => ({
    key: `b${i}`,
    visual: { ...(flatVisual(r, x, 56) as Extract<Visual, { k: 'shape' }>), color: pick(r, TONES) },
    say: x,
  }));
  const targets = kinds.map((x, i) => (x === f ? `b${i}` : '')).filter(Boolean);
  const text = `${f} 풍선을 ${targetN === 1 ? '터뜨려' : '모두 터뜨려'} 보세요.`;
  return mk(c, {
    prompt: text,
    say: text,
    answer: { t: 'tapTargets', items, targets, cols: total > 6 ? 4 : 3, need: targetN === 1 ? 'one' : 'all' },
    hint: { say: '뾰족한 곳을 세어 보면서 찾아 봐요.' },
    explain: `${f} 모양은 모두 ${countKo(targets.length, '개')}예요.`,
  });
}

// ---------------------------------------------------------------------------
// 바늘 돌리기
// ---------------------------------------------------------------------------

const ANIMALS = ['토끼', '곰', '여우', '고양이', '강아지', '다람쥐', '코끼리', '펭귄'];
const DOINGS = ['간식을 먹어요', '책을 읽어요', '그림을 그려요', '산책을 가요', '공놀이를 해요', '노래를 불러요', '양치질을 해요', '친구를 만나요'];

/** half: 30분 시각이 나올 확률(true면 0.5). halfFrom: 이 단계부터 30분이 나온다(기본 2). */
export function handsGen(cfg: { hours: number[]; wording: 'pointer' | 'time'; half?: boolean | number; halfFrom?: Level }) {
  const halfP = typeof cfg.half === 'number' ? cfg.half : cfg.half ? 0.5 : 0;
  return (c: GenCtx): Question => {
    const r = c.rng;
    const L = c.level;
    const easy = cfg.hours.filter((h) => h === 12 || h === 3 || h === 6 || h === 9);
    const pool = L === 1 && easy.length >= 2 && cfg.wording === 'pointer' ? easy : cfg.hours;
    const h = pick(r, pool);
    const useHalf = halfP > 0 && L >= (cfg.halfFrom ?? 2) && chance(r, halfP);
    const m = useHalf ? 30 : 0;
    const mode = useHalf ? 'half' : 'hour';
    const hintVisual = clockVis(h, m, { size: 'md' });

    if (cfg.wording === 'pointer') {
      const text = `짧은바늘이 ${h}${josa(String(h), '을/를')} 가리키게 돌려 보세요.`;
      return mk(c, {
        prompt: text,
        say: text,
        answer: { t: 'clockSet', h, m: 0, mode: 'hour' },
        hint: { say: '짧은바늘의 끝을 잡고 그 숫자까지 끌어 봐요.', visual: hintVisual },
        explain: `짧은바늘이 ${h}에 오도록 맞추면 돼요.`,
      });
    }

    const tt = timeText(h, m);
    const hint = {
      say: useHalf
        ? '긴바늘은 6에, 짧은바늘은 두 숫자의 가운데에 놓아요.'
        : `긴바늘은 12에 두고, 짧은바늘을 ${h}에 맞춰 봐요.`,
      visual: hintVisual,
    };
    const explain = `${timeKo(h, m)}는 이렇게 보여요.`;
    if (L === 1) {
      const text = `${withJosa(tt, '이/가')} 되도록 시계를 맞춰 보세요.`;
      return mk(c, {
        prompt: text,
        say: text,
        visual: { k: 'digital', h, m },
        answer: { t: 'clockSet', h, m, mode },
        hint,
        explain,
      });
    }
    if (L === 2) {
      const animal = pick(r, ANIMALS);
      const doing = pick(r, DOINGS);
      const text = `${withJosa(animal, '이/가')} ${tt}에 ${doing}. 시계를 ${tt}${josa(tt, '으로/로')} 맞춰 보세요.`;
      return mk(c, {
        prompt: text,
        say: text,
        answer: { t: 'clockSet', h, m, mode },
        hint,
        explain,
      });
    }
    return mk(c, {
      prompt: '디지털 시계와 같은 시각이 되도록 아날로그 시계를 맞춰 보세요.',
      say: '디지털 시계와 같은 시각이 되도록 아날로그 시계를 맞춰 보세요.',
      visual: { k: 'digital', h, m },
      answer: { t: 'clockSet', h, m, mode },
      hint,
      explain,
    });
  };
}

// ---------------------------------------------------------------------------
// 시계 짝 맞추기
// ---------------------------------------------------------------------------

export function clockMatchGen(cfg: { hours: number[]; half?: boolean | number; halfFrom?: Level }) {
  const halfP = typeof cfg.half === 'number' ? cfg.half : cfg.half ? 0.4 : 0;
  return (c: GenCtx): Question => {
    const r = c.rng;
    const L = c.level;
    const want = L === 1 ? 3 : L === 2 ? 4 : 5;
    const hours = sample(r, cfg.hours, Math.min(want, cfg.hours.length));
    const pairs: MatchPair[] = hours.map((h) => {
      const m = halfP > 0 && L >= (cfg.halfFrom ?? 2) && chance(r, halfP) ? 30 : 0;
      const label = L === 3 ? `${h}:${m === 0 ? '00' : '30'}` : timeText(h, m);
      return { key: `t${h}-${m}`, a: { visual: clockVis(h, m, { size: 'sm' }) }, b: { text: label } };
    });
    const text = L === 3 ? '아날로그 시계와 디지털 시계를 알맞게 이어 보세요.' : '시계와 시각을 알맞게 이어 보세요.';
    return mk(c, {
      prompt: text,
      say: text,
      answer: { t: 'match', pairs },
      hint: {
        say: pairs.some((p) => p.key.endsWith('-30'))
          ? '긴바늘이 12에 있으면 정각, 6에 있으면 30분이에요. 짧은바늘이 지나간 숫자를 읽어 봐요.'
          : '긴바늘이 12에 있는지 보고, 짧은바늘이 가리키는 숫자를 읽어 봐요.',
      },
      explain: '짧은바늘이 가리키는 숫자가 시각이고, 긴바늘이 6이면 30분이에요.',
    });
  };
}

// ---------------------------------------------------------------------------
// 하루 카드
// ---------------------------------------------------------------------------

const DAY_STEPS = [
  { key: 'wake', emoji: '⏰', label: '일어나요' },
  { key: 'breakfast', emoji: '🍚', label: '아침밥을 먹어요' },
  { key: 'school', emoji: '🎒', label: '학교에 가요' },
  { key: 'lunch', emoji: '🍱', label: '점심을 먹어요' },
  { key: 'play', emoji: '⚽', label: '친구와 놀아요' },
  { key: 'home', emoji: '🏠', label: '집에 돌아와요' },
  { key: 'dinner', emoji: '🍲', label: '저녁밥을 먹어요' },
  { key: 'wash', emoji: '🛁', label: '씻어요' },
  { key: 'sleep', emoji: '😴', label: '잠을 자요' },
] as const;

export function dayCardsGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  const count = L === 1 ? 3 : L === 2 ? 4 : 5;
  const idx = [...distinctInts(r, 0, DAY_STEPS.length - 1, count)].sort((a, b) => a - b);
  const steps = idx.map((i) => DAY_STEPS[i] as (typeof DAY_STEPS)[number]);
  const items: OrderItem[] = steps.map((s) => ({ key: s.key, text: `${s.emoji} ${s.label}`, say: s.label }));
  const correct = steps.map((s) => s.key);
  return mk(c, {
    prompt: '하루에 일어나는 일을 먼저 하는 것부터 차례대로 눌러 보세요.',
    say: '하루에 일어나는 일을 먼저 하는 것부터 차례대로 눌러 보세요.',
    answer: { t: 'order', items: shuffleDiff(r, items, correct), correct, style: 'cards' },
    hint: { say: '아침에 하는 일이 먼저, 저녁과 밤에 하는 일이 나중이에요.' },
    explain: `${steps.map((s) => s.label).join(', ')} 순서예요.`,
  });
}

// ---------------------------------------------------------------------------
// 요일 기차 · 달 기차
// ---------------------------------------------------------------------------

export function weekTrainGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  const len = L === 1 ? 3 : L === 2 ? 5 : 7;
  const start = int(r, 0, 7 - len);
  const days = range(start, start + len - 1);
  const items: OrderItem[] = days.map((d) => ({ key: `w${d}`, text: WEEKDAYS_SHORT[d] as string, say: WEEKDAYS_LONG[d] as string }));
  const correct = days.map((d) => `w${d}`);
  return mk(c, {
    prompt: '요일 기차의 칸을 앞에서부터 차례대로 눌러 보세요.',
    say: '요일 기차의 칸을 앞에서부터 차례대로 눌러 보세요.',
    answer: { t: 'order', items: shuffleDiff(r, items, correct), correct, style: 'train' },
    hint: { say: '일, 월, 화, 수, 목, 금, 토 순서로 이어져요.', visual: { k: 'weekdays', names: 'short' } },
    explain: `${days.map((d) => WEEKDAYS_LONG[d]).join(', ')} 순서예요.`,
  });
}

export function monthTrainGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  const len = L === 1 ? 3 : L === 2 ? 5 : 7;
  const start = int(r, 1, 12 - len + 1);
  const months = range(start, start + len - 1);
  const items: OrderItem[] = months.map((m) => ({ key: `m${m}`, text: `${m}월`, say: monthKo(m) }));
  const correct = months.map((m) => `m${m}`);
  return mk(c, {
    prompt: '달 기차의 칸을 앞에서부터 차례대로 눌러 보세요.',
    say: '달 기차의 칸을 앞에서부터 차례대로 눌러 보세요.',
    answer: { t: 'order', items: shuffleDiff(r, items, correct), correct, style: 'train' },
    hint: { say: '1월부터 12월까지 차례대로 이어져요.', visual: { k: 'months' } },
    explain: `${months.map((m) => `${m}월`).join(', ')} 순서예요.`,
  });
}

// ---------------------------------------------------------------------------
// 날짜 보물찾기
// ---------------------------------------------------------------------------

export function dateHuntGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level as Level;
  const t = c.today;
  let year = t.y;
  let month = t.m;
  if (L === 3) {
    const shift = pick(r, [-1, 0, 0, 1]);
    month += shift;
    if (month < 1) {
      month = 12;
      year -= 1;
    } else if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  const dim = daysInMonth(year, month);
  const marks = year === t.y && month === t.m ? { [t.d]: 'today' as const } : undefined;
  const withMarks = marks ? { marks } : {};

  if (L === 1) {
    const d = int(r, 1, 28);
    return mk(c, {
      prompt: `보물은 ${month}월 ${d}일에 숨어 있어요. ${d}일을 찾아 눌러 보세요.`,
      say: `보물은 ${month}월 ${d}일에 숨어 있어요. ${d}일을 찾아 눌러 보세요.`,
      answer: { t: 'calTap', year, month, targets: [d], need: 'one', ...withMarks },
      hint: { say: '칸 안의 숫자를 하나씩 읽으며 찾아봐요. 숫자는 왼쪽에서 오른쪽으로 커져요.' },
      explain: `${d}일은 여기예요.`,
    });
  }
  if (L === 2) {
    const wd = int(r, 0, 6);
    const targets: number[] = [];
    for (let d = 1; d <= dim; d++) if (weekdayOf(year, month, d) === wd) targets.push(d);
    return mk(c, {
      prompt: `보물은 ${WEEKDAYS_LONG[wd]}에 숨어 있어요. ${month}월의 ${WEEKDAYS_LONG[wd]}을 모두 찾아 눌러 보세요.`,
      say: `보물은 ${WEEKDAYS_LONG[wd]}에 숨어 있어요. ${month}월의 ${WEEKDAYS_LONG[wd]}을 모두 찾아 눌러 보세요.`,
      answer: { t: 'calTap', year, month, targets, need: 'all', ...withMarks },
      hint: { say: `같은 요일은 위쪽 요일 이름 아래, 같은 세로줄에 있어요.`, visual: { k: 'calendar', year, month, highlightWeekday: wd, compact: true } },
      explain: `${WEEKDAYS_LONG[wd]}은 모두 ${targets.length}번 있어요.`,
    });
  }
  const kind = pick(r, ['after', 'before', 'week'] as const);
  if (kind === 'week') {
    const d = int(r, 1, Math.max(1, dim - 7));
    return mk(c, {
      prompt: `${month}월 ${d}일에서 일주일 뒤는 며칠일까요? 그 날짜를 눌러 보세요.`,
      say: `${month}월 ${d}일에서 일주일 뒤는 며칠일까요? 그 날짜를 눌러 보세요.`,
      answer: { t: 'calTap', year, month, targets: [d + 7], need: 'one', marks: { ...(marks ?? {}), [d]: 'start' as const } },
      hint: { say: '일주일은 칠 일이에요. 같은 요일로 바로 아래 칸이 일주일 뒤예요.' },
      explain: `일주일 뒤는 ${d + 7}일이에요.`,
    });
  }
  const d = int(r, 2, dim - 1);
  const target = kind === 'after' ? d + 1 : d - 1;
  const text = `${month}월 ${d}일 ${kind === 'after' ? '다음 날' : '바로 전 날'}은 며칠일까요? 그 날짜를 눌러 보세요.`;
  return mk(c, {
    prompt: text,
    say: text,
    answer: { t: 'calTap', year, month, targets: [target], need: 'one', marks: { ...(marks ?? {}), [d]: 'start' as const } },
    hint: { say: kind === 'after' ? '다음 날은 바로 오른쪽 칸이에요.' : '전 날은 바로 왼쪽 칸이에요.' },
    explain: `${kind === 'after' ? '다음 날' : '전 날'}은 ${target}일이에요.`,
  });
}
