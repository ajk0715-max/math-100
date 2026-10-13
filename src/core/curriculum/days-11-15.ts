import { daysInMonth } from '../dates';
import { josa } from '../ko';
import type { Visual } from '../types';
import type { DayDef } from './types';

const clock = (h: number, m: number, extra: Partial<Extract<Visual, { k: 'clock' }>> = {}): Visual => ({ k: 'clock', h, m, numbers: true, size: 'md', ...extra });
const digital = (h: number, m: number): Visual => ({ k: 'digital', h, m });
const eq = (parts: string[], tone: 'sky' | 'tangerine' | 'grape' = 'sky'): Visual => ({ k: 'eq', parts, tone });
const tens = (t: number, o: number, caption = true): Visual => ({ k: 'tens', tens: t, ones: o, caption });
const coins = (c: number[]): Visual => ({ k: 'coins', coins: c });
const row = (items: Visual[], gap = 14): Visual => ({ k: 'row', items, gap, wrap: true });
const frame = (emoji: string, n: number, layout: 'frame10' | 'frame20' = 'frame20'): Visual => ({ k: 'objects', emoji, n, layout });

/** 블록 11~15 (Day 51~75, 보스 날 제외) */
export const DAYS_11_15: DayDef[] = [
  // ───────── 블록 11: 스무 개까지 ─────────
  {
    day: 51,
    kind: 'math',
    title: '열 다음에도 세어요',
    buddy: 'bear',
    intro: [
      {
        text: '10개를 한 줄에 가득 채우고 1개를 더하면 11이야. 10 다음에도 이어서 세면 12, 13, 14가 돼.',
        visual: frame('🍪', 11),
      },
      {
        text: '11부터 19까지는 10과 몇으로 이루어져 있어. 10과 3을 합치면 13이야.',
        visual: { k: 'bond', total: 13, a: 10, b: 3 },
      },
      {
        text: '19 다음은 20이야. 한 줄이 두 번 가득 차면 20이 돼.',
        visual: frame('🍪', 20),
      },
    ],
    explore: [
      { skill: 'num.count20', n: 5 },
      { skill: 'num.teen', n: 5 },
    ],
    game: { skill: 'game.fish.20', levels: [1, 1, 2, 2, 3] },
    tip: '과자나 구슬 20개를 10개씩 두 줄로 놓고 "열하나, 열둘" 하며 같이 세어 보세요. 10개가 한 줄을 채우면 "십"이라고 말해 주면 돼요.',
  },
  {
    day: 52,
    kind: 'math',
    title: '20까지 순서와 크기',
    buddy: 'bear',
    intro: [
      {
        text: '수는 하나씩 커지면서 이어져. 14 다음은 15, 19 다음은 20이야. 15 바로 앞의 수는 14야.',
        visual: { k: 'numberLine', from: 10, to: 20, marks: [15] },
      },
      {
        text: '10개 묶음이 하나씩일 때는 낱개가 많은 쪽이 더 커. 18은 14보다 커.',
        visual: row([tens(1, 8), tens(1, 4)], 18),
      },
    ],
    explore: [
      { skill: 'num.order20', n: 5 },
      { skill: 'num.compare20', n: 5 },
    ],
    game: { skill: 'game.stones.20', levels: [1, 1, 2, 2, 3] },
    tip: '계단이나 엘리베이터 층수를 보며 "14 다음은 몇이야?", "13과 17 중에 어느 쪽이 더 커?" 하고 물어보세요.',
  },
  {
    day: 53,
    kind: 'life',
    title: '디지털 시계 읽기',
    buddy: 'owl',
    intro: [
      {
        text: '디지털 시계는 숫자로 시각을 알려 줘. 점 두 개 앞의 숫자가 시이고, 뒤의 숫자가 분이야. 뒤가 00이면 몇 시 정각이야.',
        visual: digital(2, 0),
      },
      {
        text: '뒤의 숫자가 30이면 몇 시 30분이야. 7시 30분은 시계에서 긴바늘이 6에 있어.',
        visual: row([clock(7, 30, { size: 'sm' }), digital(7, 30)], 16),
      },
    ],
    explore: [
      { skill: 'clk.digital.hour', n: 5 },
      { skill: 'clk.digital.half', n: 5 },
    ],
    game: { skill: 'game.balloons.digital', levels: [1, 1, 2, 2, 3] },
    tip: '전자레인지, 휴대폰, 자동차처럼 디지털 시계를 볼 때마다 "지금 몇 시야?" 하고 읽어 보게 해 주세요. 점 두 개 뒤가 00인지 30인지 먼저 보게 하면 쉬워요.',
  },
  {
    day: 54,
    kind: 'life',
    title: '두 시계 짝 맞추기',
    buddy: 'owl',
    intro: [
      {
        text: '같은 시각도 두 가지 시계로 보여. 긴바늘이 12에 있고 짧은바늘이 4를 가리키면, 디지털 시계도 4시 정각을 보여 줘.',
        visual: row([clock(4, 0, { size: 'sm' }), digital(4, 0)], 16),
      },
      {
        text: '긴바늘이 6에 있고 짧은바늘이 4를 막 지났으면 4시 30분이야. 디지털 시계는 4와 30을 보여 줘.',
        visual: row([clock(4, 30, { size: 'sm' }), digital(4, 30)], 16),
      },
    ],
    explore: [
      { skill: 'clk.digital.pick', n: 4 },
      { skill: 'clk.match.mix', n: 3 },
      { skill: 'clk.set.digital', n: 3 },
    ],
    game: { skill: 'game.clockMatch.digital', levels: [1, 1, 2, 2, 3] },
    tip: '벽시계와 휴대폰 시계를 나란히 두고 "같은 시각일까?" 하고 비교해 보게 해 주세요. 시계 바늘을 보고 디지털로 말해 보는 놀이도 좋아요.',
  },

  // ───────── 블록 12: 쉰까지, 묶음과 낱개 ─────────
  {
    day: 56,
    kind: 'math',
    title: '10개씩 묶어서 세어요',
    buddy: 'bear',
    intro: [
      {
        text: '많을 때는 10개씩 묶어서 세면 빨라. 10개 묶음이 2개면 20, 3개면 30, 4개면 40, 5개면 50이야.',
        visual: tens(3, 0),
      },
      {
        text: '20처럼 끝에 0이 있으면 낱개가 하나도 없다는 뜻이야. 30은 묶음 3개, 40은 묶음 4개야.',
        visual: tens(2, 0),
      },
    ],
    explore: [
      { skill: 'num.count50', n: 4 },
      { skill: 'num.tens50', n: 6 },
    ],
    game: { skill: 'game.fish.50', levels: [1, 1, 2, 2, 3] },
    tip: '콩이나 블록을 10개씩 묶어 놓고 "묶음이 3개면 몇 개야?" 하고 세어 보게 해 주세요. 10개씩 세면 얼마나 빠른지 느끼게 돼요.',
  },
  {
    day: 57,
    kind: 'math',
    title: '묶음과 낱개로 수 읽기',
    buddy: 'bear',
    intro: [
      {
        text: '10개 묶음 2개와 낱개 3개는 모두 23개야. 묶음 수를 앞에, 낱개 수를 뒤에 쓰면 23이 돼.',
        visual: tens(2, 3),
      },
      {
        text: '23은 스물셋 또는 이십삼이라고 읽어. 10개 묶음 4개와 낱개 8개를 합치면 48이야.',
        say: '스물셋은 이십삼이라고도 읽어. 열 개 묶음 네 개와 낱개 여덟 개를 합치면 사십팔이야.',
        visual: tens(4, 8),
      },
    ],
    explore: [
      { skill: 'num.tensOnes50', n: 5 },
      { skill: 'num.read50', n: 5 },
    ],
    game: { skill: 'game.bundle.a', levels: [1, 1, 2, 2, 3] },
    tip: '과자 27개를 10개씩 묶어 놓고 "묶음이 몇 개, 낱개가 몇 개야?" 하고 물어보세요. 스물일곱과 이십칠을 둘 다 말해 주면 좋아요.',
  },
  {
    day: 58,
    kind: 'life',
    title: '일주일과 한 달',
    buddy: 'mole',
    intro: (env) => [
      {
        text: '일요일부터 토요일까지 7일을 일주일이라고 해. 달력의 가로 한 줄이 일주일이야.',
        visual: { k: 'weekdays', names: 'short' },
      },
      {
        text: '한 달은 28일에서 31일까지 있어. 한 달 동안 일주일이 네 번쯤 지나가.',
        visual: { k: 'calendar', year: env.today.y, month: env.today.m, compact: true },
      },
    ],
    explore: [
      { skill: 'cal.weekLen', n: 5 },
      { skill: 'cal.monthLen', n: 5 },
    ],
    game: { skill: 'game.weekLoop', levels: [1, 1, 2, 2, 3] },
    tip: '달력을 보며 "오늘부터 일주일 뒤는 무슨 요일이야?" 하고 물어보세요. 같은 요일은 달력에서 세로로 줄지어 있다는 것도 알려 주세요.',
  },
  {
    day: 59,
    kind: 'life',
    title: '일 년은 열두 달',
    buddy: 'mole',
    intro: [
      {
        text: '일 년은 12개월이야. 1월부터 12월까지 지나면 새해가 되어서 다시 1월이 와.',
        visual: { k: 'months' },
      },
      {
        text: '달마다 날 수가 달라. 2월은 28일까지로 가장 짧고, 9월은 30일까지, 12월은 31일까지 있어.',
        visual: { k: 'months', highlight: 2 },
      },
    ],
    explore: [
      { skill: 'cal.yearLen', n: 5 },
      { skill: 'cal.monthLen', n: 3 },
      { skill: 'cal.weekLen', n: 2 },
    ],
    game: { skill: 'game.monthLoop', levels: [1, 1, 2, 2, 3] },
    tip: '생일이 몇 월인지, 오늘이 몇 월인지 말해 보게 해 주세요. 12월 31일 다음 날이 1월 1일이라는 이야기를 해 주면 좋아요.',
  },

  // ───────── 블록 13: 뛰어 세기와 며칠 뒤 ─────────
  {
    day: 61,
    kind: 'math',
    title: '50까지 순서와 크기',
    buddy: 'bear',
    intro: [
      {
        text: '수 배열표에서는 오른쪽으로 한 칸 가면 1 커지고, 아래로 한 칸 가면 10 커져.',
        say: '수 배열표에서는 오른쪽으로 한 칸 가면 하나 커지고, 아래로 한 칸 가면 열이 커져.',
        visual: { k: 'chart', from: 1, to: 50, cols: 10, marks: [13, 23] },
      },
      {
        text: '수를 비교할 때는 10개 묶음부터 봐. 묶음이 많은 쪽이 더 커. 34는 묶음이 3개, 29는 2개라서 34가 더 커.',
        visual: row([tens(3, 4), tens(2, 9)], 18),
      },
    ],
    explore: [
      { skill: 'num.order50', n: 5 },
      { skill: 'num.compare50', n: 5 },
    ],
    game: { skill: 'game.stones.50', levels: [1, 1, 2, 2, 3] },
    tip: '엘리베이터 층수나 달력 날짜로 "35 다음은 몇이야?", "29와 31 중 어느 쪽이 커?" 하고 놀이처럼 물어보세요.',
  },
  {
    day: 62,
    kind: 'math',
    title: '뛰어 세기',
    buddy: 'bear',
    intro: [
      {
        text: '10씩 뛰어 세면 10, 20, 30, 40, 50이야. 한 번 뛸 때마다 10씩 커져.',
        visual: { k: 'stones', seq: [10, 20, 30, 40, 50] },
      },
      {
        text: '5씩 뛰어 세면 5, 10, 15, 20, 25야. 2씩 뛰어 세면 2, 4, 6, 8, 10이야.',
        visual: {
          k: 'col',
          items: [
            { k: 'stones', seq: [5, 10, 15, 20, 25] },
            { k: 'stones', seq: [2, 4, 6, 8, 10] },
          ],
          gap: 10,
        },
      },
    ],
    explore: [
      { skill: 'num.skip.a', n: 5 },
      { skill: 'num.skip.b', n: 5 },
    ],
    game: { skill: 'game.stones.skip', levels: [1, 1, 2, 2, 3] },
    tip: '계단을 오르며 2씩 또는 5씩 뛰어 세어 보세요. 손가락 다섯 개를 펴고 "5, 10, 15" 하고 세는 놀이도 좋아요.',
  },
  {
    day: 63,
    kind: 'life',
    title: '가족 기념일 찾기',
    buddy: 'mole',
    intro: (env) => {
      const ev = env.events[0] ?? { label: '크리스마스', month: 12, day: 25 };
      const past = ev.month < env.today.m || (ev.month === env.today.m && ev.day < env.today.d);
      const year = past ? env.today.y + 1 : env.today.y;
      return [
        {
          text: `${ev.label}${josa(ev.label, '은/는')} ${ev.month}월 ${ev.day}일이야. 달력에서 그날을 찾아볼까?`,
          visual: { k: 'calendar', year, month: ev.month, marks: { [ev.day]: 'event' }, compact: true },
        },
        {
          text: '일 년 중에는 달 숫자가 작을수록 먼저 와. 3월 1일은 10월 3일보다 먼저야. 달이 같으면 날짜가 작은 쪽이 먼저야.',
          visual: { k: 'months', highlight: ev.month },
        },
      ];
    },
    explore: [
      { skill: 'cal.event', n: 8 },
      { skill: 'cal.yearLen', n: 2 },
    ],
    game: { skill: 'game.dateHunt.event', levels: [1, 1, 2, 2, 3] },
    tip: '가족 생일을 달력에 동그라미로 표시해 보세요. 누구 생일이 먼저 오는지, 몇 번 자면 생일인지 같이 세어 보면 좋아요.',
  },
  {
    day: 64,
    kind: 'life',
    title: '며칠 뒤 세어 보기',
    buddy: 'mole',
    intro: (env) => {
      const d0 = Math.min(env.today.d, daysInMonth(env.today.y, env.today.m) - 7);
      const base = { k: 'calendar', year: env.today.y, month: env.today.m, compact: true } as const;
      return [
        {
          text: '빨간 칸이 오늘이라면, 하루 뒤는 바로 다음 칸이고 이틀 뒤는 그다음 칸이야. 며칠 뒤는 오늘 다음 칸부터 세어.',
          visual: { ...base, marks: { [d0]: 'today', [d0 + 1]: 'range', [d0 + 2]: 'target' } },
        },
        {
          text: '7일 뒤는 바로 아래 칸이야. 같은 요일끼리는 세로로 줄지어 있거든.',
          visual: { ...base, marks: { [d0]: 'today', [d0 + 7]: 'target' } },
        },
      ];
    },
    explore: [
      { skill: 'cal.later', n: 8 },
      { skill: 'cal.event', n: 2 },
    ],
    game: { skill: 'game.dateHunt.later', levels: [1, 1, 2, 2, 3] },
    tip: '오늘 날짜에서 "3일 뒤는 무슨 요일이야?" 하고 달력에서 손가락으로 세어 보게 해 주세요. 소풍이나 생일까지 남은 날을 세어 보는 것도 좋아요.',
  },

  // ───────── 블록 14: 백까지와 동전 ─────────
  {
    day: 66,
    kind: 'math',
    title: '100까지 세기',
    buddy: 'bear',
    intro: [
      {
        text: '10개 묶음이 6개면 육십, 7개면 칠십, 8개면 팔십, 9개면 구십이라고 읽어. 숫자로 쓰면 60, 70, 80, 90이야.',
        say: '열 개 묶음이 여섯 개면 육십, 일곱 개면 칠십, 여덟 개면 팔십, 아홉 개면 구십이라고 읽어. 숫자로 쓰면 끝에 영이 붙어.',
        visual: tens(7, 0),
      },
      {
        text: '10개 묶음이 10개가 되면 100이야. 백이라고 읽어.',
        visual: tens(10, 0),
      },
    ],
    explore: [
      { skill: 'num.tens100', n: 6 },
      { skill: 'num.tensOnes100', n: 4 },
    ],
    game: { skill: 'game.stones.100', levels: [1, 1, 2, 2, 3] },
    tip: '클립이나 콩을 10개씩 묶어 "묶음이 7개면 70" 하고 세어 보세요. 100이 되면 함께 박수를 쳐 주세요.',
  },
  {
    day: 67,
    kind: 'math',
    title: '100까지 읽고 비교하기',
    buddy: 'bear',
    intro: [
      {
        text: '82는 10개 묶음 8개와 낱개 2개야. 99 다음 수는 100이야.',
        visual: tens(8, 2),
      },
      {
        text: '수 배열표에서 아래로 한 칸 내려가면 10이 커져. 85에서 한 칸 내려가면 95야.',
        visual: { k: 'chart', from: 71, to: 100, cols: 10, marks: [85, 95] },
      },
    ],
    explore: [
      { skill: 'num.read100', n: 4 },
      { skill: 'num.order100', n: 3 },
      { skill: 'num.compare100', n: 3 },
    ],
    game: { skill: 'game.bundle.b', levels: [1, 1, 2, 2, 3] },
    tip: '엘리베이터 숫자판이나 책 쪽수처럼 큰 숫자를 읽어 보게 해 주세요. "73 다음은 74", "99 다음은 100"을 말놀이처럼 해 봐요.',
  },
  {
    day: 68,
    kind: 'life',
    title: '동전 알아보기',
    buddy: 'bear',
    intro: [
      {
        text: '동전에는 10원, 50원, 100원, 500원이 있어. 동전에 쓰인 숫자가 클수록 값이 커.',
        visual: coins([10, 50, 100, 500]),
      },
      {
        text: '10원짜리는 갈색이고, 500원짜리는 가장 크고 값도 가장 커. 숫자를 읽으면 동전의 값을 알 수 있어.',
        visual: row([coins([10]), coins([500])], 24),
      },
    ],
    explore: [
      { skill: 'money.coinName', n: 7 },
      { skill: 'money.coinCompare', n: 3 },
    ],
    game: { skill: 'game.shop.a', levels: [1, 1, 2, 2, 3] },
    tip: '집에 있는 동전을 모아 10원, 50원, 100원, 500원으로 나눠 보게 해 주세요. 동전에 쓰인 숫자를 읽는 연습이 돼요.',
  },
  {
    day: 69,
    kind: 'life',
    title: '동전 값 비교하고 바꾸기',
    buddy: 'bear',
    intro: [
      {
        text: '동전이 많다고 돈이 많은 건 아니야. 10원짜리 3개는 30원이고, 100원짜리 1개는 100원이야.',
        visual: row([coins([10, 10, 10]), coins([100])], 24),
      },
      {
        text: '100원짜리 5개는 500원짜리 1개와 값이 같아. 10원짜리 5개는 50원짜리 1개와 같아.',
        visual: row([coins([100, 100, 100, 100, 100]), coins([500])], 24),
      },
    ],
    explore: [
      { skill: 'money.coinCompare', n: 5 },
      { skill: 'money.exchange', n: 5 },
    ],
    game: { skill: 'game.shop.b', levels: [1, 1, 2, 2, 3] },
    tip: '저금통의 동전을 꺼내 값이 같은 동전끼리 바꿔 보게 해 주세요. "100원짜리 5개는 500원짜리 몇 개랑 같지?" 하고 물어봐요.',
  },

  // ───────── 블록 15: 10 만들기와 물건 사기 ─────────
  {
    day: 71,
    kind: 'math',
    title: '합이 10이 되는 짝',
    buddy: 'bear',
    intro: [
      {
        text: '10칸에 6개가 들어 있으면 빈칸은 4개야. 6과 4를 합치면 10이 돼.',
        visual: frame('🍬', 6, 'frame10'),
      },
      {
        text: '더해서 10이 되는 짝은 1과 9, 2와 8, 3과 7, 4와 6, 5와 5야. 6 + 4 = 10이라고 써.',
        say: '더해서 십이 되는 짝은 일과 구, 이와 팔, 삼과 칠, 사와 육, 오와 오야. 육 더하기 사는 십이라고 써.',
        visual: eq(['6', '+', '4', '=', '10']),
      },
    ],
    explore: [
      { skill: 'ten.pic', n: 5 },
      { skill: 'ten.eq', n: 5 },
    ],
    game: { skill: 'game.jars.ten', levels: [1, 1, 2, 2, 3] },
    tip: '손가락 10개를 모두 펴고 "3개를 접으면 몇 개가 남아?" 하고 놀아 보세요. 3과 7이 짝이라는 것을 손가락으로 확인할 수 있어요.',
  },
  {
    day: 72,
    kind: 'math',
    title: '10 만들기 빨리 하기',
    buddy: 'bear',
    intro: [
      {
        text: '10이 되는 짝을 기억해 두면 계산이 빨라져. 3을 보면 7이 떠오르고, 8을 보면 2가 떠올라야 해.',
        visual: row([eq(['3', '+', '7', '=', '10']), eq(['8', '+', '2', '=', '10'], 'tangerine')], 12),
      },
      {
        text: '짝은 순서를 바꿔도 같아. 3 + 7도 10이고 7 + 3도 10이야.',
        say: '짝은 순서를 바꿔도 같아. 삼 더하기 칠도 십이고 칠 더하기 삼도 십이야.',
        visual: row([eq(['3', '+', '7', '=', '10']), eq(['7', '+', '3', '=', '10'], 'tangerine')], 12),
      },
    ],
    explore: [
      { skill: 'ten.pairs', n: 5 },
      { skill: 'ten.eq', n: 3 },
      { skill: 'ten.pic', n: 2 },
    ],
    game: { skill: 'game.balloons.ten', levels: [1, 1, 2, 2, 3] },
    tip: '숫자 하나를 말하면 짝이 되는 수를 빨리 말하는 놀이를 해 보세요. "7!" "3!" 하고 주고받으면 금방 외워져요.',
  },
  {
    day: 73,
    kind: 'life',
    title: '동전 세기',
    buddy: 'bear',
    intro: [
      {
        text: '동전을 셀 때는 값이 큰 동전부터 세어. 500원, 100원, 100원이면 500, 600, 700이니까 700원이야.',
        visual: coins([500, 100, 100]),
      },
      {
        text: '50원과 10원은 100원보다 작아서 나중에 더해. 100원, 50원, 10원이면 100, 150, 160이니까 160원이야.',
        visual: coins([100, 50, 10]),
      },
    ],
    explore: [{ skill: 'money.count', n: 10 }],
    game: { skill: 'game.shop.c', levels: [1, 1, 2, 2, 3] },
    tip: '저금통에서 동전을 꺼내 큰 동전부터 세어 보게 해 주세요. "100원짜리 3개면 300원" 하고 소리 내어 이어 세게 해요.',
  },
  {
    day: 74,
    kind: 'life',
    title: '500원 안에서 물건 사기',
    buddy: 'bear',
    intro: [
      {
        text: '물건을 사려면 내 돈과 값을 비교해. 내 돈이 값과 같거나 더 많으면 살 수 있어.',
        visual: row([coins([100, 100, 100]), { k: 'price', emoji: '🍪', name: '과자', won: 300 }], 18),
      },
      {
        text: '돈이 모자라면 살 수 없어. 200원으로는 300원짜리 과자를 살 수 없고, 100원이 모자라.',
        visual: row([coins([100, 100]), { k: 'price', emoji: '🍪', name: '과자', won: 300 }], 18),
      },
    ],
    explore: [
      { skill: 'money.buy', n: 8 },
      { skill: 'money.count', n: 2 },
    ],
    game: { skill: 'game.shop.d', levels: [1, 1, 2, 2, 3] },
    tip: '문방구나 마트에서 아이가 직접 고른 물건의 값을 읽고 낼 돈을 정해 보게 해 주세요. "500원으로 300원짜리를 사면 얼마가 남지?" 하고 물어봐요.',
  },
];
