import { OBJECTS } from '../objects';
import { chance, distinctInts, int, pick, shuffle } from '../rng';
import { countKo, josa, withJosa } from '../ko';
import type { GenCtx, Level, Option, Question, Visual } from '../types';
import { buildChoice, dj, mk, numChoice, range, sj, sn } from './util';

// ---------------------------------------------------------------------------
// 세기 (10까지, 20까지, 50까지)
// ---------------------------------------------------------------------------

export interface CountCfg {
  lo: number;
  hi: number;
  /** 1단계에서 쓰는 최대 수 */
  l1hi: number;
}

export function layoutFor(n: number, level: Level): 'row' | 'scatter' | 'frame10' | 'frame20' {
  if (n <= 5) return level === 1 ? 'row' : 'scatter';
  if (n <= 10) return level === 1 ? 'frame10' : 'scatter';
  if (n <= 20) return level === 1 ? 'frame20' : 'row';
  return 'row';
}

export function countGen(cfg: CountCfg) {
  return (c: GenCtx): Question => {
    const r = c.rng;
    const L = c.level;
    const obj = pick(r, OBJECTS);
    const asked = `${withJosa(obj.name, '이/가')} 몇 ${obj.counter}일까요?`;
    const n = L === 1 ? int(r, cfg.lo, cfg.l1hi) : int(r, cfg.lo, cfg.hi);
    const say = (k: number) => countKo(k, obj.counter);
    const hint = {
      say: '하나씩 짚으면서 세어 봐요.',
      visual: { k: 'objects', emoji: obj.emoji, n, numbered: true, layout: layoutFor(n, 1), cols: n > 20 ? 10 : undefined } as Visual,
    };
    const explain = `${say(n)}예요. 하나씩 세어 보면 알 수 있어요.`;
    const big = cfg.hi > 20;

    // 3단계: 직접 집어 세기
    if (L === 3 && !big && n <= 15 && chance(r, 0.6)) {
      const total = Math.min(20, n + int(r, 2, 4));
      return mk(c, {
        prompt: `${obj.name} ${n}${obj.counter}를 눌러 보세요.`,
        say: `${obj.name} ${say(n)}를 눌러 보세요.`,
        answer: { t: 'pickN', emoji: obj.emoji, total, n, unitSay: obj.counter },
        hint: { say: '하나씩 누르면서 세어 봐요.' },
        explain: `${say(n)}만 누르면 돼요.`,
      });
    }
    // 3단계: 숫자 → 그림 찾기
    if (L === 3 && cfg.hi <= 10 && chance(r, 0.5)) {
      const wrongs = [n - 1, n + 1, n - 2, n + 2].filter((v) => v >= 1 && v <= 12);
      const toOpt = (m: number): Option => ({
        key: String(m),
        visual: { k: 'objects', emoji: obj.emoji, n: m, layout: 'scatter', size: 'sm' },
        say: say(m),
      });
      return mk(c, {
        prompt: `${n}${obj.counter} 들어 있는 것을 찾아 보세요.`,
        say: `${say(n)} 들어 있는 것을 찾아 보세요.`,
        visual: { k: 'big', text: String(n), tone: 'sky' },
        answer: buildChoice(r, toOpt(n), wrongs.map(toOpt), 3, 3),
        hint: { say: '그림의 개수를 하나씩 세어 봐요.' },
        explain,
      });
    }

    const visual: Visual = {
      k: 'objects',
      emoji: obj.emoji,
      n,
      layout: layoutFor(n, L),
      countable: L <= 2,
      size: n > 10 ? 'sm' : 'md',
      ...(n > 20 ? { cols: 10 } : {}),
    };
    if ((L === 2 && chance(r, 0.5)) || (big && L >= 2)) {
      return mk(c, {
        prompt: `${asked} 숫자를 눌러 알려 주세요.`,
        say: `${asked} 숫자를 눌러 알려 주세요.`,
        visual,
        answer: { t: 'number', correct: n, maxDigits: cfg.hi >= 100 ? 3 : cfg.hi >= 10 ? 2 : 1 },
        hint,
        explain,
      });
    }
    return mk(c, {
      prompt: asked,
      say: asked,
      visual,
      answer: numChoice(r, n, Math.max(1, cfg.lo - 1), cfg.hi + 1, { say }),
      hint,
      explain,
    });
  };
}

/** 숫자 따라 쓰기 (맞고 틀림은 아이가 스스로 확인) */
export function writeGen(cfg: { lo: number; hi: number }) {
  return (c: GenCtx): Question => {
    const g = int(c.rng, cfg.lo, cfg.hi);
    return mk(c, {
      prompt: `숫자 ${g} 따라 쓰기`,
      say: `숫자 ${sj(g, '을/를')} 손가락으로 따라 써 봐요.`,
      answer: { t: 'trace', glyph: String(g) },
      hint: { say: '점선을 따라 천천히 그려 봐요.' },
      explain: '잘 썼는지 스스로 확인해 봐요.',
    });
  };
}

// ---------------------------------------------------------------------------
// 순서 (징검다리)
// ---------------------------------------------------------------------------

export function orderGen(cfg: { lo: number; hi: number }) {
  return (c: GenCtx): Question => {
    const r = c.rng;
    const L = c.level;
    const span = cfg.hi - cfg.lo + 1;

    if (L === 3 || span < 6) {
      const kind = pick(r, ['before', 'after', 'between'] as const);
      let ans: number;
      let visual: Visual;
      let prompt: string;
      let sayP: string;
      if (kind === 'before') {
        const x = int(r, cfg.lo + 1, cfg.hi);
        ans = x - 1;
        visual = { k: 'stones', seq: [null, x] };
        prompt = `${x} 바로 앞의 수는 무엇일까요?`;
        sayP = `${sn(x)} 바로 앞의 수는 무엇일까요?`;
      } else if (kind === 'between' && span >= 3) {
        const x = int(r, cfg.lo, cfg.hi - 2);
        ans = x + 1;
        visual = { k: 'stones', seq: [x, null, x + 2] };
        prompt = `${x}${josa(String(x), '과/와')} ${x + 2} 사이의 수는 무엇일까요?`;
        sayP = `${sj(x, '과/와')} ${sn(x + 2)} 사이의 수는 무엇일까요?`;
      } else {
        const x = int(r, cfg.lo, cfg.hi - 1);
        ans = x + 1;
        visual = { k: 'stones', seq: [x, null] };
        prompt = `${x} 바로 뒤의 수는 무엇일까요?`;
        sayP = `${sn(x)} 바로 뒤의 수는 무엇일까요?`;
      }
      return mk(c, {
        prompt,
        say: sayP,
        visual,
        answer: numChoice(r, ans, cfg.lo, cfg.hi, { say: (n) => sn(n) }),
        hint: {
          say: '차례대로 세어 보면 알 수 있어요.',
          visual: { k: 'stones', seq: range(Math.max(cfg.lo, ans - 2), Math.min(cfg.hi, ans + 2)) },
        },
        explain: `정답은 ${ans}${josa(String(ans), '이에요/예요')}. 차례대로 세면 ${ans}${josa(String(ans), '이/가')} 와요.`,
      });
    }

    const len = L === 1 ? 5 : Math.min(7, span);
    const start = int(r, cfg.lo, cfg.hi - len + 1);
    const full = range(start, start + len - 1);
    let idxs: number[];
    if (L === 1) {
      idxs = [int(r, 1, len - 2)];
    } else {
      const first = int(r, 1, Math.max(1, len - 4));
      const second = int(r, first + 2, len - 1);
      idxs = [first, second];
    }
    const seq: (number | null)[] = full.map((v, i) => (idxs.includes(i) ? null : v));
    const answers = idxs.map((i) => full[i] as number);
    const extras = distinctInts(r, cfg.lo, cfg.hi, L === 1 ? 2 : 1, full);
    const tokens = shuffle(r, [...answers, ...extras]);
    return mk(c, {
      prompt: '빈 돌에 알맞은 수를 놓아 보세요.',
      say: '빈 돌에 알맞은 수를 놓아 보세요.',
      answer: { t: 'gaps', seq, tokens, answers },
      hint: { say: '왼쪽에서부터 차례대로 세어 봐요.', visual: { k: 'stones', seq: full } },
      explain: `${full.join(', ')} 순서예요.`,
    });
  };
}

// ---------------------------------------------------------------------------
// 크기 비교
// ---------------------------------------------------------------------------

export function compareGen(cfg: { lo: number; hi: number }) {
  return (c: GenCtx): Question => {
    const r = c.rng;
    const L = c.level;
    const obj = pick(r, OBJECTS);

    if (L === 1) {
      const hi = Math.min(cfg.hi, 6);
      const [a, b] = distinctInts(r, cfg.lo, hi, 2) as [number, number];
      const askMore = chance(r, 0.6);
      const target = askMore ? (a > b ? 'L' : 'R') : a < b ? 'L' : 'R';
      const word = askMore ? '더 많은' : '더 적은';
      const mkItem = (key: string, n: number) => ({
        key,
        visual: { k: 'objects', emoji: obj.emoji, n, layout: 'row', size: 'sm' } as Visual,
        say: countKo(n, obj.counter),
      });
      return mk(c, {
        prompt: `${word} 쪽을 눌러 보세요.`,
        say: `${word} 쪽을 눌러 보세요.`,
        answer: { t: 'tapTargets', items: [mkItem('L', a), mkItem('R', b)], targets: [target], cols: 2, need: 'one' },
        hint: { say: '하나씩 짝을 지어 보면 어느 쪽이 남는지 알 수 있어요.' },
        explain: askMore
          ? `${countKo(Math.max(a, b), obj.counter)}가 ${countKo(Math.min(a, b), obj.counter)}보다 더 많아요.`
          : `${countKo(Math.min(a, b), obj.counter)}가 ${countKo(Math.max(a, b), obj.counter)}보다 더 적어요.`,
      });
    }

    if (L === 2) {
      const [a, b] = distinctInts(r, cfg.lo, cfg.hi, 2) as [number, number];
      const askBig = chance(r, 0.6);
      const ans = askBig ? Math.max(a, b) : Math.min(a, b);
      const other = a + b - ans;
      const word = askBig ? '더 큰' : '더 작은';
      const opt = (n: number): Option => ({ key: String(n), text: String(n), say: sn(n) });
      return mk(c, {
        prompt: `${a}${josa(String(a), '과/와')} ${b} 중에서 ${word} 수는 무엇일까요?`,
        say: `${sj(a, '과/와')} ${sn(b)} 중에서 ${word} 수는 무엇일까요?`,
        visual: { k: 'row', items: [{ k: 'big', text: String(a), tone: 'sky' }, { k: 'big', text: String(b), tone: 'tangerine' }], gap: 24 },
        answer: buildChoice(r, opt(ans), [opt(other)], 2, 2),
        hint: {
          say: '수를 차례대로 세면 먼저 나오는 수가 더 작아요.',
          visual: { k: 'stones', seq: range(Math.min(a, b), Math.max(a, b)) },
        },
        explain: `${dj(ans, '이/가')} ${word} 수예요.`,
      });
    }

    const three = distinctInts(r, cfg.lo, cfg.hi, 3);
    const askBig = chance(r, 0.5);
    const ans = askBig ? Math.max(...three) : Math.min(...three);
    const word = askBig ? '가장 큰' : '가장 작은';
    const opt = (n: number): Option => ({ key: String(n), text: String(n), say: sn(n) });
    return mk(c, {
      prompt: `${word} 수를 찾아 보세요.`,
      say: `${word} 수를 찾아 보세요.`,
      visual: { k: 'row', items: three.map((n) => ({ k: 'big', text: String(n), tone: 'grape' }) as Visual), gap: 16 },
      answer: buildChoice(r, opt(ans), three.filter((n) => n !== ans).map(opt), 3, 3),
      hint: { say: '수를 차례대로 줄 세워 보면 알 수 있어요.', visual: { k: 'stones', seq: range(Math.min(...three), Math.max(...three)) } },
      explain: `${dj(ans, '이/가')} ${word} 수예요.`,
    });
  };
}

// ---------------------------------------------------------------------------
// 가르기·모으기
// ---------------------------------------------------------------------------

export interface BondCfg {
  lo: number;
  hi: number;
  /** 주로 다룰 방향 */
  mode: 'split' | 'merge';
}

export function bondGen(cfg: BondCfg) {
  return (c: GenCtx): Question => {
    const r = c.rng;
    const L = c.level;
    const obj = pick(r, OBJECTS);
    const cn = obj.counter;
    const total = int(r, Math.max(2, cfg.lo), cfg.hi);
    const a = int(r, 1, total - 1);
    const b = total - a;
    const mode: 'split' | 'merge' = chance(r, 0.75) ? cfg.mode : cfg.mode === 'split' ? 'merge' : 'split';
    const groupsVis: Visual = { k: 'groups', a: { emoji: obj.emoji, n: a }, b: { emoji: obj.emoji, n: b }, op: '+' };
    const allVis: Visual = { k: 'objects', emoji: obj.emoji, n: total, numbered: true, layout: 'row' };

    if (mode === 'merge') {
      if (L === 1) {
        return mk(c, {
          prompt: `${obj.name} ${a}${cn}와 ${b}${cn}를 모으면 모두 몇 ${cn}일까요?`,
          say: `${obj.name} ${countKo(a, cn)}와 ${countKo(b, cn)}를 모으면 모두 몇 ${cn}일까요?`,
          visual: groupsVis,
          answer: numChoice(r, total, 1, cfg.hi + 1, { say: (n) => countKo(n, cn) }),
          hint: { say: '두 쪽을 합쳐서 하나씩 세어 봐요.', visual: allVis },
          explain: `${countKo(total, cn)}예요.`,
        });
      }
      if (L === 2 || chance(r, 0.4)) {
        return mk(c, {
          prompt: `${a}${josa(String(a), '과/와')} ${b}${josa(String(b), '을/를')} 모으면 몇이 될까요?`,
          say: `${sj(a, '과/와')} ${sj(b, '을/를')} 모으면 몇이 될까요?`,
          visual: { k: 'bond', total: null, a, b },
          answer: numChoice(r, total, 1, cfg.hi + 1, { say: (n) => sn(n) }),
          hint: { say: '두 수를 합쳐서 세어 봐요.', visual: groupsVis },
          explain: `${dj(a, '과/와')} ${dj(b, '을/를')} 모으면 ${dj(total, '이/가')} 돼요.`,
        });
      }
      const pairText = (x: number, y: number) => `${x}${josa(String(x), '과/와')} ${y}`;
      const pairSay = (x: number, y: number) => `${sj(x, '과/와')} ${sn(y)}`;
      const toPair = (x: number, y: number): Option => ({ key: `${x}-${y}`, text: pairText(x, y), say: pairSay(x, y) });
      const wrongs: Option[] = [];
      for (let x = 1; x <= total; x++) {
        for (const d of [-2, -1, 1, 2]) {
          const y = total - x + d;
          if (y >= 1 && y <= total) wrongs.push(toPair(x, y));
        }
      }
      return mk(c, {
        prompt: `모으면 ${dj(total, '이/가')} 되는 짝은 무엇일까요?`,
        say: `모으면 ${sj(total, '이/가')} 되는 짝은 무엇일까요?`,
        visual: { k: 'big', text: String(total), tone: 'sky' },
        answer: buildChoice(r, toPair(a, b), wrongs, 3),
        hint: { say: '두 수를 합쳐서 몇인지 확인해 봐요.' },
        explain: `${dj(a, '과/와')} ${dj(b, '을/를')} 모으면 ${dj(total, '이/가')} 돼요.`,
      });
    }

    // 가르기
    const unknownVis: Visual = { k: 'groups', a: { emoji: obj.emoji, n: a }, b: { emoji: obj.emoji, n: b, unknown: true }, op: '+' };
    if (L === 1) {
      return mk(c, {
        prompt: `${obj.name} ${total}${cn}를 ${a}${cn}와 몇 ${cn}로 가를 수 있을까요?`,
        say: `${obj.name} ${countKo(total, cn)}를 ${countKo(a, cn)}와 몇 ${cn}로 가를 수 있을까요?`,
        visual: { k: 'col', items: [{ k: 'objects', emoji: obj.emoji, n: total, layout: 'row' }, unknownVis], gap: 8 },
        answer: numChoice(r, b, 1, cfg.hi, { say: (n) => countKo(n, cn) }),
        hint: { say: `전체에서 ${countKo(a, cn)}를 빼고 남은 것을 세어 봐요.`, visual: allVis },
        explain: `${countKo(b, cn)}예요. ${countKo(a, cn)}와 ${countKo(b, cn)}를 합치면 ${countKo(total, cn)}가 돼요.`,
      });
    }
    if (L === 2 || (L === 3 && chance(r, 0.35))) {
      return mk(c, {
        prompt: `${dj(total, '은/는')} ${a}${josa(String(a), '과/와')} 몇으로 가를 수 있을까요?`,
        say: `${sj(total, '은/는')} ${sj(a, '과/와')} 몇으로 가를 수 있을까요?`,
        visual: { k: 'bond', total, a, b: null },
        answer: numChoice(r, b, 1, cfg.hi, { say: (n) => sn(n) }),
        hint: { say: '전체에서 한쪽을 빼면 다른 쪽이에요.', visual: unknownVis },
        explain: `${dj(total, '은/는')} ${dj(a, '과/와')} ${dj(b, '으로/로')} 가를 수 있어요.`,
      });
    }
    return mk(c, {
      prompt: `구슬 ${total}개를 왼쪽 병에 ${a}개 담아 보세요.`,
      say: `구슬 ${countKo(total, '개')}를 왼쪽 병에 ${countKo(a, '개')} 담아 보세요.`,
      answer: { t: 'split', total, left: a, emoji: '🔵' },
      hint: { say: '구슬을 눌러서 왼쪽 병으로 옮겨 봐요.' },
      explain: `왼쪽에 ${countKo(a, '개')}, 오른쪽에 ${countKo(b, '개')}가 남아요.`,
    });
  };
}
