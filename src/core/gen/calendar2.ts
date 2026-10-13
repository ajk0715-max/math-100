import { WEEKDAYS_LONG, WEEKDAYS_SHORT, daysInMonth, weekdayOf } from '../dates';
import { dateKo, dateText, dayKo, josa, monthKo, withJosa } from '../ko';
import { chance, int, pick, sample, shuffle } from '../rng';
import type { CalMark, FamilyEvent, GenCtx, MatchPair, Option, OrderItem, Question, Visual } from '../types';
import { calOf, dayOpt, monthOpt, nearDays, others, wdOpt, yearFor } from './calendar';
import { buildChoice, mk, range, shuffleDiff } from './util';

const countOpt = (x: number, unit: string): Option => ({ key: String(x), text: `${x}${unit}`, say: `${x}${unit}` });
const weeksRow = (highlight?: number): Visual => ({ k: 'weekdays', names: 'short', ...(highlight === undefined ? {} : { highlight }) });

// ---------------------------------------------------------------------------
// 일주일은 7일
// ---------------------------------------------------------------------------

export function weekLenGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;

  if (L === 1) {
    const kind = pick(r, ['row', 'name', 'cal'] as const);
    const opts = [countOpt(5, '일'), countOpt(6, '일'), countOpt(10, '일')];
    if (kind === 'name') {
      return mk(c, {
        prompt: '일주일은 며칠일까요?',
        say: '일주일은 며칠일까요?',
        visual: weeksRow(),
        answer: buildChoice(r, countOpt(7, '일'), opts, 3),
        hint: { say: '일, 월, 화, 수, 목, 금, 토를 하나씩 세어 봐요.', visual: weeksRow() },
        explain: '일요일부터 토요일까지 7일이에요. 이 7일을 일주일이라고 해요.',
      });
    }
    if (kind === 'cal') {
      const { y, m } = c.today;
      return mk(c, {
        prompt: '달력의 가로 한 줄에는 며칠이 있을까요?',
        say: '달력의 가로 한 줄에는 며칠이 있을까요?',
        visual: calOf(y, m),
        answer: buildChoice(r, countOpt(7, '일'), opts, 3),
        hint: { say: '일요일부터 토요일까지 칸을 하나씩 세어 봐요.', visual: weeksRow() },
        explain: '한 줄에 일요일부터 토요일까지 7칸이 있어요. 한 줄이 일주일이에요.',
      });
    }
    return mk(c, {
      prompt: '일요일부터 토요일까지는 모두 며칠일까요?',
      say: '일요일부터 토요일까지는 모두 며칠일까요?',
      visual: weeksRow(),
      answer: buildChoice(r, countOpt(7, '일'), opts, 3),
      hint: { say: '요일 이름을 하나씩 짚으며 세어 봐요.', visual: weeksRow() },
      explain: '일요일부터 토요일까지 7일이에요. 이 7일을 일주일이라고 해요.',
    });
  }

  if (L === 2) {
    const wd = int(r, 0, 6);
    const later = chance(r, 0.5);
    const word = later ? '뒤' : '전';
    const topic = `일주일 ${word}${josa(word, '은/는')}`;
    return mk(c, {
      prompt: `오늘이 ${WEEKDAYS_LONG[wd]}이에요. ${topic} 무슨 요일일까요?`,
      say: `오늘이 ${WEEKDAYS_LONG[wd]}이에요. ${topic} 무슨 요일일까요?`,
      visual: weeksRow(wd),
      answer: buildChoice(r, wdOpt(wd), others(r, 7, [wd], 5).map(wdOpt), 3),
      hint: { say: '일주일은 7일이라서 7일이 지나면 같은 요일이 돌아와요.', visual: weeksRow(wd) },
      explain: `${topic} 같은 ${WEEKDAYS_LONG[wd]}이에요.`,
    });
  }

  const { y, m } = c.today;
  const dim = daysInMonth(y, m);
  if (chance(r, 0.2)) {
    return mk(c, {
      prompt: '2주일은 며칠일까요? 숫자를 눌러 알려 주세요.',
      say: '이 주일은 며칠일까요? 숫자를 눌러 알려 주세요.',
      answer: { t: 'number', correct: 14, maxDigits: 2 },
      hint: { say: '일주일이 7일이니까 7과 7을 더해 봐요.', visual: { k: 'eq', parts: ['7', '+', '7', '=', '?'] } },
      explain: '일주일이 두 번이면 7 + 7 = 14, 모두 14일이에요.',
    });
  }
  const later = chance(r, 0.6);
  const d = later ? int(r, 1, dim - 7) : int(r, 8, dim);
  const target = later ? d + 7 : d - 7;
  const word = later ? '뒤' : '전';
  const topic = `일주일 ${word}${josa(word, '은/는')}`;
  return mk(c, {
    prompt: `${m}월 ${d}일에서 ${topic} 며칠일까요? 달력에서 눌러 보세요.`,
    say: `${monthKo(m)} ${dayKo(d)}에서 ${topic} 며칠일까요? 달력에서 눌러 보세요.`,
    answer: { t: 'calTap', year: y, month: m, targets: [target], need: 'one', marks: { [d]: 'start' } },
    hint: { say: `일주일은 7일이에요. 같은 요일끼리는 세로줄이 같아서 바로 ${later ? '아래' : '위'} 칸이에요.`, visual: { k: 'calendar', year: y, month: m, highlightWeekday: weekdayOf(y, m, d), compact: true } },
    explain: `${topic} ${target}일이에요.`,
  });
}

// ---------------------------------------------------------------------------
// 한 달은 28~31일
// ---------------------------------------------------------------------------

export function monthLenGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;

  const readLast = (): Question => {
    const m = int(r, 1, 12);
    const y = yearFor(c, m);
    const dim = daysInMonth(y, m);
    const wrongs = [28, 29, 30, 31].filter((x) => x !== dim).map((x) => countOpt(x, '일'));
    return mk(c, {
      prompt: `${m}월은 며칠까지 있을까요? 달력의 마지막 날을 읽어 보세요.`,
      say: `${monthKo(m)}은 며칠까지 있을까요? 달력의 마지막 날을 읽어 보세요.`,
      visual: calOf(y, m),
      answer: buildChoice(r, countOpt(dim, '일'), wrongs, 3),
      hint: { say: '달력에서 가장 큰 숫자가 그 달의 마지막 날이에요.', visual: calOf(y, m, { [dim]: 'target' }) },
      explain: `${m}월의 마지막 날은 ${dim}일이니까 ${m}월은 ${dim}일까지 있어요.`,
    });
  };

  if (L === 1) return readLast();

  const monthsWith = (n: number): number[] => range(1, 12).filter((m) => daysInMonth(yearFor(c, m), m) === n);

  if (L === 2) {
    const want = pick(r, [31, 30]);
    const right = pick(r, monthsWith(want));
    const wrongPool = range(1, 12).filter((m) => daysInMonth(yearFor(c, m), m) !== want);
    const wrongs = sample(r, wrongPool, 3);
    const y = yearFor(c, right);
    return mk(c, {
      prompt: `${want}일까지 있는 달은 어느 달일까요?`,
      say: `${want}일까지 있는 달은 어느 달일까요?`,
      answer: buildChoice(r, monthOpt(right), wrongs.map(monthOpt), 3),
      hint: { say: '달력을 펼쳐서 마지막 날을 읽어 봐요.', visual: calOf(y, right, { [want]: 'target' }) },
      explain: `${right}월은 ${want}일까지 있어요.`,
    });
  }

  const roll = r();
  if (roll < 0.34) {
    const opts: Option[] = [
      { key: '7', text: '7일쯤', say: '칠 일쯤' },
      { key: '30', text: '30일쯤', say: '삼십 일쯤' },
      { key: '100', text: '100일쯤', say: '백 일쯤' },
      { key: '365', text: '365일쯤', say: '삼백육십오 일쯤' },
    ];
    return mk(c, {
      prompt: '한 달은 며칠쯤일까요?',
      say: '한 달은 며칠쯤일까요?',
      answer: buildChoice(r, opts[1] as Option, [opts[0] as Option, opts[2] as Option, opts[3] as Option], 3),
      hint: { say: '달력 한 장이 한 달이에요. 마지막 날이 28일에서 31일 사이였어요.' },
      explain: '한 달은 28일에서 31일까지로, 30일쯤이에요.',
    });
  }
  if (roll < 0.67) {
    const less = range(1, 12).filter((m) => daysInMonth(yearFor(c, m), m) < 30);
    const wrongs = sample(r, range(1, 12).filter((m) => !less.includes(m)), 3);
    return mk(c, {
      prompt: '날수가 가장 적은 달은 어느 달일까요?',
      say: '날수가 가장 적은 달은 어느 달일까요?',
      answer: buildChoice(r, monthOpt(2), wrongs.map(monthOpt), 3),
      hint: { say: '달력의 마지막 날이 28일이나 29일인 달이에요.', visual: calOf(yearFor(c, 2), 2) },
      explain: `2월은 ${daysInMonth(yearFor(c, 2), 2)}일까지라서 날수가 가장 적어요.`,
    });
  }
  const y = yearFor(c, 2);
  const dim = daysInMonth(y, 2);
  return mk(c, {
    prompt: '2월은 며칠까지 있을까요?',
    say: '이월은 며칠까지 있을까요?',
    visual: calOf(y, 2),
    answer: buildChoice(r, countOpt(dim, '일'), [28, 29, 30, 31].filter((x) => x !== dim).map((x) => countOpt(x, '일')), 3),
    hint: { say: '달력에서 가장 큰 숫자가 마지막 날이에요.', visual: calOf(y, 2, { [dim]: 'target' }) },
    explain: `2월의 마지막 날은 ${dim}일이에요.`,
  });
}

// ---------------------------------------------------------------------------
// 일 년은 12개월
// ---------------------------------------------------------------------------

export function yearLenGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;

  if (L === 1) {
    return mk(c, {
      prompt: '일 년은 몇 개월일까요?',
      say: '일 년은 몇 개월일까요?',
      visual: { k: 'months' },
      answer: buildChoice(r, countOpt(12, '개월'), [countOpt(10, '개월'), countOpt(7, '개월'), countOpt(30, '개월')], 3),
      hint: { say: '1월부터 12월까지 달을 하나씩 세어 봐요.', visual: { k: 'months' } },
      explain: '1월부터 12월까지 12개월이에요. 12개월이 일 년이에요.',
    });
  }

  if (L === 2) {
    const next = chance(r, 0.5);
    // 12월과 1월(해가 바뀌는 곳)이 자주 나오게 한다
    const base = chance(r, 0.3) ? (next ? 12 : 1) : int(r, 1, 12);
    const ans = next ? (base % 12) + 1 : ((base + 10) % 12) + 1;
    return mk(c, {
      prompt: `${base}월의 바로 ${next ? '다음' : '전'} 달은 몇 월일까요?`,
      say: `${monthKo(base)}의 바로 ${next ? '다음' : '전'} 달은 몇 월일까요?`,
      visual: { k: 'months', highlight: base },
      answer: buildChoice(r, monthOpt(ans), others(r, 12, [ans - 1, base - 1], 4).map((i) => monthOpt(i + 1)), 3),
      hint: {
        say:
          base === 12 && next
            ? '12월이 지나면 새해가 시작되어 1월이 다시 와요.'
            : base === 1 && !next
              ? '1월의 전 달은 지난해의 마지막 달이에요.'
              : '1월부터 12월까지 순서대로 이어져요.',
        visual: { k: 'months', highlight: base },
      },
      explain: `${base}월의 ${next ? '다음' : '전'} 달은 ${ans}월이에요.`,
    });
  }

  if (chance(r, 0.5)) {
    const pairs: MatchPair[] = [
      { key: 'week', a: { text: '일주일' }, b: { text: '7일' } },
      { key: 'month', a: { text: '한 달' }, b: { text: '30일쯤' } },
      { key: 'year', a: { text: '일 년' }, b: { text: '12개월' } },
    ];
    return mk(c, {
      prompt: '기간과 알맞은 길이를 이어 보세요.',
      say: '기간과 알맞은 길이를 이어 보세요.',
      answer: { t: 'match', pairs },
      hint: { say: '달력 한 줄이 일주일, 달력 한 장이 한 달, 달력 열두 장이 일 년이에요.' },
      explain: '일주일은 7일, 한 달은 30일쯤, 일 년은 12개월이에요.',
    });
  }
  const m = int(r, 3, 10);
  const left = 12 - m;
  return mk(c, {
    prompt: `지금은 ${m}월이에요. 12월이 되려면 몇 개월이 더 지나야 할까요?`,
    say: `지금은 ${monthKo(m)}이에요. 십이월이 되려면 몇 개월이 더 지나야 할까요?`,
    visual: { k: 'months', highlight: m },
    answer: buildChoice(r, countOpt(left, '개월'), [left - 1, left + 1, left + 2, left - 2].filter((x) => x >= 1 && x !== left).map((x) => countOpt(x, '개월')), 3),
    hint: { say: `${m}월 다음 달부터 12월까지 한 달씩 세어 봐요.`, visual: { k: 'months', highlight: m } },
    explain: `${m}월에서 12월까지는 ${left}개월이 남았어요.`,
  });
}

// ---------------------------------------------------------------------------
// 가족 기념일 찾기
// ---------------------------------------------------------------------------

const HOLIDAYS: FamilyEvent[] = [
  { id: 'h-samil', label: '삼일절', month: 3, day: 1, kind: 'holiday' },
  { id: 'h-children', label: '어린이날', month: 5, day: 5, kind: 'holiday' },
  { id: 'h-liberation', label: '광복절', month: 8, day: 15, kind: 'holiday' },
  { id: 'h-gaecheon', label: '개천절', month: 10, day: 3, kind: 'holiday' },
  { id: 'h-hangul', label: '한글날', month: 10, day: 9, kind: 'holiday' },
  { id: 'h-xmas', label: '크리스마스', month: 12, day: 25, kind: 'holiday' },
];

const dateKey = (e: FamilyEvent): string => `${e.month}-${e.day}`;

interface EventPool {
  fam: FamilyEvent[];
  all: FamilyEvent[];
}

/** 부모가 넣은 가족 행사(그해 달력에 있는 날만)와 기본 기념일 */
export function eventPool(c: GenCtx): EventPool {
  const fam: FamilyEvent[] = [];
  const seen = new Set<string>();
  for (const e of c.events) {
    if (e.month < 1 || e.month > 12 || e.day < 1 || e.day > daysInMonth(yearFor(c, e.month), e.month)) continue;
    const label = (e.label ?? '').trim().slice(0, 10) || '기념일';
    const clean: FamilyEvent = { ...e, label };
    if (seen.has(dateKey(clean))) continue;
    seen.add(dateKey(clean));
    fam.push(clean);
  }
  const all = [...fam, ...HOLIDAYS.filter((h) => !seen.has(dateKey(h)))];
  return { fam, all };
}

const pickEvent = (r: GenCtx['rng'], pool: EventPool): FamilyEvent => (pool.fam.length > 0 && chance(r, 0.7) ? pick(r, pool.fam) : pick(r, pool.all));

const evText = (e: FamilyEvent): string => `${e.label} · ${e.month}월 ${e.day}일`;
const evSay = (e: FamilyEvent): string => `${e.label}, ${dateKo(e.month, e.day)}`;

export function eventGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  const pool = eventPool(c);

  if (L === 3) {
    const picked: FamilyEvent[] = [];
    const used = new Set<string>();
    const order = shuffle(r, [...pool.fam, ...pool.all]);
    for (const e of order) {
      if (used.has(dateKey(e))) continue;
      used.add(dateKey(e));
      picked.push(e);
      if (picked.length === 3) break;
    }
    const sorted = [...picked].sort((a, b) => a.month - b.month || a.day - b.day);
    if (chance(r, 0.5) || picked.length < 3) {
      const [a, b] = picked.slice(0, 2) as [FamilyEvent, FamilyEvent];
      const first = a.month < b.month || (a.month === b.month && a.day < b.day) ? a : b;
      const second = first === a ? b : a;
      const opt = (e: FamilyEvent): Option => ({ key: e.id, text: evText(e), say: evSay(e) });
      return mk(c, {
        prompt: '일 년 중에서 어느 날이 더 먼저 올까요?',
        say: '일 년 중에서 어느 날이 더 먼저 올까요?',
        answer: buildChoice(r, opt(first), [opt(second)], 2, 1),
        hint: { say: '달 숫자가 작을수록 먼저 와요. 달이 같으면 날짜가 작은 쪽이 먼저예요.', visual: { k: 'months' } },
        explain: `${evText(first)}이 ${evText(second)}보다 먼저 와요.`,
      });
    }
    const items: OrderItem[] = picked.map((e) => ({ key: e.id, text: evText(e), say: evSay(e) }));
    const correct = sorted.map((e) => e.id);
    return mk(c, {
      prompt: '일 년 중에서 먼저 오는 날부터 차례대로 눌러 보세요.',
      say: '일 년 중에서 먼저 오는 날부터 차례대로 눌러 보세요.',
      answer: { t: 'order', items: shuffleDiff(r, items, correct), correct, style: 'cards' },
      hint: { say: '달 숫자가 작을수록 먼저 와요. 달이 같으면 날짜가 작은 쪽이 먼저예요.', visual: { k: 'months' } },
      explain: `${sorted.map((e) => `${e.month}월 ${e.day}일`).join(', ')} 순서예요.`,
    });
  }

  const ev = pickEvent(r, pool);
  const year = yearFor(c, ev.month);
  const dim = daysInMonth(year, ev.month);
  const wd = weekdayOf(year, ev.month, ev.day);
  const marks: Record<number, CalMark> = { [ev.day]: 'event' };

  if (L === 1) {
    return mk(c, {
      prompt: `${ev.month}월 달력에 ${withJosa(ev.label, '이/가')} 표시되어 있어요. 며칠일까요?`,
      say: `${monthKo(ev.month)} 달력에 ${withJosa(ev.label, '이/가')} 표시되어 있어요. 며칠일까요?`,
      visual: calOf(year, ev.month, marks),
      answer: buildChoice(r, dayOpt(ev.day), nearDays(ev.day, dim), 3),
      hint: { say: '표시된 칸 안의 숫자를 읽어 봐요.', visual: calOf(year, ev.month, marks) },
      explain: `${withJosa(ev.label, '은/는')} ${dateText(ev.month, ev.day)}이에요.`,
    });
  }
  if (chance(r, 0.5)) {
    return mk(c, {
      prompt: `${withJosa(ev.label, '은/는')} ${dateText(ev.month, ev.day)}이에요. 달력에서 그날을 찾아 눌러 보세요.`,
      say: `${withJosa(ev.label, '은/는')} ${dateKo(ev.month, ev.day)}이에요. 달력에서 그날을 찾아 눌러 보세요.`,
      answer: { t: 'calTap', year, month: ev.month, targets: [ev.day], need: 'one' },
      hint: { say: '숫자가 작은 날은 위쪽, 큰 날은 아래쪽에 있어요.' },
      explain: `${ev.day}일은 여기에 있어요.`,
    });
  }
  return mk(c, {
    prompt: `${withJosa(ev.label, '은/는')} ${dateText(ev.month, ev.day)}이에요. 그날은 무슨 요일일까요?`,
    say: `${withJosa(ev.label, '은/는')} ${dateKo(ev.month, ev.day)}이에요. 그날은 무슨 요일일까요?`,
    visual: calOf(year, ev.month, marks),
    answer: buildChoice(r, wdOpt(wd), others(r, 7, [wd], 5).map(wdOpt), 3),
    hint: { say: '표시된 날에서 위로 올라가 요일 이름을 읽어요.', visual: calOf(year, ev.month, marks) },
    explain: `${withJosa(ev.label, '은/는')} ${WEEKDAYS_LONG[wd]}이에요.`,
  });
}

/** 보너스 게임: 기념일 보물찾기(달력에서 누르기) */
export function eventHuntGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  const pool = eventPool(c);
  const ev = pickEvent(r, pool);
  const year = yearFor(c, ev.month);
  const dim = daysInMonth(year, ev.month);
  const wd = weekdayOf(year, ev.month, ev.day);

  if (L === 1) {
    return mk(c, {
      prompt: `${withJosa(ev.label, '은/는')} ${dateText(ev.month, ev.day)}이에요. 달력에서 그날을 찾아 눌러 보세요.`,
      say: `${withJosa(ev.label, '은/는')} ${dateKo(ev.month, ev.day)}이에요. 달력에서 그날을 찾아 눌러 보세요.`,
      answer: { t: 'calTap', year, month: ev.month, targets: [ev.day], need: 'one' },
      hint: { say: '숫자가 작은 날은 위쪽, 큰 날은 아래쪽에 있어요.' },
      explain: `${ev.day}일은 여기에 있어요.`,
    });
  }
  if (L === 2) {
    const after = ev.day < dim && (chance(r, 0.5) || ev.day === 1);
    const target = after ? ev.day + 1 : ev.day - 1;
    return mk(c, {
      prompt: `${withJosa(ev.label, '은/는')} ${dateText(ev.month, ev.day)}이에요. 그 ${after ? '다음' : '전'} 날을 찾아 눌러 보세요.`,
      say: `${withJosa(ev.label, '은/는')} ${dateKo(ev.month, ev.day)}이에요. 그 ${after ? '다음' : '전'} 날을 찾아 눌러 보세요.`,
      answer: { t: 'calTap', year, month: ev.month, targets: [target], need: 'one', marks: { [ev.day]: 'event' } },
      hint: { say: after ? '다음 날은 바로 오른쪽 칸이에요.' : '전 날은 바로 왼쪽 칸이에요.' },
      explain: `${after ? '다음' : '전'} 날은 ${target}일이에요.`,
    });
  }
  const same: number[] = [];
  for (let d = 1; d <= dim; d++) if (weekdayOf(year, ev.month, d) === wd && d !== ev.day) same.push(d);
  return mk(c, {
    prompt: `${withJosa(ev.label, '과/와')} 같은 요일인 날을 모두 찾아 눌러 보세요.`,
    say: `${withJosa(ev.label, '과/와')} 같은 요일인 날을 모두 찾아 눌러 보세요.`,
    answer: { t: 'calTap', year, month: ev.month, targets: same, need: 'all', marks: { [ev.day]: 'event' } },
    hint: { say: '표시된 날과 같은 세로줄의 칸이 모두 같은 요일이에요.', visual: { k: 'calendar', year, month: ev.month, highlightWeekday: wd, compact: true } },
    explain: `같은 요일인 날은 ${same.join(', ')}일이에요.`,
  });
}

// ---------------------------------------------------------------------------
// 며칠 뒤 세어 보기
// ---------------------------------------------------------------------------

function laterMarks(d: number, n: number): Record<number, CalMark> {
  const marks: Record<number, CalMark> = { [d]: 'today' };
  const step = n > 0 ? 1 : -1;
  for (let k = step; Math.abs(k) < Math.abs(n); k += step) marks[d + k] = 'range';
  marks[d + n] = 'target';
  return marks;
}

export function laterGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  const { y, m } = c.today;
  const dim = daysInMonth(y, m);

  if (L === 1) {
    const n = int(r, 1, 3);
    const d = int(r, 2, dim - n);
    return mk(c, {
      prompt: `빨간 칸이 오늘이에요. ${n}일 뒤는 며칠일까요? 달력에서 눌러 보세요.`,
      say: `빨간 칸이 오늘이에요. ${n}일 뒤는 며칠일까요? 달력에서 눌러 보세요.`,
      answer: { t: 'calTap', year: y, month: m, targets: [d + n], need: 'one', marks: { [d]: 'today' } },
      hint: { say: `오늘 다음 칸부터 ${n}칸을 세어 봐요.`, visual: calOf(y, m, laterMarks(d, n)) },
      explain: `오늘이 ${d}일이니까 ${n}일 뒤는 ${d + n}일이에요.`,
    });
  }

  if (L === 2) {
    const n = int(r, 4, 7);
    const d = int(r, 1, dim - n);
    const wd = weekdayOf(y, m, d);
    if (chance(r, 0.5)) {
      return mk(c, {
        prompt: `오늘은 ${d}일이에요. ${n}일 뒤는 며칠일까요?`,
        say: `오늘은 ${dayKo(d)}이에요. ${n}일 뒤는 며칠일까요?`,
        visual: calOf(y, m, { [d]: 'today' }),
        answer: buildChoice(r, dayOpt(d + n), nearDays(d + n, dim), 3),
        hint: { say: `오늘 다음 칸부터 ${n}칸을 세어 봐요.`, visual: calOf(y, m, laterMarks(d, n)) },
        explain: `${d}일에서 ${n}일 뒤는 ${d + n}일이에요.`,
      });
    }
    const target = (wd + n) % 7;
    return mk(c, {
      prompt: `오늘은 ${d}일 ${WEEKDAYS_LONG[wd]}이에요. ${n}일 뒤는 무슨 요일일까요?`,
      say: `오늘은 ${dayKo(d)} ${WEEKDAYS_LONG[wd]}이에요. ${n}일 뒤는 무슨 요일일까요?`,
      visual: calOf(y, m, { [d]: 'today' }),
      answer: buildChoice(r, wdOpt(target), others(r, 7, [target], 5).map(wdOpt), 3),
      hint: { say: `${WEEKDAYS_LONG[wd]}에서 요일을 ${n}번 세어 봐요.`, visual: calOf(y, m, laterMarks(d, n)) },
      explain: `${WEEKDAYS_LONG[wd]}에서 ${n}일 뒤는 ${WEEKDAYS_LONG[target]}이에요.`,
    });
  }

  const kind = pick(r, ['모레', '그저께', '전', '뒤'] as const);
  if (kind === '모레' || kind === '그저께') {
    const after = kind === '모레';
    const d = after ? int(r, 1, dim - 2) : int(r, 3, dim);
    const target = after ? d + 2 : d - 2;
    return mk(c, {
      prompt: `오늘이 ${d}일이에요. ${kind}는 며칠일까요?`,
      say: `오늘이 ${dayKo(d)}이에요. ${kind}는 며칠일까요?`,
      visual: calOf(y, m, { [d]: 'today' }),
      answer: buildChoice(r, dayOpt(target), nearDays(target, dim), 3),
      hint: { say: after ? '내일의 다음 날이 모레예요. 오늘에서 이틀 뒤예요.' : '어제의 전 날이 그저께예요. 오늘에서 이틀 전이에요.', visual: calOf(y, m, laterMarks(d, after ? 2 : -2)) },
      explain: `${kind}는 ${target}일이에요.`,
    });
  }
  const n = int(r, 3, 9);
  const after = kind === '뒤';
  const d = after ? int(r, 1, dim - n) : int(r, n + 1, dim);
  const target = after ? d + n : d - n;
  return mk(c, {
    prompt: `${d}일에서 ${n}일 ${kind}는 며칠일까요?`,
    say: `${dayKo(d)}에서 ${n}일 ${kind}는 며칠일까요?`,
    visual: calOf(y, m, { [d]: 'start' }),
    answer: buildChoice(r, dayOpt(target), nearDays(target, dim), 3),
    hint: { say: after ? `${d}일 다음 칸부터 ${n}칸을 세어 봐요.` : `${d}일 전 칸부터 거꾸로 ${n}칸을 세어 봐요.`, visual: calOf(y, m, laterMarks(d, after ? n : -n)) },
    explain: `${d}일에서 ${n}일 ${kind}는 ${target}일이에요.`,
  });
}

/** 보너스 게임: 며칠 뒤 날짜를 달력에서 찾기 */
export function laterHuntGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  const { y, m } = c.today;
  const dim = daysInMonth(y, m);
  const n = L === 1 ? int(r, 1, 3) : L === 2 ? int(r, 3, 7) : int(r, 5, 10);
  const after = L < 3 || chance(r, 0.6);
  const d = after ? int(r, 1, dim - n) : int(r, n + 1, dim);
  const target = after ? d + n : d - n;
  return mk(c, {
    prompt: `${m}월 ${d}일에서 ${n}일 ${after ? '뒤' : '전'}를 찾아 눌러 보세요.`,
    say: `${monthKo(m)} ${dayKo(d)}에서 ${n}일 ${after ? '뒤' : '전'}를 찾아 눌러 보세요.`,
    answer: { t: 'calTap', year: y, month: m, targets: [target], need: 'one', marks: { [d]: 'start' } },
    hint: { say: after ? `${d}일 다음 칸부터 ${n}칸을 세어 봐요.` : `${d}일 전 칸부터 거꾸로 ${n}칸을 세어 봐요.`, visual: calOf(y, m, laterMarks(d, after ? n : -n)) },
    explain: `${n}일 ${after ? '뒤' : '전'}는 ${target}일이에요.`,
  });
}

// ---------------------------------------------------------------------------
// 보너스 게임: 일주일 기차, 열두 달 기차(돌아 이어지는 순서)
// ---------------------------------------------------------------------------

export function weekLoopTrainGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  const len = L === 1 ? 4 : L === 2 ? 5 : 7;
  const start = int(r, 0, 6);
  const days = Array.from({ length: len }, (_, i) => (start + i) % 7);
  const items: OrderItem[] = days.map((d) => ({ key: `w${d}`, text: WEEKDAYS_SHORT[d] as string, say: WEEKDAYS_LONG[d] as string }));
  const correct = days.map((d) => `w${d}`);
  const text = `${WEEKDAYS_LONG[start]}부터 시작하는 기차예요. 칸을 앞에서부터 차례대로 눌러 보세요.`;
  return mk(c, {
    prompt: text,
    say: text,
    answer: { t: 'order', items: shuffleDiff(r, items, correct), correct, style: 'train' },
    hint: { say: '토요일 다음에는 다시 일요일이 와요. 일주일은 빙 돌아 이어져요.', visual: { k: 'weekdays', names: 'short', highlight: start } },
    explain: `${days.map((d) => WEEKDAYS_LONG[d]).join(', ')} 순서예요.`,
  });
}

export function monthLoopTrainGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  const len = L === 1 ? 4 : L === 2 ? 5 : 7;
  const start = int(r, 1, 12);
  const months = Array.from({ length: len }, (_, i) => ((start - 1 + i) % 12) + 1);
  const items: OrderItem[] = months.map((m) => ({ key: `m${m}`, text: `${m}월`, say: monthKo(m) }));
  const correct = months.map((m) => `m${m}`);
  const text = `${start}월부터 시작하는 기차예요. 칸을 앞에서부터 차례대로 눌러 보세요.`;
  return mk(c, {
    prompt: text,
    say: `${monthKo(start)}부터 시작하는 기차예요. 칸을 앞에서부터 차례대로 눌러 보세요.`,
    answer: { t: 'order', items: shuffleDiff(r, items, correct), correct, style: 'train' },
    hint: { say: '12월 다음에는 새해 1월이 와요. 열두 달은 빙 돌아 이어져요.', visual: { k: 'months', highlight: start } },
    explain: `${months.map((m) => `${m}월`).join(', ')} 순서예요.`,
  });
}

