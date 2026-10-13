import { chance, int, pick, sample, shuffle } from '../rng';
import { josa, timeKo, timeText, withJosa } from '../ko';
import type { GenCtx, Level, MatchPair, Option, Question, TapItem, Visual } from '../types';
import { clockPick, clockVis, hourOption, nearHours, nearTimes, timeOption, wrap12 } from './clock';
import { buildChoice, mk, range } from './util';

// ---------------------------------------------------------------------------
// 디지털 시계 읽기, 아날로그·디지털 짝 맞추기
// ---------------------------------------------------------------------------

export const digVis = (h: number, m: number): Visual => ({ k: 'digital', h: wrap12(h), m });

/** 디지털 시계 그림 보기. 키는 "시:분" */
export const digitalPick = (h: number, m: number): Option => ({ key: `${wrap12(h)}:${m}`, visual: digVis(h, m), say: timeKo(h, m) });

const DIGITAL_RULE = '점 두 개 앞의 숫자가 시이고, 뒤의 숫자가 분이에요.';

const digitalItems = (r: GenCtx['rng'], n: number, mins: number[]): { items: TapItem[]; mins: number[] } => {
  const hours = sample(r, range(1, 12), n);
  const items = hours.map((hh, i) => ({ key: `c${i}`, visual: digVis(hh, mins[i] as number), say: timeKo(hh, mins[i] as number) }));
  return { items, mins };
};

/** 디지털 시계 읽기: 정각 */
export function digitalHourGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  const h = int(r, 1, 12);
  const tt = timeText(h, 0);
  const hint = { say: `${DIGITAL_RULE} 분이 00이면 몇 시 정각이에요.`, visual: clockVis(h, 0, { size: 'md', mark: 'hour' }) };
  const explain = `앞의 숫자가 ${h}, 뒤의 숫자가 00이니까 ${tt} 정각이에요.`;

  if (L === 1) {
    const text = '디지털 시계가 나타내는 시각은 몇 시일까요?';
    return mk(c, {
      prompt: text,
      say: text,
      visual: digVis(h, 0),
      answer: buildChoice(r, hourOption(h), nearHours(h).map(hourOption), 3),
      hint,
      explain,
    });
  }
  if (L === 2) {
    const others = shuffle(r, [wrap12(h + 1), wrap12(h - 1), wrap12(h + 2)]).map((x) => digitalPick(x, 0));
    const wrongs = chance(r, 0.7) ? [digitalPick(h, 30), others[0] as Option] : [others[0] as Option, others[1] as Option];
    const text = `${tt}${josa(tt, '을/를')} 나타내는 디지털 시계는 어느 것일까요?`;
    return mk(c, {
      prompt: text,
      say: text,
      answer: buildChoice(r, digitalPick(h, 0), wrongs, 3, 3),
      hint,
      explain,
    });
  }
  const nHit = int(r, 1, 3);
  const mins = shuffle(r, [...Array.from({ length: nHit }, () => 0), ...Array.from({ length: 4 - nHit }, () => 30)]);
  const { items } = digitalItems(r, 4, mins);
  const targets = items.filter((_, i) => mins[i] === 0).map((it) => it.key);
  return mk(c, {
    prompt: '정각인 디지털 시계를 모두 찾아 눌러 보세요.',
    say: '정각인 디지털 시계를 모두 찾아 눌러 보세요.',
    answer: { t: 'tapTargets', items, targets, cols: 2, need: 'all' },
    hint: { say: '점 두 개 뒤의 숫자가 00이면 정각이에요. 30이면 30분이에요.' },
    explain: '점 두 개 뒤가 00인 디지털 시계가 정각이에요.',
  });
}

/** 디지털 시계 읽기: 몇 시 30분 */
export function digitalHalfGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  const h = int(r, 1, 12);
  const m = L === 1 ? 30 : chance(r, 0.4) ? 0 : 30;
  const tt = timeText(h, m);
  const hint = {
    say: m === 30 ? `${DIGITAL_RULE} 뒤의 숫자가 30이면 몇 시 30분이에요.` : `${DIGITAL_RULE} 뒤의 숫자가 00이면 몇 시 정각이에요.`,
    visual: clockVis(h, m, { size: 'md', mark: 'hour' }),
  };
  const explain = m === 30 ? `앞의 숫자가 ${h}, 뒤의 숫자가 30이니까 ${tt}${josa(tt, '이에요/예요')}.` : `앞의 숫자가 ${h}, 뒤의 숫자가 00이니까 ${tt} 정각이에요.`;

  if (L <= 2) {
    const text = '디지털 시계가 나타내는 시각은 무엇일까요?';
    return mk(c, {
      prompt: text,
      say: text,
      visual: digVis(h, m),
      answer: buildChoice(r, timeOption(h, m), nearTimes(h, m).map(([hh, mm]) => timeOption(hh, mm)), 3),
      hint,
      explain,
    });
  }
  if (chance(r, 0.5)) {
    const text = `${tt}${josa(tt, '을/를')} 나타내는 디지털 시계는 어느 것일까요?`;
    return mk(c, {
      prompt: text,
      say: text,
      answer: buildChoice(r, digitalPick(h, m), nearTimes(h, m).map(([hh, mm]) => digitalPick(hh, mm)), 3, 3),
      hint,
      explain: `${tt}${josa(tt, '은/는')} 앞의 숫자가 ${h}이고 뒤의 숫자가 ${m === 0 ? '00' : '30'}인 시계예요.`,
    });
  }
  const n = int(r, 4, 6);
  const nHit = int(r, 2, 3);
  const mins = shuffle(r, [...Array.from({ length: nHit }, () => 30), ...Array.from({ length: n - nHit }, () => 0)]);
  const { items } = digitalItems(r, n, mins);
  const targets = items.filter((_, i) => mins[i] === 30).map((it) => it.key);
  return mk(c, {
    prompt: '30분인 디지털 시계를 모두 찾아 눌러 보세요.',
    say: '삼십 분인 디지털 시계를 모두 찾아 눌러 보세요.',
    answer: { t: 'tapTargets', items, targets, cols: 3, need: 'all' },
    hint: { say: '점 두 개 뒤의 숫자가 30이면 30분이에요.' },
    explain: '점 두 개 뒤가 30인 디지털 시계가 30분이에요.',
  });
}

/** 아날로그 → 디지털, 디지털 → 아날로그 고르기 */
export function digitalPickGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  const h = int(r, 1, 12);
  const m = L === 1 ? 0 : L === 2 ? (chance(r, 0.5) ? 30 : 0) : chance(r, 0.65) ? 30 : 0;
  const tt = timeText(h, m);
  const hint = {
    say: m === 30 ? '긴바늘이 6에 있으면 30분이에요. 짧은바늘이 지나간 숫자가 시예요.' : '긴바늘이 12에 있으면 정각이에요. 짧은바늘이 가리키는 숫자가 시예요.',
    visual: clockVis(h, m, { size: 'md', mark: 'hour' }),
  };
  const explain = `${tt}${josa(tt, '은/는')} 디지털 시계로 ${h}:${m === 0 ? '00' : '30'}이라고 써요.`;
  const near = nearTimes(h, m);

  const analogToDigital = L === 1 ? true : L === 2 ? false : chance(r, 0.5);
  if (analogToDigital) {
    const text = '시계와 같은 시각을 나타내는 디지털 시계는 어느 것일까요?';
    return mk(c, {
      prompt: text,
      say: text,
      visual: clockVis(h, m, { size: 'lg' }),
      answer: buildChoice(r, digitalPick(h, m), near.map(([hh, mm]) => digitalPick(hh, mm)), 3, 3),
      hint,
      explain,
    });
  }
  const text = '디지털 시계와 같은 시각을 나타내는 시계는 어느 것일까요?';
  return mk(c, {
    prompt: text,
    say: text,
    visual: digVis(h, m),
    answer: buildChoice(r, clockPick(h, m), near.map(([hh, mm]) => clockPick(hh, mm)), 3, 3),
    hint: { say: `${DIGITAL_RULE} 숫자를 읽고 같은 시각의 시계를 찾아요.`, visual: clockVis(h, m, { size: 'md', mark: 'hour' }) },
    explain,
  });
}

/** 아날로그 시계와 디지털 시계 이어 주기 */
export function clockDigitalMatchGen(cfg: { hours: number[]; half?: number; halfFrom?: Level }) {
  const halfP = cfg.half ?? 0.4;
  return (c: GenCtx): Question => {
    const r = c.rng;
    const L = c.level;
    const want = L === 1 ? 3 : L === 2 ? 4 : 5;
    const hours = sample(r, cfg.hours, Math.min(want, cfg.hours.length));
    const from = cfg.halfFrom ?? 2;
    const mins = hours.map(() => (L >= from && chance(r, halfP) ? 30 : 0));
    // 30분이 하나도 없으면 한 개는 30분으로 바꿔서 정각과 30분을 함께 연습한다
    if (L >= from && halfP > 0 && !mins.includes(30)) mins[int(r, 0, mins.length - 1)] = 30;
    const pairs: MatchPair[] = hours.map((h, i) => ({ key: `t${h}-${mins[i]}`, a: { visual: clockVis(h, mins[i] as number, { size: 'sm' }) }, b: { visual: digVis(h, mins[i] as number) } }));
    const text = '아날로그 시계와 같은 시각의 디지털 시계를 이어 보세요.';
    return mk(c, {
      prompt: text,
      say: text,
      answer: { t: 'match', pairs },
      hint: { say: '짧은바늘이 가리키는 숫자가 시이고, 긴바늘이 6이면 30분이에요. 디지털 시계는 점 두 개 앞이 시, 뒤가 분이에요.' },
      explain: '시계의 시각을 읽고, 같은 시각을 나타내는 디지털 시계를 이었어요.',
    });
  };
}

/** 디지털 시계를 보고 아날로그 시계 바늘 맞추기 */
export function digitalSetGen(cfg: { hours: number[]; half?: number; halfFrom?: Level }) {
  const halfP = cfg.half ?? 0.5;
  return (c: GenCtx): Question => {
    const r = c.rng;
    const L = c.level;
    const h = pick(r, cfg.hours);
    const useHalf = L >= (cfg.halfFrom ?? 2) && chance(r, L === 3 ? Math.max(halfP, 0.65) : halfP);
    const m = useHalf ? 30 : 0;
    const tt = timeText(h, m);
    const text = L === 1 ? '디지털 시계와 같은 시각이 되도록 아날로그 시계를 맞춰 보세요.' : `디지털 시계가 알려 주는 시각에 맞게 바늘을 돌려 보세요.`;
    return mk(c, {
      prompt: text,
      say: text,
      visual: digVis(h, m),
      answer: { t: 'clockSet', h, m, mode: useHalf ? 'half' : 'hour' },
      hint: {
        say: useHalf ? '긴바늘은 6에, 짧은바늘은 시를 지나서 두 숫자의 가운데에 놓아요.' : '긴바늘은 12에 두고, 짧은바늘을 시에 맞춰 봐요.',
        visual: clockVis(h, m, { size: 'md' }),
      },
      explain: `${tt}${josa(tt, '은/는')} 이렇게 보여요.`,
    });
  };
}

/** 보너스 게임: 정각 또는 30분인 디지털 시계를 터뜨리기 */
export function digitalTapGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  const n = L === 1 ? 4 : 6;
  const askHalf = chance(r, 0.55);
  const hitN = n === 4 ? 2 : int(r, 2, 3);
  const hitMin = askHalf ? 30 : 0;
  const otherMin = askHalf ? 0 : 30;
  const mins = shuffle(r, [...Array.from({ length: hitN }, () => hitMin), ...Array.from({ length: n - hitN }, () => otherMin)]);
  const { items } = digitalItems(r, n, mins);
  const targets = items.filter((_, i) => mins[i] === hitMin).map((it) => it.key);
  const word = askHalf ? '30분' : '정각';
  const text = `${word}인 디지털 시계를 모두 터뜨려 보세요.`;
  return mk(c, {
    prompt: text,
    say: askHalf ? '삼십 분인 디지털 시계를 모두 터뜨려 보세요.' : text,
    answer: { t: 'tapTargets', items, targets, cols: n === 4 ? 2 : 3, need: 'all' },
    hint: { say: '점 두 개 뒤의 숫자가 00이면 정각, 30이면 30분이에요.' },
    explain: askHalf ? '점 두 개 뒤가 30인 시계가 30분이에요.' : '점 두 개 뒤가 00인 시계가 정각이에요.',
  });
}

// ---------------------------------------------------------------------------
// (선택) 5분 단위 시계
// ---------------------------------------------------------------------------

const FIVE_RULE = '긴바늘이 숫자 하나를 지날 때마다 5분씩 늘어요. 1은 5분, 2는 10분, 3은 15분이에요.';
const fiveSteps = (k: number): Visual => ({ k: 'stones', seq: range(1, Math.max(2, k)).map((i) => i * 5) });

/** 5분 단위로 읽는 분 */
export function fiveReadGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  const h = int(r, 1, 12);

  if (L === 1) {
    // 긴바늘이 가리키는 숫자 → 분
    const k = pick(r, [1, 2, 3, 4, 5, 7, 8, 9, 10, 11]);
    const m = k * 5;
    const mo = (x: number): Option => ({ key: String(x), text: `${x}분`, say: `${x}분` });
    const wrongs = [k, m - 5, m + 5, m + 10].filter((x) => x > 0 && x < 60 && x !== m);
    return mk(c, {
      prompt: `긴바늘이 ${k}${josa(String(k), '을/를')} 가리켜요. 몇 분일까요?`,
      say: `긴바늘이 ${k}${josa(String(k), '을/를')} 가리켜요. 몇 분일까요?`,
      visual: clockVis(h, m, { size: 'lg', mark: 'minute' }),
      answer: buildChoice(r, mo(m), wrongs.map(mo), 3),
      hint: { say: FIVE_RULE, visual: fiveSteps(k) },
      explain: `긴바늘이 ${k}에 있으면 5씩 ${k}번 뛰어 세어서 ${m}분이에요.`,
    });
  }

  const m = pick(r, [5, 10, 15, 20, 25, 35, 40, 45, 50, 55]);
  const k = m / 5;
  const tt = timeText(h, m);
  const hint = { say: `짧은바늘이 지나간 숫자가 시예요. ${FIVE_RULE}`, visual: clockVis(h, m, { size: 'md', mark: 'hour' }) };
  const explain = `짧은바늘이 ${h}${josa(String(h), '을/를')} 지났고 긴바늘이 ${k}에 있어서 ${tt}${josa(tt, '이에요/예요')}.`;
  const wrongs = [
    timeOption(h, m + (m <= 50 ? 5 : -5)),
    timeOption(h, m - 5),
    timeOption(h, k),
    timeOption(wrap12(h + 1), m),
  ].filter((o) => o.key !== `${h}:${m}`);

  if (L === 2) {
    return mk(c, {
      prompt: '지금은 몇 시 몇 분일까요?',
      say: '지금은 몇 시 몇 분일까요?',
      visual: clockVis(h, m, { size: 'lg' }),
      answer: buildChoice(r, timeOption(h, m), wrongs, 3),
      hint,
      explain,
    });
  }
  if (chance(r, 0.5)) {
    const text = `${tt}${josa(tt, '을/를')} 나타내는 시계는 어느 것일까요?`;
    return mk(c, {
      prompt: text,
      say: text,
      answer: buildChoice(
        r,
        clockPick(h, m),
        [clockPick(h, m + (m <= 50 ? 5 : -5)), clockPick(k, h * 5 % 60), clockPick(wrap12(h + 1), m), clockPick(h, m - 5)].filter((o) => o.key !== `${h}:${m}`),
        3,
        3,
      ),
      hint,
      explain,
    });
  }
  const text = '디지털 시계와 같은 시각을 나타내는 시계는 어느 것일까요?';
  return mk(c, {
    prompt: text,
    say: text,
    visual: { k: 'digital', h, m },
    answer: buildChoice(
      r,
      clockPick(h, m),
      [clockPick(h, m + (m <= 50 ? 5 : -5)), clockPick(k, h * 5 % 60), clockPick(wrap12(h + 1), m), clockPick(h, m - 5)].filter((o) => o.key !== `${h}:${m}`),
      3,
      3,
    ),
    hint,
    explain,
  });
}

/** 5분 단위 바늘 맞추기 */
export function fiveSetGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  const h = int(r, 1, 12);
  const m = L === 1 ? pick(r, [15, 45, 30, 0]) : pick(r, [5, 10, 15, 20, 25, 35, 40, 45, 50, 55]);
  const tt = timeText(h, m);
  const hint = {
    say: `짧은바늘은 ${h}${josa(String(h), '을/를')} 지나 있게, 긴바늘은 ${m / 5}에 놓아요. ${FIVE_RULE}`,
    visual: clockVis(h, m, { size: 'md' }),
  };
  if (L === 3) {
    return mk(c, {
      prompt: '디지털 시계와 같은 시각이 되도록 아날로그 시계를 맞춰 보세요.',
      say: '디지털 시계와 같은 시각이 되도록 아날로그 시계를 맞춰 보세요.',
      visual: digVis(h, m),
      answer: { t: 'clockSet', h, m, mode: 'five' },
      hint,
      explain: `${tt}${josa(tt, '은/는')} 이렇게 보여요.`,
    });
  }
  const text = `${withJosa(tt, '이/가')} 되도록 시계를 맞춰 보세요.`;
  return mk(c, {
    prompt: text,
    say: text,
    answer: { t: 'clockSet', h, m, mode: 'five' },
    hint,
    explain: `${tt}${josa(tt, '은/는')} 이렇게 보여요.`,
  });
}

// ---------------------------------------------------------------------------
// (선택) 1시간은 60분, 몇 시간 뒤
// ---------------------------------------------------------------------------

const minOpt = (x: number): Option => ({ key: String(x), text: `${x}분`, say: `${x}분` });

export function hour60Gen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  const h = int(r, 1, 12);

  if (L === 1) {
    if (chance(r, 0.5)) {
      return mk(c, {
        prompt: '1시간은 몇 분일까요?',
        say: '1시간은 몇 분일까요?',
        visual: clockVis(h, 0, { size: 'lg', mark: 'minute' }),
        answer: buildChoice(r, minOpt(60), [minOpt(30), minOpt(100), minOpt(10)], 3),
        hint: { say: '긴바늘이 12에서 출발해 한 바퀴를 돌아 다시 12에 오면 1시간이에요.', visual: clockVis(h, 30, { size: 'md', mark: 'minute' }) },
        explain: '긴바늘이 한 바퀴 도는 데 60분이 걸려요. 60분이 1시간이에요.',
      });
    }
    const opts: Option[] = [
      { key: 'one', text: '1시간', say: '한 시간' },
      { key: 'half', text: '30분', say: '삼십 분' },
      { key: 'two', text: '2시간', say: '두 시간' },
    ];
    return mk(c, {
      prompt: '긴바늘이 한 바퀴 돌면 시간이 얼마나 지났을까요?',
      say: '긴바늘이 한 바퀴 돌면 시간이 얼마나 지났을까요?',
      visual: { k: 'row', items: [clockVis(h, 0, { size: 'sm' }), { k: 'big', text: '➜', tone: 'ink' }, clockVis(wrap12(h + 1), 0, { size: 'sm' })], gap: 12 },
      answer: buildChoice(r, opts[0] as Option, [opts[1] as Option, opts[2] as Option], 3),
      hint: { say: '긴바늘이 한 바퀴 돌아 제자리에 오면 60분이 지난 거예요.' },
      explain: '긴바늘이 한 바퀴 돌면 60분, 곧 1시간이 지난 거예요.',
    });
  }
  if (L === 2) {
    if (chance(r, 0.5)) {
      return mk(c, {
        prompt: '30분과 30분을 합치면 모두 몇 분일까요?',
        say: '삼십 분과 삼십 분을 합치면 모두 몇 분일까요?',
        visual: { k: 'row', items: [clockVis(h, 30, { size: 'sm', mark: 'minute' }), { k: 'big', text: '+', tone: 'ink' }, clockVis(h, 30, { size: 'sm', mark: 'minute' })], gap: 10 },
        answer: buildChoice(r, minOpt(60), [minOpt(50), minOpt(30), minOpt(90)], 3),
        hint: { say: '30분은 반 바퀴예요. 반 바퀴와 반 바퀴를 합치면 한 바퀴예요.' },
        explain: '30분 + 30분 = 60분이고, 60분은 1시간이에요.',
      });
    }
    const opts: Option[] = [
      { key: 'one', text: '1시간', say: '한 시간' },
      { key: 'half', text: '30분', say: '삼십 분' },
      { key: 'two', text: '2시간', say: '두 시간' },
    ];
    return mk(c, {
      prompt: '60분은 몇 시간일까요?',
      say: '육십 분은 몇 시간일까요?',
      visual: clockVis(h, 0, { size: 'md', mark: 'minute' }),
      answer: buildChoice(r, opts[0] as Option, [opts[1] as Option, opts[2] as Option], 3),
      hint: { say: '긴바늘이 한 바퀴를 도는 시간이 60분이에요.' },
      explain: '60분은 1시간이에요.',
    });
  }
  const text = pick(r, [
    '1시간은 몇 분일까요? 숫자를 눌러 알려 주세요.',
    '긴바늘이 한 바퀴를 도는 데 걸리는 시간은 몇 분일까요? 숫자를 눌러 알려 주세요.',
    '긴바늘이 12에서 출발해 한 바퀴를 돌아 다시 12에 왔어요. 몇 분이 지났을까요? 숫자를 눌러 알려 주세요.',
  ]);
  return mk(c, {
    prompt: text,
    say: text,
    visual: clockVis(h, 0, { size: 'md', mark: 'minute' }),
    answer: { t: 'number', correct: 60, maxDigits: 2 },
    hint: { say: '30분이 두 번이면 1시간이에요.', visual: { k: 'eq', parts: ['30', '+', '30', '=', '?'] } },
    explain: '1시간은 60분이에요.',
  });
}

/** 정각과 30분에서 1시간 또는 2시간 뒤·전의 시각 */
export function hourAfterGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  const h = int(r, 1, 12);
  const m = L === 1 ? 0 : chance(r, 0.5) ? 30 : 0;
  const later = chance(r, 0.65);
  const span = L === 3 ? pick(r, [1, 2, 3]) : 1;
  const th = wrap12(later ? h + span : h - span);
  const tt = timeText(h, m);
  const ans = timeText(th, m);
  const word = later ? '뒤' : '전';
  const hours = `${span}시간`;
  const hint = {
    say: later ? '1시간이 지날 때마다 짧은바늘이 숫자 하나씩 앞으로 가요.' : '1시간 전이면 짧은바늘이 숫자 하나씩 뒤로 가요.',
    visual: { k: 'row', items: [clockVis(h, m, { size: 'sm' }), { k: 'big', text: '➜', tone: 'ink' }, clockVis(th, m, { size: 'sm' })], gap: 10 } as Visual,
  };
  const topic = `${hours} ${word}${josa(word, '은/는')}`;
  const explain = `${tt}에서 ${topic} ${ans}${josa(ans, '이에요/예요')}.`;
  const text = `${tt}에서 ${topic} 몇 시${m === 30 ? ' 몇 분' : ''}일까요?`;

  if (L <= 2) {
    const wrongs = m === 0 ? [wrap12(th + 1), wrap12(th - 1), wrap12(th + 2)].map(hourOption) : [timeOption(wrap12(th + 1), 30), timeOption(wrap12(th - 1), 30), timeOption(th, 0)];
    return mk(c, {
      prompt: text,
      say: text,
      visual: clockVis(h, m, { size: 'lg' }),
      answer: buildChoice(r, m === 0 ? hourOption(th) : timeOption(th, 30), wrongs, 3),
      hint,
      explain,
    });
  }
  const text2 = `${tt}에서 ${hours} ${word}${josa(word, '으로/로')} 시계를 맞춰 보세요.`;
  return mk(c, {
    prompt: text2,
    say: text2,
    visual: clockVis(h, m, { size: 'md' }),
    answer: { t: 'clockSet', h: th, m, mode: m === 30 ? 'half' : 'hour' },
    hint,
    explain,
  });
}
