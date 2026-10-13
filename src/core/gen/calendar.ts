import { WEEKDAYS_LONG, WEEKDAYS_SHORT, daysInMonth, firstWeekday, weekdayOf } from '../dates';
import { dayKo, josa, monthKo } from '../ko';
import { chance, distinctInts, int, pick, shuffle } from '../rng';
import type { GenCtx, Option, Question, Visual } from '../types';
import { buildChoice, mk, numChoice } from './util';

export const wdOpt = (i: number): Option => ({ key: String(i), text: WEEKDAYS_LONG[i], say: WEEKDAYS_LONG[i] });
export const monthOpt = (m: number): Option => ({ key: String(m), text: `${m}월`, say: monthKo(m) });

const others = (r: GenCtx['rng'], n: number, exclude: number[], count: number): number[] =>
  distinctInts(r, 0, n - 1, count, exclude);

// ---------------------------------------------------------------------------
// 요일 이름
// ---------------------------------------------------------------------------

export function weekdayNameGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  if (L === 1) {
    const i = int(r, 0, 6);
    return mk(c, {
      prompt: '빨간 칸은 무슨 요일일까요?',
      say: '빨간 칸은 무슨 요일일까요?',
      visual: { k: 'weekdays', highlight: i, names: 'short' },
      answer: buildChoice(r, wdOpt(i), others(r, 7, [i], 4).map(wdOpt), 3),
      hint: { say: '일, 월, 화, 수, 목, 금, 토. 한 글자 뒤에 요일을 붙여요.' },
      explain: `${WEEKDAYS_SHORT[i]}에 요일을 붙여서 ${WEEKDAYS_LONG[i]}이에요.`,
    });
  }
  const order = [0, 1, 2, 3, 4, 5, 6];
  if (L === 2) {
    const i = int(r, 0, 6);
    return mk(c, {
      // 요일 이름은 모두 '일'로 끝나 받침이 있으므로 '을'·'과'가 맞다.
      prompt: `${WEEKDAYS_LONG[i]}을 찾아 눌러 보세요.`,
      say: `${WEEKDAYS_LONG[i]}을 찾아 눌러 보세요.`,
      answer: {
        t: 'tapTargets',
        items: shuffle(r, order).map((k) => ({ key: String(k), text: WEEKDAYS_SHORT[k] as string, say: WEEKDAYS_LONG[k] as string })),
        targets: [String(i)],
        cols: 4,
        need: 'one',
      },
      hint: { say: `${WEEKDAYS_LONG[i]}은 ${WEEKDAYS_SHORT[i]}이라고 써요.` },
      explain: `${WEEKDAYS_LONG[i]}은 ${WEEKDAYS_SHORT[i]}이에요.`,
    });
  }
  const pair = pick(r, [
    [6, 0],
    [1, 3],
    [2, 4],
    [4, 5],
    [0, 1],
    [3, 6],
  ] as const);
  const [a, b] = pair;
  return mk(c, {
    prompt: `${WEEKDAYS_LONG[a]}과 ${WEEKDAYS_LONG[b]}을 모두 찾아 눌러 보세요.`,
    say: `${WEEKDAYS_LONG[a]}과 ${WEEKDAYS_LONG[b]}을 모두 찾아 눌러 보세요.`,
    answer: {
      t: 'tapTargets',
      items: shuffle(r, order).map((k) => ({ key: String(k), text: WEEKDAYS_LONG[k] as string, say: WEEKDAYS_LONG[k] as string })),
      targets: [String(a), String(b)],
      cols: 4,
      need: 'all',
    },
    hint: { say: '요일 이름을 하나씩 읽으면서 찾아 봐요.' },
    explain: `${WEEKDAYS_LONG[a]}과 ${WEEKDAYS_LONG[b]}이에요.`,
  });
}

// ---------------------------------------------------------------------------
// 요일 순서
// ---------------------------------------------------------------------------

export function weekdayOrderGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  const i = int(r, 0, 6);
  if (L === 1) {
    const ans = (i + 1) % 7;
    return mk(c, {
      prompt: `${WEEKDAYS_LONG[i]} 다음 날은 무슨 요일일까요?`,
      say: `${WEEKDAYS_LONG[i]} 다음 날은 무슨 요일일까요?`,
      visual: { k: 'weekdays', highlight: i, names: 'short' },
      answer: buildChoice(r, wdOpt(ans), [wdOpt(i), wdOpt((i + 2) % 7), wdOpt((i + 6) % 7)], 3),
      hint: { say: '일, 월, 화, 수, 목, 금, 토 순서로 하루씩 지나가요.' },
      explain: `${WEEKDAYS_LONG[i]} 다음 날은 ${WEEKDAYS_LONG[ans]}이에요.`,
    });
  }
  if (L === 2) {
    return mk(c, {
      prompt: '빈칸에 들어갈 요일은 무엇일까요?',
      say: '빈칸에 들어갈 요일은 무엇일까요?',
      visual: { k: 'weekdays', hide: [i], names: 'short' },
      answer: buildChoice(r, wdOpt(i), [wdOpt((i + 1) % 7), wdOpt((i + 6) % 7), wdOpt((i + 3) % 7)], 3),
      hint: { say: '앞의 요일과 뒤의 요일을 보고 사이에 들어갈 요일을 찾아요.' },
      explain: `빈칸은 ${WEEKDAYS_LONG[i]}이에요.`,
    });
  }
  const kind = pick(r, ['before', 'after2', 'wrap'] as const);
  let from = i;
  let ans: number;
  let prompt: string;
  if (kind === 'before') {
    ans = (i + 6) % 7;
    prompt = `${WEEKDAYS_LONG[i]} 바로 전 날은 무슨 요일일까요?`;
  } else if (kind === 'after2') {
    ans = (i + 2) % 7;
    prompt = `${WEEKDAYS_LONG[i]}에서 이틀 뒤는 무슨 요일일까요?`;
  } else {
    from = 6;
    ans = 0;
    prompt = '토요일 다음 날은 무슨 요일일까요?';
  }
  return mk(c, {
    prompt,
    say: prompt,
    visual: { k: 'weekdays', highlight: from, names: 'short' },
    answer: buildChoice(r, wdOpt(ans), others(r, 7, [ans], 5).map(wdOpt), 3),
    hint: { say: '일요일부터 토요일까지 가면 다시 일요일로 돌아와요.' },
    explain: `정답은 ${WEEKDAYS_LONG[ans]}이에요.`,
  });
}

// ---------------------------------------------------------------------------
// 12개월
// ---------------------------------------------------------------------------

export function monthsGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  const m = int(r, 1, 12);
  const wrap = (x: number) => ((x - 1 + 12) % 12) + 1;
  if (L === 1) {
    if (chance(r, 0.5)) {
      return mk(c, {
        prompt: '표시된 달은 몇 월일까요?',
        say: '표시된 달은 몇 월일까요?',
        visual: { k: 'months', highlight: m },
        answer: buildChoice(r, monthOpt(m), [monthOpt(wrap(m - 1)), monthOpt(wrap(m + 1)), monthOpt(wrap(m + 2))], 3),
        hint: { say: '왼쪽 위에서부터 일월, 이월, 삼월 순서로 읽어요.' },
        explain: `${m}월이에요.`,
      });
    }
    const ans = wrap(m + 1);
    return mk(c, {
      prompt: `${m}월 다음 달은 몇 월일까요?`,
      say: `${monthKo(m)} 다음 달은 몇 월일까요?`,
      visual: { k: 'months', highlight: m },
      answer: buildChoice(r, monthOpt(ans), [monthOpt(m), monthOpt(wrap(m + 2)), monthOpt(wrap(m - 1))], 3),
      hint: { say: '한 달이 지나면 다음 달이에요.' },
      explain: `${m}월 다음 달은 ${ans}월이에요.`,
    });
  }
  if (L === 2) {
    return mk(c, {
      prompt: '빈칸에 들어갈 달은 몇 월일까요?',
      say: '빈칸에 들어갈 달은 몇 월일까요?',
      visual: { k: 'months', hide: [m] },
      answer: buildChoice(r, monthOpt(m), [monthOpt(wrap(m - 1)), monthOpt(wrap(m + 1)), monthOpt(wrap(m + 3))], 3),
      hint: { say: '앞의 달과 뒤의 달을 보고 사이를 찾아요.' },
      explain: `빈칸은 ${m}월이에요.`,
    });
  }
  const kind = pick(r, ['next', 'prev', 'count'] as const);
  if (kind === 'count') {
    return mk(c, {
      prompt: '일 년은 모두 몇 개월일까요?',
      say: '일 년은 모두 몇 개월일까요?',
      visual: { k: 'months' },
      answer: numChoice(r, 12, 9, 14, { spread: 2, say: (n) => `${n}개월` , text: (n) => `${n}개월` }),
      hint: { say: '달 그림을 하나씩 세어 봐요.' },
      explain: '일 년은 열두 개월이에요.',
    });
  }
  const base = kind === 'next' ? pick(r, [12, m]) : pick(r, [1, m]);
  const ans = kind === 'next' ? wrap(base + 1) : wrap(base - 1);
  const word = kind === 'next' ? '다음' : '바로 전';
  return mk(c, {
    prompt: `${base}월 ${word} 달은 몇 월일까요?`,
    say: `${monthKo(base)} ${word} 달은 몇 월일까요?`,
    visual: { k: 'months', highlight: base },
    answer: buildChoice(r, monthOpt(ans), [monthOpt(base), monthOpt(wrap(ans + 1)), monthOpt(wrap(ans - 1))], 3),
    hint: { say: '12월 다음에는 새해 1월이 와요.' },
    explain: `${base}월 ${word} 달은 ${ans}월이에요.`,
  });
}

// ---------------------------------------------------------------------------
// 달력의 구조
// ---------------------------------------------------------------------------

export function calGridGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  const { y, m } = c.today;
  const total = daysInMonth(y, m);
  const cal = (marks?: Record<number, 'target'>): Visual => ({ k: 'calendar', year: y, month: m, marks, compact: true });

  if (L === 1) {
    const kind = pick(r, ['sunday', 'row'] as const);
    if (kind === 'sunday') {
      return mk(c, {
        prompt: '달력에서 일요일은 어느 쪽 끝에 있을까요?',
        say: '달력에서 일요일은 어느 쪽 끝에 있을까요?',
        visual: cal(),
        answer: {
          t: 'choice',
          options: [
            { key: 'L', text: '왼쪽 끝' },
            { key: 'R', text: '오른쪽 끝' },
          ],
          correct: 0,
          cols: 2,
        },
        hint: { say: '달력 맨 위의 요일 이름을 읽어 봐요. 일요일이 가장 먼저 나와요.' },
        explain: '일요일은 왼쪽 끝, 토요일은 오른쪽 끝에 있어요.',
      });
    }
    return mk(c, {
      prompt: '달력의 한 줄에는 요일이 몇 개 있을까요?',
      say: '달력의 한 줄에는 요일이 몇 개 있을까요?',
      visual: cal(),
      answer: numChoice(r, 7, 5, 9, { spread: 2, say: (n) => `${n}개`, text: (n) => `${n}개` }),
      hint: { say: '일, 월, 화, 수, 목, 금, 토를 세어 봐요.' },
      explain: '한 줄에는 일곱 개의 요일이 있어요.',
    });
  }
  if (L === 2) {
    const t = int(r, 1, total);
    return mk(c, {
      prompt: `${m}월 ${t}일을 달력에서 찾아 눌러 보세요.`,
      say: `${monthKo(m)} ${dayKo(t)}${josa(dayKo(t), '을/를')} 달력에서 찾아 눌러 보세요.`,
      answer: { t: 'calTap', year: y, month: m, targets: [t], need: 'one' },
      hint: { say: '숫자가 작은 날은 위쪽, 큰 날은 아래쪽에 있어요.' },
      explain: `${t}일은 여기에 있어요.`,
    });
  }
  const t = int(r, 1, total);
  const ans = weekdayOf(y, m, t);
  return mk(c, {
    prompt: `${m}월 ${t}일은 무슨 요일일까요?`,
    say: `${monthKo(m)} ${dayKo(t)}은 무슨 요일일까요?`,
    visual: cal({ [t]: 'target' }),
    answer: buildChoice(r, wdOpt(ans), others(r, 7, [ans], 5).map(wdOpt), 3),
    hint: { say: `${t}일이 있는 칸에서 위로 올라가 요일 이름을 읽어요.` },
    explain: `${t}일은 ${WEEKDAYS_LONG[ans]}이에요.`,
  });
}

export function firstDayOfMonthInfo(y: number, m: number): { wd: number; days: number } {
  return { wd: firstWeekday(y, m), days: daysInMonth(y, m) };
}
