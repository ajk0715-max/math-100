import { WEEKDAYS_LONG, WEEKDAYS_SHORT, addDays, daysInMonth, firstWeekday, makeParts, weekdayOf } from '../dates';
import { dateKo, dateText, dayKo, josa, monthKo } from '../ko';
import { chance, distinctInts, int, pick, shuffle } from '../rng';
import type { CalMark, FamilyEvent, GenCtx, Option, Question, Visual } from '../types';
import { buildChoice, mk, numChoice } from './util';

export const wdOpt = (i: number): Option => ({ key: String(i), text: WEEKDAYS_LONG[i], say: WEEKDAYS_LONG[i] });
export const monthOpt = (m: number): Option => ({ key: String(m), text: `${m}월`, say: monthKo(m) });

export const others = (r: GenCtx['rng'], n: number, exclude: number[], count: number): number[] =>
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

// ---------------------------------------------------------------------------
// 날짜 읽기 도우미
// ---------------------------------------------------------------------------

export const dateOpt = (m: number, d: number): Option => ({ key: `${m}-${d}`, text: dateText(m, d), say: dateKo(m, d) });
export const dateWdOpt = (m: number, d: number, wd: number): Option => ({
  key: `${m}-${d}-${wd}`,
  text: `${dateText(m, d)} ${WEEKDAYS_LONG[wd]}`,
  say: `${dateKo(m, d)} ${WEEKDAYS_LONG[wd]}`,
});
export const dayOpt = (d: number): Option => ({ key: String(d), text: `${d}일`, say: dayKo(d) });
export const wrapMonth = (m: number): number => ((m - 1 + 12) % 12) + 1;

/** 달력에 쓸 해: 오늘보다 이른 달은 내년 달력으로 본다 */
export function yearFor(c: GenCtx, month: number): number {
  return month >= c.today.m ? c.today.y : c.today.y + 1;
}

export function calOf(year: number, month: number, marks?: Record<number, CalMark>): Visual {
  return { k: 'calendar', year, month, compact: true, ...(marks ? { marks } : {}) };
}

/** 정답 주변의 날짜 보기(범위 안의 값만) */
export function nearDays(correct: number, dim: number): Option[] {
  return [correct - 1, correct + 1, correct - 7, correct + 7, correct + 2, correct - 2].filter((x) => x >= 1 && x <= dim && x !== correct).map(dayOpt);
}

// ---------------------------------------------------------------------------
// 오늘은 몇 월 며칠
// ---------------------------------------------------------------------------

export function dateTodayGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  const { y, m, d, wd } = c.today;
  const dim = daysInMonth(y, m);
  const vis = calOf(y, m, { [d]: 'today' });
  const dateWrongs = (): Option[] => {
    const out: Option[] = [];
    for (const x of [d - 1, d + 1, d - 7, d + 7]) if (x >= 1 && x <= dim) out.push(dateOpt(m, x));
    out.push(dateOpt(wrapMonth(m - 1), d <= daysInMonth(y, wrapMonth(m - 1)) ? d : 1));
    out.push(dateOpt(wrapMonth(m + 1), d <= daysInMonth(y, wrapMonth(m + 1)) ? d : 1));
    return out;
  };
  const hint = { say: '달력에서 빨간 칸이 오늘이에요. 위에 적힌 달과 칸 안의 숫자를 읽어 봐요.', visual: vis };
  if (L === 1) {
    return mk(c, {
      prompt: '빨간 칸이 오늘이에요. 오늘은 몇 월 며칠일까요?',
      say: '빨간 칸이 오늘이에요. 오늘은 몇 월 며칠일까요?',
      visual: vis,
      answer: buildChoice(r, dateOpt(m, d), dateWrongs(), 3),
      hint,
      explain: `오늘은 ${dateText(m, d)}이에요.`,
    });
  }
  if (L === 2) {
    if (chance(r, 0.5)) {
      return mk(c, {
        prompt: '빨간 칸이 오늘이에요. 오늘은 무슨 요일일까요?',
        say: '빨간 칸이 오늘이에요. 오늘은 무슨 요일일까요?',
        visual: { k: 'calendar', year: y, month: m, marks: { [d]: 'today' }, compact: true, highlightWeekday: undefined },
        answer: buildChoice(r, wdOpt(wd), others(r, 7, [wd], 5).map(wdOpt), 3),
        hint: { say: '빨간 칸에서 위로 올라가서 요일 이름을 읽어요.', visual: vis },
        explain: `오늘은 ${WEEKDAYS_LONG[wd]}이에요.`,
      });
    }
    return mk(c, {
      prompt: `오늘은 ${m}월이에요. 빨간 칸의 숫자를 읽어 보세요. 오늘은 며칠일까요?`,
      say: `오늘은 ${monthKo(m)}이에요. 빨간 칸의 숫자를 읽어 보세요. 오늘은 며칠일까요?`,
      visual: vis,
      answer: buildChoice(r, dayOpt(d), nearDays(d, dim), 3),
      hint,
      explain: `오늘은 ${d}일이에요.`,
    });
  }
  const wrongs: Option[] = [];
  for (const x of [d - 1, d + 1]) if (x >= 1 && x <= dim) wrongs.push(dateWdOpt(m, x, wd));
  wrongs.push(dateWdOpt(m, d, (wd + 1) % 7), dateWdOpt(m, d, (wd + 6) % 7));
  const dd = d - 7 >= 1 ? d - 7 : d + 7 <= dim ? d + 7 : d;
  if (dd !== d) wrongs.push(dateWdOpt(m, dd, wd));
  return mk(c, {
    prompt: '오늘은 몇 월 며칠 무슨 요일일까요?',
    say: '오늘은 몇 월 며칠 무슨 요일일까요?',
    visual: vis,
    answer: buildChoice(r, dateWdOpt(m, d, wd), wrongs, 3),
    hint,
    explain: `오늘은 ${dateText(m, d)} ${WEEKDAYS_LONG[wd]}이에요.`,
  });
}

// ---------------------------------------------------------------------------
// 달력에서 날짜 읽기
// ---------------------------------------------------------------------------

export function dateReadGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  let month = c.today.m;
  if (L === 3) month = wrapMonth(month + pick(r, [-1, 1, 2]));
  const year = yearFor(c, month);
  const dim = daysInMonth(year, month);
  const t = int(r, 1, dim);
  const wd = weekdayOf(year, month, t);
  const vis = calOf(year, month, { [t]: 'target' });
  const hint = { say: '빨간 칸 안의 숫자가 날짜예요. 달력 맨 위의 몇 월인지도 같이 읽어요.', visual: vis };
  if (L === 1) {
    return mk(c, {
      prompt: '빨간 칸은 며칠일까요?',
      say: '빨간 칸은 며칠일까요?',
      visual: vis,
      answer: buildChoice(r, dayOpt(t), nearDays(t, dim), 3),
      hint,
      explain: `빨간 칸은 ${t}일이에요.`,
    });
  }
  if (L === 2) {
    const wrongs: Option[] = [];
    for (const x of [t - 1, t + 1, t + 7, t - 7]) if (x >= 1 && x <= dim) wrongs.push(dateOpt(month, x));
    const om = wrapMonth(month + 1);
    wrongs.push(dateOpt(om, Math.min(t, daysInMonth(yearFor(c, om), om))));
    return mk(c, {
      prompt: '빨간 칸은 몇 월 며칠일까요?',
      say: '빨간 칸은 몇 월 며칠일까요?',
      visual: vis,
      answer: buildChoice(r, dateOpt(month, t), wrongs, 3),
      hint,
      explain: `빨간 칸은 ${dateText(month, t)}이에요.`,
    });
  }
  const wrongs: Option[] = [];
  for (const x of [t - 1, t + 1]) if (x >= 1 && x <= dim) wrongs.push(dateWdOpt(month, x, wd));
  wrongs.push(dateWdOpt(month, t, (wd + 1) % 7), dateWdOpt(month, t, (wd + 6) % 7), dateWdOpt(month, t, (wd + 3) % 7));
  return mk(c, {
    prompt: '빨간 칸은 몇 월 며칠 무슨 요일일까요?',
    say: '빨간 칸은 몇 월 며칠 무슨 요일일까요?',
    visual: vis,
    answer: buildChoice(r, dateWdOpt(month, t, wd), wrongs, 3),
    hint,
    explain: `${dateText(month, t)}은 ${WEEKDAYS_LONG[wd]}이에요.`,
  });
}

// ---------------------------------------------------------------------------
// 어제·오늘·내일
// ---------------------------------------------------------------------------

export function relDayGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  const month = c.today.m;
  const year = c.today.y;
  const dim = daysInMonth(year, month);

  if (L === 3) {
    // 달이 바뀌는 날: 마지막 날의 내일, 1일의 어제
    const m = int(r, 1, 12);
    const y = yearFor(c, m);
    if (chance(r, 0.5)) {
      const last = daysInMonth(y, m);
      const next = addDays(makeParts(y, m, last), 1);
      const wrongs: Option[] = [dateOpt(next.m, 2), dateOpt(m, last), dateOpt(wrapMonth(next.m + 1), 1)];
      if (last < 31) wrongs.push(dateOpt(m, last + 1));
      return mk(c, {
        prompt: `오늘이 ${dateText(m, last)}이에요. 내일은 몇 월 며칠일까요?`,
        say: `오늘이 ${dateKo(m, last)}이에요. 내일은 몇 월 며칠일까요?`,
        visual: calOf(y, m, { [last]: 'today' }),
        answer: buildChoice(r, dateOpt(next.m, next.d), wrongs, 3),
        hint: { say: '그 달의 마지막 날이 지나면 다음 달 1일이 와요.' },
        explain: `${dateText(m, last)} 다음 날은 ${dateText(next.m, next.d)}이에요.`,
      });
    }
    const prev = addDays(makeParts(y, m, 1), -1);
    const wrongs: Option[] = [dateOpt(prev.m, prev.d - 1), dateOpt(m, 2), dateOpt(wrapMonth(prev.m - 1), 28)];
    if (prev.d < 31) wrongs.push(dateOpt(prev.m, prev.d + 1));
    return mk(c, {
      prompt: `오늘이 ${dateText(m, 1)}이에요. 어제는 몇 월 며칠일까요?`,
      say: `오늘이 ${dateKo(m, 1)}이에요. 어제는 몇 월 며칠일까요?`,
      visual: calOf(y, m, { 1: 'today' }),
      answer: buildChoice(r, dateOpt(prev.m, prev.d), wrongs, 3),
      hint: { say: '1일의 어제는 지난달의 마지막 날이에요.' },
      explain: `${dateText(m, 1)} 전날은 ${dateText(prev.m, prev.d)}이에요.`,
    });
  }

  const d = int(r, 3, dim - 2);
  const wd = weekdayOf(year, month, d);
  const tomorrow = chance(r, 0.5);
  const target = tomorrow ? d + 1 : d - 1;
  const word = tomorrow ? '내일' : '어제';
  const vis = calOf(year, month, { [d]: 'today' });
  const hint = { say: tomorrow ? '내일은 오늘 바로 다음 날이에요. 달력에서 오른쪽 칸이에요.' : '어제는 오늘 바로 전 날이에요. 달력에서 왼쪽 칸이에요.', visual: vis };
  if (L === 1) {
    return mk(c, {
      prompt: `빨간 칸이 오늘이에요. ${word}는 며칠일까요?`,
      say: `빨간 칸이 오늘이에요. ${word}는 며칠일까요?`,
      visual: vis,
      answer: buildChoice(r, dayOpt(target), [d - 1, d + 1, d - 2, d + 2].filter((x) => x !== target && x >= 1 && x <= dim).map(dayOpt), 3),
      hint,
      explain: `${word}는 ${target}일이에요.`,
    });
  }
  const twd = (wd + (tomorrow ? 1 : 6)) % 7;
  const wrongs: Option[] = [dateWdOpt(month, d, twd), dateWdOpt(month, target, wd), dateWdOpt(month, d + (tomorrow ? -1 : 1), (twd + 1) % 7), dateWdOpt(month, target, (twd + 1) % 7)];
  return mk(c, {
    prompt: `오늘은 ${d}일 ${WEEKDAYS_LONG[wd]}이에요. ${word}는 며칠 무슨 요일일까요?`,
    say: `오늘은 ${dayKo(d)} ${WEEKDAYS_LONG[wd]}이에요. ${word}는 며칠 무슨 요일일까요?`,
    visual: vis,
    answer: buildChoice(r, { key: `${month}-${target}-${twd}`, text: `${target}일 ${WEEKDAYS_LONG[twd]}`, say: `${dayKo(target)} ${WEEKDAYS_LONG[twd]}` }, wrongs.map((o) => ({ ...o, text: o.text?.replace(/^\d+월 /, ''), say: o.say?.replace(/^\S+월 /, '') })), 3),
    hint,
    explain: `${word}는 ${target}일 ${WEEKDAYS_LONG[twd]}이에요.`,
  });
}

// ---------------------------------------------------------------------------
// 달력에서 날짜 찾기
// ---------------------------------------------------------------------------

const ORD = ['', '첫', '두', '세', '네', '다섯'];

export function findDateGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  // 2월 29일처럼 그해 달력에 없는 날은 쓰지 않는다
  const evs = c.events.filter((e) => e.month >= 1 && e.month <= 12 && e.day >= 1 && e.day <= daysInMonth(yearFor(c, e.month), e.month));

  // 가족 행사가 있으면 그 달 달력으로 문제를 낸다
  if (L >= 2 && evs.length > 0 && chance(r, 0.5)) {
    const ev = pick(r, evs);
    const year = yearFor(c, ev.month);
    const wd = weekdayOf(year, ev.month, ev.day);
    if (L === 2 || chance(r, 0.4)) {
      return mk(c, {
        prompt: `${ev.label}은 ${dateText(ev.month, ev.day)}이에요. 달력에서 ${ev.day}일을 찾아 눌러 보세요.`,
        say: `${ev.label}은 ${dateKo(ev.month, ev.day)}이에요. 달력에서 ${dayKo(ev.day)}을 찾아 눌러 보세요.`,
        answer: { t: 'calTap', year, month: ev.month, targets: [ev.day], need: 'one' },
        hint: { say: '숫자가 작은 날은 위쪽, 큰 날은 아래쪽에 있어요.' },
        explain: `${ev.day}일은 여기에 있어요.`,
      });
    }
    const wrongs = others(r, 7, [wd], 5).map(wdOpt);
    return mk(c, {
      prompt: `${ev.label}은 ${dateText(ev.month, ev.day)}이에요. 그날은 무슨 요일일까요?`,
      say: `${ev.label}은 ${dateKo(ev.month, ev.day)}이에요. 그날은 무슨 요일일까요?`,
      visual: calOf(year, ev.month, { [ev.day]: 'event' }),
      answer: buildChoice(r, wdOpt(wd), wrongs, 3),
      hint: { say: '표시된 날에서 위로 올라가 요일 이름을 읽어요.' },
      explain: `${ev.label}은 ${WEEKDAYS_LONG[wd]}이에요.`,
    });
  }

  const { y, m } = c.today;
  const dim = daysInMonth(y, m);
  const todayMark: Record<number, CalMark> = { [c.today.d]: 'today' };
  if (L === 1) {
    const kind = pick(r, ['day', 'first', 'last'] as const);
    if (kind === 'first' || kind === 'last') {
      const target = kind === 'first' ? 1 : dim;
      return mk(c, {
        prompt: kind === 'first' ? `${m}월의 첫째 날을 찾아 눌러 보세요.` : `${m}월의 마지막 날을 찾아 눌러 보세요.`,
        say: kind === 'first' ? `${monthKo(m)}의 첫째 날을 찾아 눌러 보세요.` : `${monthKo(m)}의 마지막 날을 찾아 눌러 보세요.`,
        answer: { t: 'calTap', year: y, month: m, targets: [target], need: 'one', marks: todayMark },
        hint: { say: kind === 'first' ? '1일은 달력의 맨 처음 숫자예요.' : '달력에서 가장 큰 숫자가 마지막 날이에요.' },
        explain: kind === 'first' ? '첫째 날은 1일이에요.' : `마지막 날은 ${dim}일이에요.`,
      });
    }
    const t = int(r, 2, dim - 1);
    return mk(c, {
      prompt: `${m}월 ${t}일을 찾아 눌러 보세요.`,
      say: `${monthKo(m)} ${dayKo(t)}${josa(dayKo(t), '을/를')} 찾아 눌러 보세요.`,
      answer: { t: 'calTap', year: y, month: m, targets: [t], need: 'one', marks: todayMark },
      hint: { say: '숫자가 작은 날은 위쪽, 큰 날은 아래쪽에 있어요.' },
      explain: `${t}일은 여기에 있어요.`,
    });
  }
  if (L === 2) {
    const wd = int(r, 0, 6);
    const nth = int(r, 1, 2);
    const days: number[] = [];
    for (let d = 1; d <= dim; d++) if (weekdayOf(y, m, d) === wd) days.push(d);
    const target = days[nth - 1] as number;
    return mk(c, {
      prompt: `${m}월의 ${ORD[nth]} 번째 ${WEEKDAYS_LONG[wd]}을 찾아 눌러 보세요.`,
      say: `${monthKo(m)}의 ${ORD[nth]} 번째 ${WEEKDAYS_LONG[wd]}을 찾아 눌러 보세요.`,
      answer: { t: 'calTap', year: y, month: m, targets: [target], need: 'one', marks: todayMark },
      hint: { say: `${WEEKDAYS_LONG[wd]} 칸이 있는 세로줄을 위에서부터 보면 ${nth === 1 ? '맨 처음' : '두 번째'} 날이에요.`, visual: { k: 'calendar', year: y, month: m, highlightWeekday: wd, compact: true } },
      explain: `${nth === 1 ? '첫' : '두'} 번째 ${WEEKDAYS_LONG[wd]}은 ${target}일이에요.`,
    });
  }
  const t = int(r, 1, dim);
  const wd = weekdayOf(y, m, t);
  const same: number[] = [];
  for (let d = 1; d <= dim; d++) if (weekdayOf(y, m, d) === wd && d !== t) same.push(d);
  return mk(c, {
    prompt: `${m}월 ${t}일과 같은 요일인 날을 모두 찾아 눌러 보세요.`,
    say: `${monthKo(m)} ${dayKo(t)}${josa(dayKo(t), '과/와')} 같은 요일인 날을 모두 찾아 눌러 보세요.`,
    answer: { t: 'calTap', year: y, month: m, targets: same, need: 'all', marks: { [t]: 'start' } },
    hint: { say: `${t}일이 있는 세로줄의 다른 칸들이 모두 같은 요일이에요.`, visual: { k: 'calendar', year: y, month: m, highlightWeekday: wd, compact: true } },
    explain: `같은 요일인 날은 ${same.join(', ')}일이에요.`,
  });
}
