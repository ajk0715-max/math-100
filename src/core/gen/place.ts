import { OBJECTS } from '../objects';
import { countKo, josa, nativeNum, sinoNum } from '../ko';
import { chance, distinctInts, int, pick, shuffle } from '../rng';
import type { GenCtx, Level, MatchPair, Option, Question, Visual } from '../types';
import { buildChoice, dj, mk, numChoice, range, shuffleDiff, sj, sn } from './util';

// ---------------------------------------------------------------------------
// 20·50·100까지의 수: 십 모형(묶음과 낱개), 읽기, 순서, 크기, 뛰어 세기
// ---------------------------------------------------------------------------

const tensOf = (n: number): number => Math.floor(n / 10);
const onesOf = (n: number): number => n % 10;

/** 십 모형 그림 */
export const tensVis = (n: number, extra: { caption?: boolean } = {}): Visual => ({ k: 'tens', tens: tensOf(n), ones: onesOf(n), ...extra });

/** 숫자 보기. 눌렀을 때는 한자어 수로 읽어 준다. */
export const numOpt = (n: number): Option => ({ key: String(n), text: String(n), say: sn(n) });

/** 묶음 수와 낱개 수를 맞바꾼 수(27 → 72). 바꿔도 같은 수이거나 범위를 넘으면 null */
export function swapDigits(n: number, max: number): number | null {
  if (n < 10 || onesOf(n) === 0) return null;
  const s = onesOf(n) * 10 + tensOf(n);
  return s !== n && s <= max ? s : null;
}

/** 고유어 수: 열다섯, 스물일곱. 아흔아홉까지 */
export const nat = (n: number): string => nativeNum(n);

const NATIVE_TENS_WORD = ['', '열', '스물', '서른', '마흔', '쉰', '예순', '일흔', '여든', '아흔'];
const SINO_TENS_WORD = ['', '십', '이십', '삼십', '사십', '오십', '육십', '칠십', '팔십', '구십', '백'];

/** 몇십을 읽는 두 가지 말 */
export const tensWord = (t: number): { sino: string; native: string } => ({
  sino: SINO_TENS_WORD[t] as string,
  native: t >= 10 ? '백' : (NATIVE_TENS_WORD[t] as string),
});

/** 같은 자리 수가 헷갈린 쌍을 설명한다 */
export const placeConfuse = (e: string, g: string): string | null => {
  const a = Number(e);
  const b = Number(g);
  if (!Number.isInteger(a) || !Number.isInteger(b) || a === b) return null;
  if (a >= 10 && b >= 10 && onesOf(a) * 10 + tensOf(a) === b) return '묶음과 낱개 헷갈림';
  if (Math.abs(a - b) === 10) return '10개 묶음 하나 차이로 틀림';
  if (Math.abs(a - b) === 1) return '수 하나 차이로 틀림';
  return null;
};

/** 정답 근처의 틀린 수 후보: ±1, ±2, ±10, 자리 바꾸기 */
function nearWrong(n: number, lo: number, hi: number, withSwap: boolean): number[] {
  const out: number[] = [];
  const add = (x: number | null) => {
    if (x !== null && x !== n && x >= lo && x <= hi && !out.includes(x)) out.push(x);
  };
  if (withSwap) add(swapDigits(n, hi));
  add(n + 1);
  add(n - 1);
  add(n + 10);
  add(n - 10);
  add(n + 2);
  add(n - 2);
  return out;
}

// ---------------------------------------------------------------------------
// 십 몇 (11~19)
// ---------------------------------------------------------------------------

export function teenGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  const k = int(r, 1, 9);
  const n = 10 + k;
  const obj = pick(r, OBJECTS);
  const cn = obj.counter;
  const hintFrame: Visual = { k: 'objects', emoji: obj.emoji, n, layout: 'frame20', numbered: false };
  const explain = `10개 한 묶음과 낱개 ${k}개를 합치면 ${n}${josa(String(n), '이에요/예요')}.`;

  if (L === 1) {
    if (chance(r, 0.5)) {
      const text = `${obj.name} 10${cn}가 한 줄을 채웠고, 다음 줄에 ${k}${cn}가 있어요. 모두 몇 ${cn}일까요?`;
      const say = `${obj.name} ${countKo(10, cn)}가 한 줄을 채웠고, 다음 줄에 ${countKo(k, cn)}가 있어요. 모두 몇 ${cn}일까요?`;
      return mk(c, {
        prompt: text,
        say,
        visual: { k: 'objects', emoji: obj.emoji, n, layout: 'frame20' },
        answer: numChoice(r, n, 11, 20, { say: (m) => countKo(m, cn) }),
        hint: { say: '한 줄이 10개예요. 10에서 이어서 낱개를 세어 봐요.', visual: { ...hintFrame, numbered: true } as Visual },
        explain,
      });
    }
    return mk(c, {
      prompt: `10개 묶음 1개와 낱개 ${k}개예요. 모두 몇 개일까요?`,
      say: `십 개 묶음 한 개와 낱개 ${countKo(k, '개')}예요. 모두 몇 개일까요?`,
      visual: { k: 'tens', tens: 1, ones: k },
      answer: buildChoice(r, numOpt(n), nearWrong(n, 11, 20, false).map(numOpt), 3),
      hint: { say: '묶음 하나가 10이에요. 10에서 낱개를 이어서 세어 봐요.', visual: hintFrame },
      explain,
    });
  }

  if (L === 2) {
    if (chance(r, 0.5)) {
      const q = `10과 ${k}${josa(String(k), '을/를')} 모으면 몇이 될까요?`;
      return mk(c, {
        prompt: q,
        say: `십과 ${sj(k, '을/를')} 모으면 몇이 될까요?`,
        visual: { k: 'bond', total: null, a: 10, b: k },
        answer: buildChoice(r, numOpt(n), nearWrong(n, 11, 19, false).map(numOpt), 3),
        hint: { say: '10 다음부터 낱개 수만큼 이어서 세어 봐요.', visual: { k: 'tens', tens: 1, ones: k } },
        explain,
      });
    }
    // 수 → 알맞은 십 모형
    const toOpt = (m: number): Option => ({ key: String(m), visual: tensVis(m), say: sn(m) });
    const wrongs = [n - 1, n + 1, n - 2, n + 2, n - 10].filter((m) => m >= 10 && m <= 19);
    return mk(c, {
      prompt: `${n}${josa(String(n), '을/를')} 나타낸 그림을 찾아 보세요.`,
      say: `${sj(n, '을/를')} 나타낸 그림을 찾아 보세요.`,
      visual: { k: 'big', text: String(n), tone: 'sky' },
      answer: buildChoice(r, toOpt(n), wrongs.map(toOpt), 3, 3),
      hint: { say: `10개 묶음은 하나이고, 낱개가 ${k}개인 그림이에요.` },
      explain,
    });
  }

  const roll = r();
  if (roll < 0.34) {
    const q = `${dj(n, '은/는')} 10개 묶음 1개와 낱개 몇 개일까요?`;
    return mk(c, {
      prompt: q,
      say: `${sj(n, '은/는')} 십 개 묶음 한 개와 낱개 몇 개일까요?`,
      visual: { k: 'eq', parts: ['10', '+', '?', '=', String(n)], tone: 'sky' },
      answer: { t: 'number', correct: k, maxDigits: 1 },
      hint: { say: `${n}에서 10을 빼면 낱개 수예요.`, visual: tensVis(n) },
      explain: `${n}${josa(String(n), '은/는')} 10과 ${k}${josa(String(k), '으로/로')} 이루어져 있어요.`,
    });
  }
  if (roll < 0.67) {
    const wrongNums = nearWrong(n, 11, 19, false);
    const opts: Option[] = [n, ...wrongNums].map((m) => ({ key: String(m), text: sinoNum(m), say: sinoNum(m) }));
    return mk(c, {
      prompt: `숫자 ${n}${josa(String(n), '을/를')} 바르게 읽은 것은 무엇일까요?`,
      say: `숫자 ${sj(n, '을/를')} 바르게 읽은 것은 무엇일까요?`,
      visual: { k: 'big', text: String(n), tone: 'grape' },
      answer: buildChoice(r, opts[0] as Option, opts.slice(1), 3),
      hint: { say: '십 다음에 낱개 수를 붙여 읽어요.', visual: tensVis(n) },
      explain: `${n}${josa(String(n), '은/는')} ${sinoNum(n)}라고 읽고, ${nat(n)}라고도 읽어요.`,
    });
  }
  const wrongs = nearWrong(n, 11, 19, false);
  return mk(c, {
    prompt: `'${nat(n)}'${josa(nat(n), '을/를')} 숫자로 쓰면 무엇일까요?`,
    say: `${nat(n)}${josa(nat(n), '을/를')} 숫자로 쓰면 무엇일까요?`,
    answer: buildChoice(r, numOpt(n), wrongs.map(numOpt), 3),
    hint: { say: '열은 10이에요. 열 다음에 이어지는 수를 더해 봐요.', visual: tensVis(n) },
    explain: `${nat(n)}${josa(nat(n), '은/는')} ${n}${josa(String(n), '이에요/예요')}.`,
  });
}

// ---------------------------------------------------------------------------
// 몇십 (10, 20, … 50 또는 100까지)
// ---------------------------------------------------------------------------

export function tensGen(cfg: { minTens: number; maxTens: number }) {
  return (c: GenCtx): Question => {
    const r = c.rng;
    const L = c.level;
    const t = int(r, cfg.minTens, cfg.maxTens);
    const n = t * 10;
    const w = tensWord(t);
    const toOpt = (m: number): Option => ({ key: String(m * 10), text: String(m * 10), say: sn(m * 10) });
    const wrongT = range(Math.max(1, cfg.minTens - 1), Math.min(10, cfg.maxTens + 1)).filter((x) => x !== t);
    const explain =
      t >= 10
        ? '10개 묶음이 10개면 100이에요. 100은 백이라고 읽어요.'
        : `10개 묶음이 ${t}개면 ${n}${josa(String(n), '이에요/예요')}. ${w.sino}, ${w.native}${josa(w.native, '이라고/라고')} 읽어요.`;

    if (L === 1) {
      return mk(c, {
        prompt: `10개 묶음이 ${t}개 있어요. 모두 몇 개일까요?`,
        say: `십 개 묶음이 ${countKo(t, '개')} 있어요. 모두 몇 개일까요?`,
        visual: { k: 'tens', tens: t, ones: 0 },
        answer: buildChoice(r, toOpt(t), wrongT.map(toOpt), 3),
        hint: { say: '10, 20, 30 … 묶음마다 10씩 늘어나요.', visual: { k: 'tens', tens: t, ones: 0, caption: true } },
        explain: `10개 묶음이 ${t}개면 ${n}개예요.`,
      });
    }
    if (L === 2) {
      const toCount = (m: number): Option => ({ key: String(m), text: `${m}묶음`, say: `${countKo(m, '묶음')}` });
      return mk(c, {
        prompt: `${dj(n, '은/는')} 10개 묶음 몇 개일까요?`,
        say: `${sj(n, '은/는')} 십 개 묶음 몇 개일까요?`,
        visual: { k: 'big', text: String(n), tone: 'sky' },
        answer: buildChoice(r, toCount(t), wrongT.map(toCount), 3),
        hint: { say: '10씩 묶음을 하나씩 늘려 가며 그 수가 될 때까지 세어 봐요.', visual: { k: 'tens', tens: t, ones: 0 } },
        explain: `${n}${josa(String(n), '은/는')} 10개 묶음 ${t}개예요.`,
      });
    }
    if (chance(r, 0.4)) {
      return mk(c, {
        prompt: `10개 묶음 ${t}개는 모두 몇 개일까요? 숫자를 눌러 알려 주세요.`,
        say: `십 개 묶음 ${countKo(t, '개')}는 모두 몇 개일까요? 숫자를 눌러 알려 주세요.`,
        answer: { t: 'number', correct: n, maxDigits: cfg.maxTens >= 10 ? 3 : 2 },
        hint: { say: '10씩 묶음 수만큼 뛰어 세어 봐요.', visual: { k: 'tens', tens: t, ones: 0 } },
        explain,
      });
    }
    if (t >= 10 || chance(r, 0.5)) {
      const opts: Option[] = [t, ...wrongT].map((m) => ({ key: String(m * 10), text: String(m * 10), say: sn(m * 10) }));
      return mk(c, {
        prompt: `'${w.sino}'${josa(w.sino, '을/를')} 숫자로 쓰면 무엇일까요?`,
        say: `${w.sino}${josa(w.sino, '을/를')} 숫자로 쓰면 무엇일까요?`,
        answer: buildChoice(r, opts[0] as Option, opts.slice(1), 3),
        hint: { say: '십이 몇 개인지 생각해 봐요.', visual: { k: 'tens', tens: t, ones: 0 } },
        explain: `${w.sino}${josa(w.sino, '은/는')} ${n}${josa(String(n), '이에요/예요')}.`,
      });
    }
    const opts: Option[] = [t, ...wrongT].map((m) => ({ key: String(m * 10), text: String(m * 10), say: sn(m * 10) }));
    return mk(c, {
      prompt: `'${w.native}'${josa(w.native, '을/를')} 숫자로 쓰면 무엇일까요?`,
      say: `${w.native}${josa(w.native, '을/를')} 숫자로 쓰면 무엇일까요?`,
      answer: buildChoice(r, opts[0] as Option, opts.slice(1), 3),
      hint: { say: '열, 스물, 서른, 마흔, 쉰 순서로 10씩 커져요.', visual: { k: 'tens', tens: t, ones: 0 } },
      explain: `${w.native}${josa(w.native, '은/는')} ${n}${josa(String(n), '이에요/예요')}.`,
    });
  };
}

// ---------------------------------------------------------------------------
// 몇십몇: 10개 묶음과 낱개
// ---------------------------------------------------------------------------

export interface TensOnesCfg {
  lo: number;
  hi: number;
  /** 1단계에서 쓰는 수의 최대 */
  l1hi: number;
}

export function tensOnesGen(cfg: TensOnesCfg) {
  return (c: GenCtx): Question => {
    const r = c.rng;
    const L = c.level;
    const top = L === 1 ? cfg.l1hi : cfg.hi;
    // 낱개가 0인 수(몇십)는 따로 연습하니 여기서는 가끔만 낸다
    let n = int(r, cfg.lo, top);
    for (let i = 0; i < 12 && (onesOf(n) === 0 || n < 11); i++) n = int(r, cfg.lo, top);
    if (onesOf(n) === 0) n += 1;
    const t = tensOf(n);
    const o = onesOf(n);
    const explain = `10개 묶음 ${t}개는 ${t * 10}, 낱개 ${o}개를 더해서 ${n}${josa(String(n), '이에요/예요')}.`;
    const wrongNums = nearWrong(n, 11, Math.min(100, cfg.hi + 10), true);
    const sayPair = `십 개 묶음 ${countKo(t, '개')}와 낱개 ${o === 0 ? '영 개' : countKo(o, '개')}`;

    if (L === 1) {
      return mk(c, {
        prompt: `10개 묶음 ${t}개와 낱개 ${o}개예요. 모두 몇 개일까요?`,
        say: `${sayPair}예요. 모두 몇 개일까요?`,
        visual: { k: 'tens', tens: t, ones: o },
        answer: buildChoice(r, numOpt(n), wrongNums.map(numOpt), 3),
        hint: { say: '묶음은 10씩 세고, 낱개는 하나씩 이어서 세어 봐요.', visual: { k: 'tens', tens: t, ones: o, caption: true } },
        explain,
      });
    }

    if (L === 2) {
      if (chance(r, 0.55)) {
        const toOpt = (m: number): Option => ({ key: String(m), visual: tensVis(m), say: sn(m) });
        const near = nearWrong(n, 11, cfg.hi, true).filter((m) => m <= 99);
        return mk(c, {
          prompt: `${n}${josa(String(n), '을/를')} 나타낸 그림을 찾아 보세요.`,
          say: `${sj(n, '을/를')} 나타낸 그림을 찾아 보세요.`,
          visual: { k: 'big', text: String(n), tone: 'sky' },
          answer: buildChoice(r, toOpt(n), near.map(toOpt), 3, 3),
          hint: { say: `10개 묶음이 ${t}개이고 낱개가 ${o}개인 그림이에요.` },
          explain,
        });
      }
      return mk(c, {
        prompt: `10개 묶음 ${t}개와 낱개 ${o}개는 모두 몇 개일까요?`,
        say: `${sayPair}는 모두 몇 개일까요?`,
        answer: buildChoice(r, numOpt(n), wrongNums.map(numOpt), 3),
        hint: { say: '묶음은 10씩 세고, 낱개를 이어서 세어 봐요.', visual: tensVis(n, { caption: true }) },
        explain,
      });
    }

    const roll = r();
    if (roll < 0.34) {
      return mk(c, {
        prompt: `10개 묶음 ${t}개와 낱개 ${o}개는 얼마일까요? 숫자를 눌러 알려 주세요.`,
        say: `${sayPair}는 얼마일까요? 숫자를 눌러 알려 주세요.`,
        answer: { t: 'number', correct: n, maxDigits: n >= 100 ? 3 : 2 },
        hint: { say: '묶음 수를 먼저 말하고, 낱개 수를 뒤에 붙여요.', visual: tensVis(n, { caption: true }) },
        explain,
      });
    }
    if (roll < 0.67) {
      const toPair = (a: number, b: number): Option => ({ key: `${a}-${b}`, text: `묶음 ${a}개, 낱개 ${b}개`, say: `묶음 ${countKo(a, '개')}, 낱개 ${b === 0 ? '영 개' : countKo(b, '개')}` });
      const wrongPairs: Option[] = [];
      if (o !== t && o >= 1) wrongPairs.push(toPair(o, t));
      if (t > 1) wrongPairs.push(toPair(t - 1, o));
      if (t < 9) wrongPairs.push(toPair(t + 1, o));
      if (o < 9) wrongPairs.push(toPair(t, o + 1));
      if (o > 0) wrongPairs.push(toPair(t, o - 1));
      return mk(c, {
        prompt: `${dj(n, '은/는')} 10개 묶음 몇 개와 낱개 몇 개일까요?`,
        say: `${sj(n, '은/는')} 십 개 묶음 몇 개와 낱개 몇 개일까요?`,
        visual: { k: 'big', text: String(n), tone: 'grape' },
        answer: buildChoice(r, toPair(t, o), wrongPairs, 3),
        hint: { say: '앞의 수가 묶음 수이고, 뒤의 수가 낱개 수예요.', visual: tensVis(n) },
        explain: `${n}${josa(String(n), '은/는')} 묶음 ${t}개와 낱개 ${o}개예요.`,
      });
    }
    const other = swapDigits(n, 99);
    const wr = nearWrong(n, 11, cfg.hi, true);
    return mk(c, {
      prompt: `낱개가 ${o}개이고 10개 묶음이 ${t}개인 수는 얼마일까요?`,
      say: `낱개가 ${countKo(o, '개')}이고 십 개 묶음이 ${countKo(t, '개')}인 수는 얼마일까요?`,
      answer: buildChoice(r, numOpt(n), (other !== null ? [other, ...wr] : wr).map(numOpt), 3),
      hint: { say: '10개 묶음 수를 먼저 쓰고, 낱개 수를 뒤에 써요.', visual: tensVis(n, { caption: true }) },
      explain,
    });
  };
}

// ---------------------------------------------------------------------------
// 수 읽기와 쓰기 (몇십몇)
// ---------------------------------------------------------------------------

export function readNumGen(cfg: { lo: number; hi: number }) {
  return (c: GenCtx): Question => {
    const r = c.rng;
    const L = c.level;
    const top = Math.min(99, cfg.hi);
    const n = int(r, Math.max(11, cfg.lo), top);
    const w = sinoNum(n);
    const near = nearWrong(n, 11, top, true);

    if (L === 1) {
      const opts: Option[] = [n, ...near].map((m) => ({ key: String(m), text: sinoNum(m), say: sinoNum(m) }));
      return mk(c, {
        prompt: `숫자 ${n}${josa(String(n), '을/를')} 바르게 읽은 것은 무엇일까요?`,
        say: `숫자 ${sj(n, '을/를')} 바르게 읽은 것은 무엇일까요?`,
        visual: { k: 'big', text: String(n), tone: 'grape' },
        answer: buildChoice(r, opts[0] as Option, opts.slice(1), 3),
        hint: { say: '앞에 있는 숫자가 십이 몇 개인지를 말해 주고, 뒤의 숫자를 이어서 읽어요.', visual: tensVis(n, { caption: true }) },
        explain: `${n}${josa(String(n), '은/는')} ${w}${josa(w, '이라고/라고')} 읽어요.`,
      });
    }
    if (L === 2) {
      return mk(c, {
        prompt: `'${w}'${josa(w, '을/를')} 숫자로 쓰면 무엇일까요?`,
        say: `${w}${josa(w, '을/를')} 숫자로 쓰면 무엇일까요?`,
        answer: buildChoice(r, numOpt(n), near.map(numOpt), 3),
        hint: { say: '십 앞의 말이 묶음 수, 십 뒤의 말이 낱개 수예요.', visual: tensVis(n, { caption: true }) },
        explain: `${w}${josa(w, '은/는')} ${n}${josa(String(n), '이에요/예요')}.`,
      });
    }
    if (chance(r, 0.5)) {
      // 고유어로 읽는 말(스물일곱, 서른둘)
      return mk(c, {
        prompt: `'${nat(n)}'${josa(nat(n), '을/를')} 숫자로 쓰면 무엇일까요?`,
        say: `${nat(n)}${josa(nat(n), '을/를')} 숫자로 쓰면 무엇일까요?`,
        answer: buildChoice(r, numOpt(n), near.map(numOpt), 3),
        hint: { say: '열, 스물, 서른, 마흔, 쉰은 10씩 커지는 말이에요.', visual: tensVis(n, { caption: true }) },
        explain: `${nat(n)}${josa(nat(n), '은/는')} ${n}${josa(String(n), '이에요/예요')}.`,
      });
    }
    // 숫자와 읽는 말 짝 맞추기
    const picks = distinctInts(r, Math.max(11, cfg.lo), top, 3).filter((m) => m % 10 !== 0 || top <= 20);
    const nums = picks.length >= 3 ? picks : [n, ...distinctInts(r, Math.max(11, cfg.lo), top, 2, [n])];
    const pairs: MatchPair[] = nums.slice(0, 3).map((m) => ({ key: String(m), a: { text: String(m) }, b: { text: sinoNum(m) } }));
    return mk(c, {
      prompt: '숫자와 읽는 말을 짝지어 보세요.',
      say: '숫자와 읽는 말을 짝지어 보세요.',
      answer: { t: 'match', pairs },
      hint: { say: '십의 앞 말이 묶음 수예요. 하나씩 읽어 보며 맞춰 봐요.' },
      explain: pairs.map((p) => `${p.a.text}${josa(p.a.text as string, '은/는')} ${p.b.text}`).join(', ') + '이에요.',
    });
  };
}

// ---------------------------------------------------------------------------
// 순서: 앞뒤·사이 수와 빈칸 채우기, 수 배열표
// ---------------------------------------------------------------------------

/** 10 단위 경계(19→20, 29→30 …)를 자주 포함하는 수 고르기 */
function pickBiased(r: () => number, lo: number, hi: number, edge: number): number {
  if (hi - lo >= 4 && chance(r, 0.4)) {
    const edges: number[] = [];
    for (let m = lo; m <= hi; m++) if (m % 10 === edge) edges.push(m);
    if (edges.length) return pick(r, edges);
  }
  return int(r, lo, hi);
}

/** x가 들어 있는 줄과 위아래 줄(최대 3줄)만 보여 주는 수 배열표 범위. 50까지는 전체를 보여 준다. */
export function chartWindow(x: number, hi: number): { from: number; to: number } {
  if (hi <= 50) return { from: 1, to: hi <= 20 ? 20 : 50 };
  const row = Math.floor((x - 1) / 10);
  const startRow = Math.max(0, Math.min(row - 1, 7));
  return { from: startRow * 10 + 1, to: startRow * 10 + 30 };
}

export function orderBigGen(cfg: { lo: number; hi: number }) {
  return (c: GenCtx): Question => {
    const r = c.rng;
    const L = c.level;
    const chartVis = (x: number): Visual => {
      const w = chartWindow(x, cfg.hi);
      return { k: 'chart', from: w.from, to: w.to, cols: 10, blanks: [x], tone: 'sky' };
    };
    const hintChart = (x: number): Visual => {
      const w = chartWindow(x, cfg.hi);
      return { k: 'chart', from: w.from, to: w.to, cols: 10, marks: [x - 1, x + 1].filter((m) => m >= w.from && m <= w.to), tone: 'sky' };
    };

    if (L === 3) {
      const kind = pick(r, ['before', 'after', 'between', 'chart'] as const);
      if (kind === 'chart') {
        const x = int(r, Math.max(cfg.lo, 12), cfg.hi);
        return mk(c, {
          prompt: '수 배열표에서 ?에 알맞은 수는 무엇일까요?',
          say: '수 배열표에서 물음표에 알맞은 수는 무엇일까요?',
          visual: chartVis(x),
          answer: numChoice(r, x, cfg.lo, cfg.hi, { say: sn, spread: 3 }),
          hint: { say: '왼쪽 칸은 1 작은 수, 오른쪽 칸은 1 큰 수예요. 아래 칸은 10 큰 수예요.', visual: hintChart(x) },
          explain: `?에는 ${x}${josa(String(x), '이/가')} 들어가요. 1부터 차례대로 세면 알 수 있어요.`,
        });
      }
      let ans: number;
      let visual: Visual;
      let prompt: string;
      let sayP: string;
      if (kind === 'before') {
        const x = pickBiased(r, cfg.lo + 1, cfg.hi, 0);
        ans = x - 1;
        visual = { k: 'stones', seq: [null, x] };
        prompt = `${x} 바로 앞의 수는 무엇일까요?`;
        sayP = `${sn(x)} 바로 앞의 수는 무엇일까요?`;
      } else if (kind === 'between') {
        const x = pickBiased(r, cfg.lo, cfg.hi - 2, 9);
        ans = x + 1;
        visual = { k: 'stones', seq: [x, null, x + 2] };
        prompt = `${x}${josa(String(x), '과/와')} ${x + 2} 사이의 수는 무엇일까요?`;
        sayP = `${sj(x, '과/와')} ${sn(x + 2)} 사이의 수는 무엇일까요?`;
      } else {
        const x = pickBiased(r, cfg.lo, cfg.hi - 1, 9);
        ans = x + 1;
        visual = { k: 'stones', seq: [x, null] };
        prompt = `${x} 바로 뒤의 수는 무엇일까요?`;
        sayP = `${sn(x)} 바로 뒤의 수는 무엇일까요?`;
      }
      const wrongs = nearWrong(ans, cfg.lo, cfg.hi, false).slice(0, 4);
      return mk(c, {
        prompt,
        say: sayP,
        visual,
        answer: buildChoice(r, numOpt(ans), wrongs.map(numOpt), 3),
        hint: { say: '차례대로 세어 보면 알 수 있어요.', visual: { k: 'stones', seq: range(Math.max(cfg.lo, ans - 2), Math.min(cfg.hi, ans + 2)) } },
        explain: `정답은 ${ans}${josa(String(ans), '이에요/예요')}. 차례대로 세면 ${ans}${josa(String(ans), '이/가')} 와요.`,
      });
    }

    if (L === 2 && chance(r, 0.3)) {
      const x = int(r, Math.max(cfg.lo, 12), cfg.hi);
      return mk(c, {
        prompt: '수 배열표에서 ?에 알맞은 수는 무엇일까요?',
        say: '수 배열표에서 물음표에 알맞은 수는 무엇일까요?',
        visual: chartVis(x),
        answer: numChoice(r, x, cfg.lo, cfg.hi, { say: sn, spread: 3 }),
        hint: { say: '왼쪽 칸은 1 작은 수, 오른쪽 칸은 1 큰 수예요.', visual: hintChart(x) },
        explain: `?에는 ${x}${josa(String(x), '이/가')} 들어가요.`,
      });
    }

    const len = L === 1 ? 5 : 7;
    const startMax = cfg.hi - len + 1;
    const start = chance(r, 0.45) ? Math.max(cfg.lo, Math.min(startMax, pickBiased(r, cfg.lo, startMax, 7))) : int(r, cfg.lo, startMax);
    const full = range(start, start + len - 1);
    let idxs: number[];
    if (L === 1) idxs = [int(r, 1, len - 2)];
    else {
      const first = int(r, 1, 2);
      const second = int(r, first + 2, len - 1);
      idxs = [first, second];
    }
    const seq: (number | null)[] = full.map((v, i) => (idxs.includes(i) ? null : v));
    const answers = idxs.map((i) => full[i] as number);
    const extras = distinctInts(r, cfg.lo, cfg.hi, L === 1 ? 2 : 1, full);
    return mk(c, {
      prompt: '빈 돌에 알맞은 수를 놓아 보세요.',
      say: '빈 돌에 알맞은 수를 놓아 보세요.',
      answer: { t: 'gaps', seq, tokens: shuffle(r, [...answers, ...extras]), answers },
      hint: { say: '왼쪽에서부터 차례대로 세어 봐요.', visual: { k: 'stones', seq: full } },
      explain: `${full.join(', ')} 순서예요.`,
    });
  };
}

// ---------------------------------------------------------------------------
// 크기 비교 (몇십몇)
// ---------------------------------------------------------------------------

export function compareBigGen(cfg: { lo: number; hi: number }) {
  return (c: GenCtx): Question => {
    const r = c.rng;
    const L = c.level;
    const word = (big: boolean) => (big ? '더 큰' : '더 작은');
    const draw = (): [number, number] => {
      const wantSame = L >= 2 && cfg.hi > 20 && chance(r, 0.5);
      for (let i = 0; i < 80; i++) {
        const a = int(r, cfg.lo, cfg.hi);
        const b = int(r, cfg.lo, cfg.hi);
        if (a === b) continue;
        if (L === 1 && Math.abs(a - b) < 4) continue;
        if (wantSame && tensOf(a) !== tensOf(b)) continue;
        if (!wantSame && L === 2 && cfg.hi > 20 && tensOf(a) === tensOf(b)) continue;
        return [a, b];
      }
      const [x, y] = distinctInts(r, cfg.lo, cfg.hi, 2) as [number, number];
      return [x, y];
    };

    if (L === 1) {
      const [a, b] = draw();
      const askBig = chance(r, 0.6);
      const target = askBig ? (a > b ? 'L' : 'R') : a < b ? 'L' : 'R';
      const mkItem = (key: string, n: number) => ({ key, visual: tensVis(n), say: sn(n) });
      return mk(c, {
        prompt: `${word(askBig)} 수를 나타낸 쪽을 눌러 보세요.`,
        say: `${word(askBig)} 수를 나타낸 쪽을 눌러 보세요.`,
        answer: { t: 'tapTargets', items: [mkItem('L', a), mkItem('R', b)], targets: [target], cols: 2, need: 'one' },
        hint: { say: '10개 묶음이 많은 쪽이 더 커요. 묶음 수가 같으면 낱개를 비교해요.' },
        explain: `${a}${josa(String(a), '과/와')} ${b} 중에서 ${word(askBig)} 수는 ${askBig ? Math.max(a, b) : Math.min(a, b)}${josa(String(askBig ? Math.max(a, b) : Math.min(a, b)), '이에요/예요')}.`,
      });
    }

    if (L === 2) {
      const [a, b] = draw();
      const askBig = chance(r, 0.55);
      const ans = askBig ? Math.max(a, b) : Math.min(a, b);
      const other = a + b - ans;
      return mk(c, {
        prompt: `${a}${josa(String(a), '과/와')} ${b} 중에서 ${word(askBig)} 수는 무엇일까요?`,
        say: `${sj(a, '과/와')} ${sn(b)} 중에서 ${word(askBig)} 수는 무엇일까요?`,
        visual: { k: 'row', items: [{ k: 'big', text: String(a), tone: 'sky' }, { k: 'big', text: String(b), tone: 'tangerine' }], gap: 24 },
        answer: buildChoice(r, numOpt(ans), [numOpt(other)], 2, 2),
        hint: { say: '10개 묶음이 많은 쪽이 커요. 묶음 수가 같으면 낱개를 비교해요.', visual: { k: 'row', items: [tensVis(a), tensVis(b)], gap: 14 } },
        explain: `${dj(ans, '이/가')} ${word(askBig)} 수예요.`,
      });
    }

    const roll = r();
    if (roll < 0.5) {
      const three = distinctInts(r, cfg.lo, cfg.hi, 3);
      const askBig = chance(r, 0.5);
      const ans = askBig ? Math.max(...three) : Math.min(...three);
      const w = askBig ? '가장 큰' : '가장 작은';
      return mk(c, {
        prompt: `${w} 수를 찾아 보세요.`,
        say: `${w} 수를 찾아 보세요.`,
        visual: { k: 'row', items: three.map((n) => ({ k: 'big', text: String(n), tone: 'grape' }) as Visual), gap: 14 },
        answer: buildChoice(r, numOpt(ans), three.filter((n) => n !== ans).map(numOpt), 3, 3),
        hint: { say: '수를 작은 것부터 줄 세워 보면 알 수 있어요.', visual: { k: 'row', items: three.map((n) => tensVis(n)), gap: 10, wrap: true } },
        explain: `${dj(ans, '이/가')} ${w} 수예요.`,
      });
    }
    const [a, b] = draw();
    const bigger = a > b;
    const opts: Option[] = [
      { key: 'big', text: '크다', say: '크다' },
      { key: 'small', text: '작다', say: '작다' },
    ];
    return mk(c, {
      prompt: `${a}${josa(String(a), '은/는')} ${b}보다 큰 수일까요, 작은 수일까요?`,
      say: `${sj(a, '은/는')} ${sn(b)}보다 큰 수일까요, 작은 수일까요?`,
      visual: { k: 'row', items: [{ k: 'big', text: String(a), tone: 'sky' }, { k: 'big', text: String(b), tone: 'tangerine' }], gap: 24 },
      answer: buildChoice(r, opts[bigger ? 0 : 1] as Option, [opts[bigger ? 1 : 0] as Option], 2, 2),
      hint: { say: '10개 묶음이 많은 쪽이 커요. 묶음 수가 같으면 낱개를 비교해요.', visual: { k: 'row', items: [tensVis(a), tensVis(b)], gap: 14 } },
      explain: `${a}${josa(String(a), '은/는')} ${b}보다 ${bigger ? '커요' : '작아요'}.`,
    });
  };
}

// ---------------------------------------------------------------------------
// 뛰어 세기
// ---------------------------------------------------------------------------

export interface SkipCfg {
  steps: number[];
  hi: number;
}

/** 걸음 크기에 맞는 시작 수 후보 */
function skipStart(r: () => number, step: number, len: number, hi: number): number {
  const maxStart = hi - step * (len - 1);
  const aligned: number[] = [];
  const offset: number[] = [];
  for (let s = 1; s <= maxStart; s++) {
    if (s % step === 0) aligned.push(s);
    else if ((step === 10 && s % 10 === 5) || (step === 2 && s % 2 === 1 && s <= 5)) offset.push(s);
  }
  if (offset.length && aligned.length && chance(r, 0.25)) return pick(r, offset);
  if (aligned.length) return pick(r, aligned.slice(0, Math.max(1, Math.min(aligned.length, 3))));
  return Math.max(1, maxStart);
}

export function skipGen(cfg: SkipCfg) {
  return (c: GenCtx): Question => {
    const r = c.rng;
    const L = c.level;
    const step = pick(r, cfg.steps);
    const wanted = L === 1 ? 5 : 6;
    const len = Math.max(4, Math.min(wanted, Math.floor((cfg.hi - 1) / step) + 1));
    const start = skipStart(r, step, len, cfg.hi);
    const full = Array.from({ length: len }, (_, i) => start + step * i);
    const stepSay = `${step}씩`;
    const hintVis: Visual = { k: 'stones', seq: full };
    const explain = `${step}씩 뛰어 세면 ${full.join(', ')} 순서예요.`;

    if (L === 1) {
      const idx = len - 1 - int(r, 0, 1);
      const seq: (number | null)[] = full.map((v, i) => (i === idx ? null : v));
      const ans = full[idx] as number;
      const wrongs = [ans + 1, ans - 1, ans + step, ans - step, ans + 2, ans - 2].filter((m) => m > 0 && m !== ans && !full.includes(m));
      return mk(c, {
        prompt: `${stepSay} 뛰어 세어요. 빈칸에 알맞은 수는 무엇일까요?`,
        say: `${stepSay} 뛰어 세어요. 빈칸에 알맞은 수는 무엇일까요?`,
        visual: { k: 'stones', seq },
        answer: buildChoice(r, numOpt(ans), wrongs.map(numOpt), 3),
        hint: { say: `앞의 수에 ${step}${josa(String(step), '을/를')} 더하면 다음 수가 돼요.`, visual: hintVis },
        explain,
      });
    }

    if (L === 2) {
      const first = int(r, 1, 2);
      const second = int(r, first + 2, len - 1);
      const idxs = [first, second];
      const seq: (number | null)[] = full.map((v, i) => (idxs.includes(i) ? null : v));
      const answers = idxs.map((i) => full[i] as number);
      const extra = [answers[0]! + 1, answers[1]! - 1, answers[1]! + 1].find((m) => m > 0 && !full.includes(m));
      return mk(c, {
        prompt: `${stepSay} 뛰어 세어서 빈 돌에 알맞은 수를 놓아 보세요.`,
        say: `${stepSay} 뛰어 세어서 빈 돌에 알맞은 수를 놓아 보세요.`,
        answer: { t: 'gaps', seq, tokens: shuffle(r, extra === undefined ? answers : [...answers, extra]), answers },
        hint: { say: `앞의 수에 ${step}씩 더해 가며 채워 봐요.`, visual: hintVis },
        explain,
      });
    }

    const shown = full.slice(0, 4);
    if (chance(r, 0.5)) {
      // 보기는 아이가 실제로 배우는 걸음(2·5·10)과 헷갈리기 쉬운 걸음만 쓴다
      const stepOpts = [...new Set([step, ...cfg.steps, ...[2, 5, 10].filter((st) => st !== step)])].filter((st) => st >= 1);
      const opts: Option[] = stepOpts.map((st) => ({ key: String(st), text: `${st}씩`, say: `${st}씩` }));
      return mk(c, {
        prompt: `${shown.join(', ')} … 몇씩 뛰어 센 것일까요?`,
        say: `${shown.map((m) => sn(m)).join(', ')}, 몇씩 뛰어 센 것일까요?`,
        visual: { k: 'stones', seq: [...shown, null] },
        answer: buildChoice(r, opts.find((o) => o.key === String(step)) as Option, opts.filter((o) => o.key !== String(step)), 3),
        hint: { say: '이웃한 두 수의 차이를 살펴봐요.', visual: { k: 'stones', seq: shown } },
        explain: `이웃한 수가 ${step}씩 커지니까 ${stepSay} 뛰어 센 거예요.`,
      });
    }
    const ans = full[4] ?? shown[3]! + step;
    const wrongs = [ans + 1, ans - 1, ans + step, ans - step].filter((m) => m > 0 && m !== ans && !shown.includes(m));
    return mk(c, {
      prompt: '규칙에 따라 뛰어 셀 때 ?에 알맞은 수는 무엇일까요?',
      say: '규칙에 따라 뛰어 셀 때 물음표에 알맞은 수는 무엇일까요?',
      visual: { k: 'stones', seq: [...shown, null] },
      answer: buildChoice(r, numOpt(ans), wrongs.map(numOpt), 3),
      hint: { say: '이웃한 두 수의 차이만큼 더해 봐요.', visual: { k: 'stones', seq: shown } },
      explain,
    });
  };
}

// 다른 파일에서 쓰는 도우미
export { dj, shuffleDiff };
export type { Level };
