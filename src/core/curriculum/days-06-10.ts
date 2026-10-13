import { WEEKDAYS_LONG } from '../dates';
import type { Visual } from '../types';
import type { DayDef } from './types';

const clock = (h: number, m: number, extra: Partial<Extract<Visual, { k: 'clock' }>> = {}): Visual => ({ k: 'clock', h, m, numbers: true, size: 'lg', ...extra });
const eq = (parts: string[], tone: 'sky' | 'tangerine' | 'grape' = 'sky'): Visual => ({ k: 'eq', parts, tone });

/** 블록 6~10 (Day 26~50, 보스 날 제외) */
export const DAYS_06_10: DayDef[] = [
  // ───────── 블록 6: 덧셈 첫걸음과 30분 ─────────
  {
    day: 26,
    kind: 'math',
    title: '두 무리를 합쳐요',
    buddy: 'bear',
    intro: [
      {
        text: '사과 2개와 사과 1개를 합치면 모두 몇 개일까? 합쳐서 세는 것을 더하기라고 해.',
        visual: { k: 'groups', a: { emoji: '🍎', n: 2 }, b: { emoji: '🍎', n: 1 }, op: '+' },
      },
      {
        text: '더하기는 + 기호로 써. 2 + 1 = 3 이라고 쓰고, 이 더하기 일은 삼이라고 읽어.',
        say: '더하기는 더하기 기호로 써. 이 더하기 일은 삼이라고 쓰고, 이 더하기 일은 삼이라고 읽어.',
        visual: eq(['2', '+', '1', '=', '3']),
      },
    ],
    explore: [{ skill: 'add.pic5', n: 10 }],
    game: { skill: 'game.jars.merge5', levels: [1, 1, 2, 2, 3] },
    tip: '과자나 블록 두 무더기를 합쳐서 세어 보게 해 주세요. "2개랑 1개를 합치면 모두 몇 개?" 하고 물어보면 돼요.',
  },
  {
    day: 27,
    kind: 'math',
    title: '더하기 식을 읽어요',
    buddy: 'bear',
    intro: [
      {
        text: '3 + 2는 3에서 2개를 더 세면 5야. 그림을 그려 보면 쉬워.',
        say: '삼 더하기 이는 삼에서 두 개를 더 세면 오야. 그림을 그려 보면 쉬워.',
        visual: {
          k: 'col',
          items: [{ k: 'groups', a: { emoji: '🍪', n: 3 }, b: { emoji: '🍪', n: 2 }, op: '+' }, eq(['3', '+', '2', '=', '5'])],
          gap: 10,
        },
      },
      {
        text: '식으로 쓴 것도 읽을 수 있어. 3 + 2 = 5는 삼 더하기 이는 오라고 읽어.',
        say: '식으로 쓴 것도 읽을 수 있어. 삼 더하기 이는 오라고 읽어.',
        visual: eq(['3', '+', '2', '=', '5']),
      },
    ],
    explore: [
      { skill: 'add.eq5', n: 6 },
      { skill: 'add.pic5', n: 4 },
    ],
    game: { skill: 'game.balloons.add5', levels: [1, 1, 2, 2, 3] },
    tip: '일상에서 "사과 2개 더하기 3개는?" 하고 한 번씩 물어봐 주세요. 틀려도 손가락으로 세어 보게 하면 돼요.',
  },
  {
    day: 28,
    kind: 'life',
    title: '정각과 30분을 구별해요',
    buddy: 'owl',
    intro: [
      {
        text: '정각은 긴바늘이 12에 있을 때야. 긴바늘이 6에 있으면 30분이야!',
        say: '정각은 긴바늘이 십이에 있을 때야. 긴바늘이 육에 있으면 삼십 분이야!',
        visual: { k: 'row', items: [clock(3, 0, { size: 'md', mark: 'minute' }), clock(3, 30, { size: 'md', mark: 'minute' })], gap: 12 },
      },
      {
        text: '왼쪽은 3시 정각, 오른쪽은 3시 30분이야. 긴바늘이 반 바퀴 돌았어.',
        visual: { k: 'row', items: [{ k: 'digital', h: 3, m: 0 }, { k: 'digital', h: 3, m: 30 }], gap: 14 },
      },
    ],
    explore: [
      { skill: 'clk.half.see', n: 8 },
      { skill: 'clk.hour.a', n: 1 },
      { skill: 'clk.hour.b', n: 1 },
    ],
    game: { skill: 'game.balloons.halfSee', levels: [1, 1, 2, 2, 3] },
    tip: '집 시계로 7시 정각과 7시 30분을 나란히 보여 주세요. 긴바늘이 아래(6)에 있으면 30분이라고 말해 주면 돼요.',
  },
  {
    day: 29,
    kind: 'life',
    title: '몇 시 30분 읽기',
    buddy: 'owl',
    intro: [
      {
        text: '30분일 때는 짧은바늘이 지나간 숫자를 읽고 뒤에 30분을 붙여. 3을 막 지났으면 3시 30분!',
        say: '삼십 분일 때는 짧은바늘이 지나간 숫자를 읽고 뒤에 삼십 분을 붙여. 삼을 막 지났으면 세 시 삼십 분!',
        visual: clock(3, 30, { mark: 'hour' }),
      },
      {
        text: '짧은바늘이 숫자와 숫자 사이에 있으면 앞의 숫자를 읽어. 8과 9 사이면 8시 30분이야.',
        visual: clock(8, 30, { mark: 'hour' }),
      },
    ],
    explore: [
      { skill: 'clk.half.a', n: 8 },
      { skill: 'clk.half.see', n: 2 },
    ],
    game: { skill: 'game.hands.half.a', levels: [1, 1, 2, 2, 3] },
    tip: '시계가 보일 때마다 "지금은 몇 시일까, 몇 시 30분일까?" 하고 하루 한 번 읽어 보게 해 주세요. 30분일 때 짧은바늘이 숫자 사이에 있는지 같이 확인해요.',
  },

  // ───────── 블록 7: 덧셈과 시계 맞추기 ─────────
  {
    day: 31,
    kind: 'math',
    title: '더하기 9까지',
    buddy: 'bear',
    intro: [
      {
        text: '이제 합이 9까지 되는 더하기를 해 보자. 4 + 3은 4 다음부터 3개를 더 세어서 7이야.',
        say: '이제 합이 구까지 되는 더하기를 해 보자. 사 더하기 삼은 사 다음부터 세 개를 더 세어서 칠이야.',
        visual: { k: 'groups', a: { emoji: '🍓', n: 4 }, b: { emoji: '🍓', n: 3 }, op: '+' },
      },
      {
        text: '더하는 순서를 바꿔도 답은 같아. 4 + 3도 7이고 3 + 4도 7이야!',
        say: '더하는 순서를 바꿔도 답은 같아. 사 더하기 삼도 칠이고 삼 더하기 사도 칠이야!',
        visual: { k: 'row', items: [eq(['4', '+', '3', '=', '7']), eq(['3', '+', '4', '=', '7'], 'tangerine')], gap: 10, wrap: true },
      },
    ],
    explore: [
      { skill: 'add.pic9', n: 8 },
      { skill: 'add.eq5', n: 2 },
    ],
    game: { skill: 'game.balloons.add9', levels: [1, 1, 2, 2, 3] },
    tip: '블록이나 동전 두 무더기로 "5개랑 3개를 합치면?" 하고 놀아 보세요. 순서를 바꿔도 같은 답이 나오는지 직접 보여 주세요.',
  },
  {
    day: 32,
    kind: 'math',
    title: '더하기 식 익히기',
    buddy: 'bear',
    intro: [
      {
        text: '큰 수에서 이어서 세면 빨라. 5 + 3은 5 다음에 6, 7, 8! 답은 8이야.',
        say: '큰 수에서 이어서 세면 빨라. 오 더하기 삼은 오 다음에 육, 칠, 팔! 답은 팔이야.',
        visual: eq(['5', '+', '3', '=', '8']),
      },
      {
        text: '같은 수끼리 더하는 것도 있어. 4 + 4는 8, 3 + 3은 6이야.',
        say: '같은 수끼리 더하는 것도 있어. 사 더하기 사는 팔, 삼 더하기 삼은 육이야.',
        visual: { k: 'groups', a: { emoji: '🐤', n: 4 }, b: { emoji: '🐤', n: 4 }, op: '+' },
      },
    ],
    explore: [
      { skill: 'add.eq9', n: 7 },
      { skill: 'add.pic9', n: 3 },
    ],
    game: { skill: 'game.fish.add9', levels: [1, 1, 2, 2, 2] },
    tip: '숫자 카드 두 장을 뽑아 더하는 놀이를 해 보세요. 답을 말한 뒤에 "어떻게 알았어?" 하고 한 번 물어봐 주면 좋아요.',
  },
  {
    day: 33,
    kind: 'life',
    title: '7시 30분부터 12시 30분까지',
    buddy: 'owl',
    intro: [
      {
        text: '7시 30분부터 12시 30분도 읽는 방법은 같아. 긴바늘이 6이면 30분이야.',
        visual: clock(7, 30, { mark: 'hour' }),
      },
      {
        text: '12시 30분은 짧은바늘이 12와 1 사이에 있어. 12를 지났으니 12시 30분이야.',
        visual: clock(12, 30, { mark: 'hour' }),
      },
    ],
    explore: [
      { skill: 'clk.half.b', n: 7 },
      { skill: 'clk.half.a', n: 1 },
      { skill: 'clk.read.mix', n: 2 },
    ],
    game: { skill: 'game.hands.half.b', levels: [1, 1, 2, 2, 3] },
    tip: '시계 앞에서 "정각일까, 30분일까?" 맞히는 놀이를 해 보세요. 12시 30분처럼 12와 1이 이어지는 곳을 특히 같이 봐 주세요.',
  },
  {
    day: 34,
    kind: 'life',
    title: '시계 바늘 맞추기',
    buddy: 'owl',
    intro: [
      {
        text: '이제 우리가 직접 시계를 맞춰 볼 거야. 짧은바늘을 그 숫자에 놓고, 30분이면 긴바늘을 6에 놓아.',
        say: '이제 우리가 직접 시계를 맞춰 볼 거야. 짧은바늘을 그 숫자에 놓고, 삼십 분이면 긴바늘을 육에 놓아.',
        visual: clock(4, 30, { mark: 'minute' }),
      },
      {
        text: '정각이면 긴바늘은 12, 30분이면 긴바늘은 6! 30분일 때 짧은바늘은 두 숫자의 가운데야.',
        say: '정각이면 긴바늘은 십이, 삼십 분이면 긴바늘은 육! 삼십 분일 때 짧은바늘은 두 숫자의 가운데야.',
        visual: { k: 'row', items: [clock(4, 0, { size: 'md' }), clock(4, 30, { size: 'md' })], gap: 12 },
      },
    ],
    explore: [
      { skill: 'clk.set.half', n: 6 },
      { skill: 'clk.read.mix', n: 4 },
    ],
    game: { skill: 'game.clockMatch.half.b', levels: [1, 1, 2, 2, 3] },
    tip: '종이 시계나 장난감 시계로 직접 바늘을 돌려 보게 해 주세요. "3시 30분에 간식 먹자" 하고 시각을 정해서 맞춰 보면 재미있어요.',
  },

  // ───────── 블록 8: 뺄셈 첫걸음과 날짜 ─────────
  {
    day: 36,
    kind: 'math',
    title: '덜어 내면 몇 개 남을까',
    buddy: 'bear',
    intro: [
      {
        text: '사과 5개에서 2개를 먹으면 몇 개가 남을까? 덜어 내는 것을 빼기라고 해.',
        visual: { k: 'objects', emoji: '🍎', n: 5, crossed: 2, layout: 'row', size: 'md' },
      },
      {
        text: '빼기는 − 기호로 써. 5 − 2 = 3 이라고 쓰고, 오 빼기 이는 삼이라고 읽어.',
        say: '빼기는 빼기 기호로 써. 오 빼기 이는 삼이라고 쓰고, 오 빼기 이는 삼이라고 읽어.',
        visual: eq(['5', '−', '2', '=', '3'], 'tangerine'),
      },
    ],
    explore: [{ skill: 'sub.pic5', n: 10 }],
    game: { skill: 'game.jars.split5', levels: [1, 1, 2, 2, 3] },
    tip: '과자 5개 중 2개를 먹으면 몇 개 남는지 실제로 해 보게 해 주세요. 없어진 만큼 손가락을 접어 보면 좋아요.',
  },
  {
    day: 37,
    kind: 'math',
    title: '빼기 식을 읽어요',
    buddy: 'bear',
    intro: [
      {
        text: '4 − 1은 4개에서 1개를 빼는 거야. 남은 것은 3개!',
        say: '사 빼기 일은 네 개에서 한 개를 빼는 거야. 남은 것은 세 개!',
        visual: { k: 'col', items: [{ k: 'objects', emoji: '🍪', n: 4, crossed: 1, layout: 'row', size: 'md' }, eq(['4', '−', '1', '=', '3'], 'tangerine')], gap: 10 },
      },
      {
        text: '빼기는 거꾸로 세어도 돼. 4에서 1을 빼면 4 다음에 3! 5 − 2는 4, 3이니까 답은 3이야.',
        say: '빼기는 거꾸로 세어도 돼. 사에서 일을 빼면 사 다음에 삼! 오 빼기 이는 사, 삼이니까 답은 삼이야.',
      },
    ],
    explore: [
      { skill: 'sub.eq5', n: 7 },
      { skill: 'sub.pic5', n: 3 },
    ],
    game: { skill: 'game.balloons.sub5', levels: [1, 1, 2, 2, 3] },
    tip: '계단을 내려가면서 "5, 4, 3…" 하고 거꾸로 세어 보세요. 빼기가 거꾸로 세는 것이라는 느낌을 잡을 수 있어요.',
  },
  {
    day: 38,
    kind: 'life',
    title: '오늘은 몇 월 며칠',
    buddy: 'mole',
    intro: (env) => [
      {
        text: `오늘은 ${env.today.m}월 ${env.today.d}일이야. 몇 월 며칠인지 읽을 수 있어야 해.`,
        visual: { k: 'calendar', year: env.today.y, month: env.today.m, marks: { [env.today.d]: 'today' }, compact: true },
      },
      {
        text: '달력 위쪽에는 몇 월인지, 칸 안에는 며칠인지 쓰여 있어. 빨간 칸이 오늘이야.',
        visual: { k: 'calendar', year: env.today.y, month: env.today.m, marks: { [env.today.d]: 'today' }, compact: true },
      },
    ],
    explore: [
      { skill: 'cal.today', n: 6 },
      { skill: 'cal.dateRead', n: 4 },
    ],
    game: { skill: 'game.dateHunt.a', levels: [1, 1, 2, 2, 3] },
    tip: '아침마다 달력에서 오늘 날짜에 동그라미를 치면서 "오늘은 몇 월 며칠?" 하고 같이 읽어 보세요.',
  },
  {
    day: 39,
    kind: 'life',
    title: '날짜와 요일을 함께 읽어요',
    buddy: 'mole',
    intro: (env) => [
      {
        text: '달력 칸 하나로 며칠인지, 무슨 요일인지 알 수 있어. 날짜는 칸 안의 숫자를, 요일은 위로 올라가서 읽어.',
        visual: { k: 'calendar', year: env.today.y, month: env.today.m, marks: { [env.today.d]: 'today' }, highlightWeekday: env.today.wd, compact: true },
      },
      {
        text: `오늘은 ${env.today.m}월 ${env.today.d}일 ${WEEKDAYS_LONG[env.today.wd]}이야. 몇 월 며칠 무슨 요일인지 한꺼번에 말해 보자.`,
      },
    ],
    explore: [
      { skill: 'cal.dateRead', n: 7 },
      { skill: 'cal.today', n: 3 },
    ],
    game: { skill: 'game.weekTrain.a', levels: [1, 1, 2, 2, 3] },
    tip: '생일이나 소풍 같은 가족 일정이 몇 월 며칠 무슨 요일인지 달력에서 같이 찾아보세요.',
  },

  // ───────── 블록 9: 뺄셈·섞기와 달력 ─────────
  {
    day: 41,
    kind: 'math',
    title: '빼기 9까지',
    buddy: 'bear',
    intro: [
      {
        text: '9까지의 수에서도 빼 볼 거야. 8개 중에서 3개를 지우고 남은 것을 세어 봐.',
        visual: { k: 'objects', emoji: '🍓', n: 8, crossed: 3, layout: 'row', size: 'md' },
      },
      {
        text: '더하기는 커지고 빼기는 작아져. 3 + 2 = 5의 반대가 5 − 2 = 3이야.',
        say: '더하기는 커지고 빼기는 작아져. 삼 더하기 이는 오의 반대가 오 빼기 이는 삼이야.',
        visual: { k: 'row', items: [eq(['3', '+', '2', '=', '5']), eq(['5', '−', '2', '=', '3'], 'tangerine')], gap: 10, wrap: true },
      },
    ],
    explore: [
      { skill: 'sub.pic9', n: 6 },
      { skill: 'sub.eq9', n: 4 },
    ],
    game: { skill: 'game.balloons.sub9', levels: [1, 1, 2, 2, 3] },
    tip: '간식 9개 중에서 몇 개를 먹고 몇 개가 남았는지 이야기해 보세요. 더하기의 반대가 빼기라는 말도 한 번 해 주세요.',
  },
  {
    day: 42,
    kind: 'math',
    title: '더하기일까 빼기일까',
    buddy: 'bear',
    intro: [
      {
        text: '더 받으면 많아지니까 더하기, 가져가면 적어지니까 빼기야. 이야기를 잘 읽어 봐.',
        visual: { k: 'row', items: [eq(['3', '+', '2'], 'sky'), eq(['5', '−', '2'], 'tangerine')], gap: 10, wrap: true },
      },
      {
        text: '식에서는 기호를 꼭 봐야 해. + 는 더하기, − 는 빼기야. 4 + 3은 7, 7 − 3은 4!',
        say: '식에서는 기호를 꼭 봐야 해. 더하기 기호는 더하기, 빼기 기호는 빼기야. 사 더하기 삼은 칠, 칠 빼기 삼은 사!',
        visual: { k: 'row', items: [eq(['4', '+', '3', '=', '7']), eq(['7', '−', '3', '=', '4'], 'tangerine')], gap: 10, wrap: true },
      },
    ],
    explore: [
      { skill: 'mix.addsub9', n: 8 },
      { skill: 'sub.eq9', n: 1 },
      { skill: 'add.eq9', n: 1 },
    ],
    game: { skill: 'game.balloons.mix9', levels: [1, 1, 2, 2, 3] },
    tip: '장난감을 더 사면 몇 개가 되는지, 친구에게 주면 몇 개 남는지 더하기·빼기가 섞인 이야기를 만들어 주세요.',
  },
  {
    day: 43,
    kind: 'life',
    title: '어제·오늘·내일',
    buddy: 'mole',
    intro: (env) => [
      {
        text: '오늘이 10일이면 어제는 9일, 내일은 11일이야. 달력에서는 오늘의 왼쪽이 어제, 오른쪽이 내일이야.',
        visual: { k: 'calendar', year: env.today.y, month: env.today.m, marks: { 9: 'target', 10: 'today', 11: 'target' }, compact: true },
      },
      {
        text: '어제는 하루 전날, 내일은 하루 뒤의 날이야. 오늘이 지나면 내일이 오늘이 돼!',
      },
    ],
    explore: [{ skill: 'cal.relday', n: 10 }],
    game: { skill: 'game.weekTrain.a', levels: [1, 1, 2, 2, 3] },
    tip: '하루를 마칠 때 "오늘은 무슨 요일이었지? 내일은 무슨 요일이야?" 하고 이야기해 보세요.',
  },
  {
    day: 44,
    kind: 'life',
    title: '달력에서 날짜 찾기',
    buddy: 'mole',
    intro: (env) => [
      {
        text: '달력에서 날짜를 찾을 때는 작은 수는 위쪽, 큰 수는 아래쪽을 먼저 봐.',
        visual: { k: 'calendar', year: env.today.y, month: env.today.m, marks: { [env.today.d]: 'today' }, compact: true },
      },
      {
        text: '요일을 알면 더 빨리 찾을 수 있어. 같은 요일은 위아래 한 줄에 모여 있어.',
        visual: { k: 'calendar', year: env.today.y, month: env.today.m, marks: { [env.today.d]: 'today' }, highlightWeekday: env.today.wd, compact: true },
      },
    ],
    explore: [
      { skill: 'cal.find', n: 8 },
      { skill: 'cal.relday', n: 2 },
    ],
    game: { skill: 'game.dateHunt.a', levels: [1, 2, 2, 3, 3] },
    tip: '가족 생일이나 기념일을 달력에서 같이 찾아보세요. 부모 화면에 가족 일정을 넣어 두면 달력 문제에도 나와요.',
  },

  // ───────── 블록 10: 비교하기와 하루 일과 ─────────
  {
    day: 46,
    kind: 'math',
    title: '길이와 높이 비교',
    buddy: 'bear',
    intro: [
      {
        text: '어느 쪽이 더 길까? 한쪽 끝을 맞추고 다른 쪽 끝을 보면 알 수 있어. 더 멀리 나간 쪽이 더 길어.',
        visual: {
          k: 'bars',
          dir: 'h',
          unitMax: 10,
          items: [
            { label: '빨간 연필', value: 8, tone: 'tomato' },
            { label: '파란 연필', value: 5, tone: 'sky' },
          ],
        },
      },
      {
        text: '긴 것은 길다, 짧은 것은 짧다고 해. 높이를 비교할 때는 높다, 낮다고 말해.',
        visual: {
          k: 'bars',
          dir: 'v',
          unitMax: 10,
          items: [
            { label: '노란 탑', value: 9, tone: 'sun' },
            { label: '초록색 탑', value: 5, tone: 'leaf' },
          ],
        },
      },
    ],
    explore: [{ skill: 'cmp.length', n: 10 }],
    game: { skill: 'game.lineup', levels: [1, 1, 2, 2, 3] },
    tip: '연필, 칫솔, 숟가락을 나란히 놓고 한쪽 끝을 맞춰서 어느 것이 더 긴지 비교하게 해 주세요.',
  },
  {
    day: 47,
    kind: 'math',
    title: '무게와 넓이 비교',
    buddy: 'bear',
    intro: [
      {
        text: '시소는 더 무거운 쪽이 아래로 내려가. 코끼리와 생쥐가 타면 코끼리 쪽이 내려가겠지?',
        visual: { k: 'seesaw', left: { emoji: '🐘', n: 1 }, right: { emoji: '🐭', n: 1 }, tilt: 'left' },
      },
      {
        text: '넓이는 칸을 세어서 비교해. 칸이 더 많은 쪽이 더 넓어.',
        visual: {
          k: 'row',
          items: [
            { k: 'cells', cols: 3, rows: 3, tone: 'sky' },
            { k: 'cells', cols: 2, rows: 2, tone: 'tangerine' },
          ],
          gap: 20,
        },
      },
    ],
    explore: [
      { skill: 'cmp.weight', n: 5 },
      { skill: 'cmp.area', n: 5 },
    ],
    game: { skill: 'game.seesaw', levels: [1, 1, 2, 2, 3] },
    tip: '물건 두 개를 양손에 들고 어느 쪽이 더 무거운지 느껴 보게 해 주세요. 책과 필통, 사과와 귤처럼 가까운 물건이 좋아요.',
  },
  {
    day: 48,
    kind: 'life',
    title: '하루 일과 순서',
    buddy: 'owl',
    intro: [
      {
        text: '하루에는 해야 할 일이 순서대로 있어. 일어나서 세수하고, 아침밥을 먹고, 학교에 가.',
        visual: {
          k: 'routine',
          items: [
            { emoji: '⏰', label: '일어나기' },
            { emoji: '🧼', label: '세수하기' },
            { emoji: '🍚', label: '아침밥 먹기' },
            { emoji: '🎒', label: '학교 가기' },
          ],
        },
      },
      {
        text: '점심을 먹고 놀다가, 저녁을 먹고 목욕한 뒤에 잠을 자. 먼저 하는 일과 나중에 하는 일을 구별해 보자.',
        visual: {
          k: 'routine',
          items: [
            { emoji: '🍱', label: '점심 먹기' },
            { emoji: '🛝', label: '놀이터에서 놀기' },
            { emoji: '🍲', label: '저녁밥 먹기' },
            { emoji: '🛁', label: '목욕하기' },
            { emoji: '🛌', label: '잠자기' },
          ],
        },
      },
    ],
    explore: [{ skill: 'life.routine', n: 10 }],
    game: { skill: 'game.dayCards', levels: [1, 1, 2, 2, 3] },
    tip: '내일 아침과 저녁에 할 일을 아이와 순서대로 말해 보세요. "밥 먹기 전에 뭐 했지?" 같은 전·후 질문도 좋아요.',
  },
  {
    day: 49,
    kind: 'life',
    title: '일과와 시각 이어 보기',
    buddy: 'owl',
    intro: [
      {
        text: '일과를 시각과 함께 적으면 하루가 한눈에 보여. 일과표에는 일어나기 7시처럼 시각이 같이 쓰여 있어.',
        visual: {
          k: 'routine',
          items: [
            { emoji: '⏰', label: '일어나기', time: '7시' },
            { emoji: '🎒', label: '학교 가기', time: '8시 30분' },
            { emoji: '🍱', label: '점심 먹기', time: '12시' },
            { emoji: '🛌', label: '잠자기', time: '9시' },
          ],
        },
      },
      {
        text: '일과표의 시각을 읽고 시계에서 같은 시각을 찾아보자. 8시 30분은 긴바늘이 6에 있어.',
        visual: clock(8, 30, { mark: 'minute' }),
      },
    ],
    explore: [
      { skill: 'life.routineTime', n: 8 },
      { skill: 'life.routine', n: 2 },
    ],
    game: { skill: 'game.routineMatch', levels: [1, 1, 2, 2, 3] },
    tip: '우리 집 하루 일과표를 아이와 함께 만들어 보세요. 일어나는 시각, 밥 먹는 시각, 자는 시각을 시계 그림으로 붙이면 좋아요.',
  },
];
