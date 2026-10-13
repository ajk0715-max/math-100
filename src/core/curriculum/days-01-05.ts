import { WEEKDAYS_LONG } from '../dates';
import type { DayDef } from './types';

/** 블록 1~5 (Day 1~25, 보스 날 제외) */
export const DAYS_01_05: DayDef[] = [
  // ───────── 블록 1: 세기와 요일 ─────────
  {
    day: 1,
    kind: 'math',
    title: '사과를 세어 봐요',
    buddy: 'bear',
    intro: [
      { text: '안녕! 나는 수 곰이야. 오늘부터 나랑 같이 수를 세어 보자!' },
      {
        text: '사과가 몇 개일까? 손가락으로 하나씩 짚으면서 세어 봐. 하나, 둘, 셋!',
        visual: { k: 'objects', emoji: '🍎', n: 3, layout: 'row', numbered: true, size: 'lg' },
      },
      {
        text: '다 세고 나면, 마지막에 센 수가 전부의 수야. 사과는 모두 세 개!',
        visual: {
          k: 'row',
          items: [
            { k: 'objects', emoji: '🍎', n: 3, layout: 'row', size: 'md' },
            { k: 'big', text: '3', tone: 'sky', sub: '셋' },
          ],
          gap: 24,
        },
      },
    ],
    explore: [
      { skill: 'num.count5', n: 7 },
      { skill: 'num.count10', n: 3, maxLevel: 1 },
    ],
    game: { skill: 'game.fish.5', levels: [1, 1, 1, 2, 2] },
    tip: '계단을 오르거나 과자를 먹기 전에 하나씩 소리 내어 세어 보게 해 주세요. 손가락으로 짚으며 세는 습관이 가장 중요해요.',
  },
  {
    day: 2,
    kind: 'math',
    title: '열까지 세고 써요',
    buddy: 'bear',
    intro: [
      {
        text: '오늘은 열 개까지 세어 볼 거야. 열 개는 숫자로 10이라고 써.',
        say: '오늘은 열 개까지 세어 볼 거야. 열 개는 숫자로 십이라고 써.',
        visual: { k: 'objects', emoji: '⭐', n: 10, layout: 'frame10', numbered: true },
      },
      {
        text: '10은 "열"이라고도 읽고 "십"이라고도 읽어. 숫자도 손가락으로 따라 써 보자!',
        say: '십은 열이라고도 읽고 십이라고도 읽어. 숫자도 손가락으로 따라 써 보자!',
        visual: { k: 'big', text: '10', tone: 'tangerine', sub: '열 · 십' },
      },
    ],
    explore: [
      { skill: 'num.count10', n: 5 },
      { skill: 'num.write', n: 3 },
      { skill: 'num.count5', n: 2 },
    ],
    game: { skill: 'game.fish.10', levels: [1, 1, 2, 2, 3] },
    tip: '식탁을 차릴 때 숟가락과 젓가락을 열까지 세어 보게 해 주세요. 쓰기는 잘 쓰는 것보다 위에서 아래로 쓰는 순서가 먼저예요.',
  },
  {
    day: 3,
    kind: 'life',
    title: '요일 이름을 불러요',
    buddy: 'mole',
    intro: (env) => [
      { text: '안녕! 나는 달력 두더지야. 일주일은 일곱 날이고, 날마다 이름이 있어.', visual: { k: 'weekdays', names: 'short' } },
      {
        text: '일요일, 월요일, 화요일, 수요일, 목요일, 금요일, 토요일! 노래처럼 따라 읽어 봐.',
        visual: { k: 'weekdays', names: 'long' },
      },
      {
        text: `오늘은 ${WEEKDAYS_LONG[env.today.wd]}이야!`,
        visual: { k: 'weekdays', highlight: env.today.wd, names: 'short' },
      },
    ],
    explore: [{ skill: 'cal.weekdayName', n: 10 }],
    game: { skill: 'game.weekTrain.a', levels: [1, 1, 1, 1, 2] },
    tip: '아침마다 "오늘은 무슨 요일이지?" 하고 물어봐 주세요. 학교에 가면 요일마다 하는 일이 달라져요.',
  },
  {
    day: 4,
    kind: 'life',
    title: '요일 순서를 맞혀요',
    buddy: 'mole',
    intro: [
      {
        text: '요일에는 순서가 있어. 일요일 다음은 월요일, 월요일 다음은 화요일…',
        visual: { k: 'weekdays', highlight: 0, names: 'short' },
      },
      {
        text: '토요일 다음에는 다시 일요일이 와. 일주일이 끝나면 처음으로 돌아가는 거야.',
        visual: { k: 'weekdays', highlight: 6, names: 'short' },
      },
    ],
    explore: [
      { skill: 'cal.weekdayOrder', n: 8 },
      { skill: 'cal.weekdayName', n: 2 },
    ],
    game: { skill: 'game.weekTrain.a', levels: [1, 1, 2, 2, 3] },
    tip: '저녁 식사 때 "어제는 무슨 요일이었지?", "내일은?"을 번갈아 물어봐 주세요.',
  },

  // ───────── 블록 2: 수 순서와 시계 ─────────
  {
    day: 6,
    kind: 'math',
    title: '징검다리 수 순서',
    buddy: 'bear',
    intro: [
      {
        text: '수에는 순서가 있어. 1, 2, 3, 4, 5, … 차례대로 징검다리를 놓아 보자!',
        visual: { k: 'stones', seq: [1, 2, 3, 4, 5, 6, 7] },
      },
      {
        text: '어떤 수 바로 앞의 수는 하나 작은 수, 바로 뒤의 수는 하나 큰 수야.',
        visual: { k: 'stones', seq: [4, 5, 6] },
      },
    ],
    explore: [{ skill: 'num.order10', n: 10 }],
    game: { skill: 'game.stones.10', levels: [1, 1, 2, 2, 3] },
    tip: '엘리베이터 버튼이나 계단 번호를 순서대로 읽어 보게 해 주세요. 거꾸로 세기도 해 보면 좋아요.',
  },
  {
    day: 7,
    kind: 'math',
    title: '어느 쪽이 더 클까?',
    buddy: 'bear',
    intro: [
      {
        text: '수를 차례대로 세면 먼저 나오는 수가 더 작고, 나중에 나오는 수가 더 커.',
        visual: { k: 'stones', seq: [3, 4, 5, 6, 7] },
      },
      {
        text: '사과 3개와 5개는 어느 쪽이 더 많을까? 하나씩 짝을 지어 보면 남는 쪽이 더 많아!',
        visual: { k: 'groups', a: { emoji: '🍎', n: 3 }, b: { emoji: '🍎', n: 5 }, op: 'vs' },
      },
    ],
    explore: [
      { skill: 'num.compare10', n: 8 },
      { skill: 'num.order10', n: 2 },
    ],
    game: { skill: 'game.balloons.cmp10', levels: [1, 1, 2, 2, 3] },
    tip: '간식을 나눌 때 "누구 것이 더 많지?" 하고 하나씩 짝을 지어 비교해 보게 해 주세요.',
  },
  {
    day: 8,
    kind: 'life',
    title: '시계에는 뭐가 있을까?',
    buddy: 'owl',
    intro: [
      {
        text: '안녕! 나는 시계 부엉이야. 시계에는 숫자가 열두 개 있고, 바늘이 두 개 있어.',
        visual: { k: 'clock', h: 3, m: 0, numbers: true, size: 'lg' },
      },
      {
        text: '짧은바늘은 몇 시인지 알려 주고, 긴바늘은 몇 분인지 알려 줘. 오늘은 바늘 이름을 익혀 보자.',
        visual: { k: 'clock', h: 4, m: 0, numbers: true, mark: 'hour', size: 'lg' },
      },
      {
        text: '맨 위는 12, 오른쪽은 3, 맨 아래는 6, 왼쪽은 9야.',
        visual: { k: 'clock', h: 12, m: 0, numbers: true, hands: 'none', size: 'lg' },
      },
    ],
    explore: [{ skill: 'clk.parts', n: 10 }],
    game: { skill: 'game.hands.point.a', levels: [1, 1, 1, 2, 2] },
    tip: '집 시계를 같이 보면서 "짧은바늘은 어디 있어?", "긴바늘은?" 하고 이름을 말해 보게 해 주세요.',
  },
  {
    day: 9,
    kind: 'life',
    title: '짧은바늘을 찾아라',
    buddy: 'owl',
    intro: [
      {
        text: '짧은바늘은 굵고 짧아. 짧은바늘 끝이 가리키는 숫자를 읽어 봐.',
        visual: { k: 'clock', h: 4, m: 0, numbers: true, mark: 'hour', size: 'lg' },
      },
      {
        text: '긴바늘이 12에 있을 때는 짧은바늘이 가리키는 숫자가 바로 시각이야.',
        visual: { k: 'clock', h: 7, m: 0, numbers: true, size: 'lg' },
      },
    ],
    explore: [{ skill: 'clk.hourHand', n: 10 }],
    game: { skill: 'game.hands.point.b', levels: [1, 1, 2, 2, 3] },
    tip: '시계를 볼 때마다 "짧은바늘이 어느 숫자 가까이에 있어?" 하고 물어봐 주세요.',
  },

  // ───────── 블록 3: 가르기·모으기와 정각 ─────────
  {
    day: 11,
    kind: 'math',
    title: '수를 둘로 가르기',
    buddy: 'bear',
    intro: [
      {
        text: '수를 두 쪽으로 나누는 걸 가르기라고 해. 구슬 5개를 둘로 가르면 어떻게 될까?',
        visual: { k: 'bond', total: 5, a: 2, b: 3 },
      },
      {
        text: '2와 3으로 가를 수 있어. 4와 1로도 가를 수 있지. 합치면 언제나 5야!',
        visual: { k: 'bond', total: 5, a: 4, b: 1 },
      },
    ],
    explore: [{ skill: 'num.split5', n: 10 }],
    game: { skill: 'game.jars.split5', levels: [1, 1, 2, 2, 3] },
    tip: '사탕 5개를 두 접시에 나눠 담는 방법을 전부 찾아보게 해 주세요. 방법이 몇 가지인지 세어 보는 것도 좋아요.',
  },
  {
    day: 12,
    kind: 'math',
    title: '두 수 모으기',
    buddy: 'bear',
    intro: [
      {
        text: '두 수를 한데 합치는 걸 모으기라고 해. 2와 3을 모으면 5가 돼.',
        visual: { k: 'groups', a: { emoji: '🔴', n: 2 }, b: { emoji: '🔵', n: 3 }, op: '+' },
      },
      {
        text: '가르기와 모으기는 거울 같아. 5를 가르면 2와 3, 2와 3을 모으면 5!',
        visual: { k: 'bond', total: 5, a: 2, b: 3 },
      },
    ],
    explore: [
      { skill: 'num.merge5', n: 8 },
      { skill: 'num.split5', n: 2 },
    ],
    game: { skill: 'game.jars.mix5', levels: [1, 1, 2, 2, 3] },
    tip: '양손에 든 장난감을 합치면 모두 몇 개인지 세어 보게 해 주세요. 한 손을 바꿔 가며 여러 번 해 보세요.',
  },
  {
    day: 13,
    kind: 'life',
    title: '1시·2시·3시 읽기',
    buddy: 'owl',
    intro: [
      {
        text: '긴바늘이 12를 가리키면 "몇 시 정각"이야. 짧은바늘이 가리키는 숫자가 시각이지.',
        visual: { k: 'clock', h: 1, m: 0, numbers: true, size: 'lg' },
      },
      {
        text: '짧은바늘이 1이면 한 시, 2면 두 시, 3이면 세 시!',
        visual: {
          k: 'row',
          items: [
            { k: 'clock', h: 1, m: 0, numbers: true, size: 'sm' },
            { k: 'clock', h: 2, m: 0, numbers: true, size: 'sm' },
            { k: 'clock', h: 3, m: 0, numbers: true, size: 'sm' },
          ],
          gap: 8,
        },
      },
    ],
    explore: [{ skill: 'clk.hour.a', n: 10 }],
    game: { skill: 'game.hands.time.a', levels: [1, 1, 2, 2, 3] },
    tip: '1시, 2시, 3시 정각이 되면 "지금 몇 시일까?" 하고 시계를 같이 봐 주세요.',
  },
  {
    day: 14,
    kind: 'life',
    title: '4시·5시·6시 읽기',
    buddy: 'owl',
    intro: [
      {
        text: '시를 말할 때는 하나, 둘, 셋이 아니라 한, 두, 세, 네, 다섯, 여섯으로 읽어. 네 시, 다섯 시, 여섯 시!',
        visual: {
          k: 'row',
          items: [
            { k: 'clock', h: 4, m: 0, numbers: true, size: 'sm' },
            { k: 'clock', h: 5, m: 0, numbers: true, size: 'sm' },
            { k: 'clock', h: 6, m: 0, numbers: true, size: 'sm' },
          ],
          gap: 8,
        },
      },
      {
        text: '긴바늘이 12에 있는지 먼저 보고, 짧은바늘이 가리키는 숫자를 읽으면 돼.',
        visual: { k: 'clock', h: 5, m: 0, numbers: true, mark: 'hour', size: 'lg' },
      },
    ],
    explore: [
      { skill: 'clk.hour.b', n: 8 },
      { skill: 'clk.hour.a', n: 2 },
    ],
    game: { skill: 'game.clockMatch.b', levels: [1, 1, 2, 2, 3] },
    tip: '4~6시 정각에 시계를 같이 보고 읽어 보게 해 주세요. 간식 시간처럼 매일 같은 때를 정하면 쉬워요.',
  },

  // ───────── 블록 4: 10 가르기와 하루 ─────────
  {
    day: 16,
    kind: 'math',
    title: '10을 둘로 가르기',
    buddy: 'bear',
    intro: [
      {
        text: '이번에는 10까지 가르기를 해 볼 거야. 10은 1과 9, 2와 8, 3과 7, 4와 6, 5와 5로 가를 수 있어.',
        visual: { k: 'bond', total: 10, a: 3, b: 7 },
      },
      {
        text: '짝이 되는 두 수를 합치면 10! 손가락 열 개로 확인해 봐.',
        visual: { k: 'groups', a: { emoji: '🔴', n: 4 }, b: { emoji: '🔵', n: 6 }, op: '+' },
      },
    ],
    explore: [
      { skill: 'num.split10', n: 8 },
      { skill: 'num.split5', n: 2 },
    ],
    game: { skill: 'game.jars.split10', levels: [1, 1, 2, 2, 3] },
    tip: '블록 10개를 두 무더기로 나누는 방법을 전부 찾아보게 해 주세요.',
  },
  {
    day: 17,
    kind: 'math',
    title: '10 이하 모으기',
    buddy: 'bear',
    intro: [
      {
        text: '모으기도 10까지 해 보자. 6과 4를 모으면 10이 돼.',
        visual: { k: 'groups', a: { emoji: '🔴', n: 6 }, b: { emoji: '🔵', n: 4 }, op: '+' },
      },
      {
        text: '10이 되는 짝을 외워 두면 나중에 계산이 쉬워져. 1과 9, 2와 8, 3과 7, 4와 6, 5와 5!',
        visual: { k: 'bond', total: 10, a: 5, b: 5 },
      },
    ],
    explore: [
      { skill: 'num.merge10', n: 8 },
      { skill: 'num.split10', n: 2 },
    ],
    game: { skill: 'game.jars.mix10', levels: [1, 1, 2, 2, 3] },
    tip: '두 손 손가락을 펴서 합치면 10이 되는 짝을 찾아보게 해 주세요.',
  },
  {
    day: 18,
    kind: 'life',
    title: '7시부터 12시까지',
    buddy: 'owl',
    intro: [
      {
        text: '7시부터 12시도 읽는 방법은 같아. 긴바늘이 12에 있으면 짧은바늘이 가리키는 숫자를 읽어.',
        visual: { k: 'clock', h: 8, m: 0, numbers: true, size: 'lg' },
      },
      {
        text: '12시는 짧은바늘과 긴바늘이 모두 12에서 만나. 열두 시!',
        visual: { k: 'clock', h: 12, m: 0, numbers: true, size: 'lg' },
      },
    ],
    explore: [
      { skill: 'clk.hour.c', n: 8 },
      { skill: 'clk.hour.a', n: 1 },
      { skill: 'clk.hour.b', n: 1 },
    ],
    game: { skill: 'game.hands.time.c', levels: [1, 1, 2, 2, 3] },
    tip: '7시~12시 정각마다 시계 앞에서 읽어 보게 해 주세요. 7시와 8시처럼 헷갈리는 시각은 몇 번 더 봐 주세요.',
  },
  {
    day: 19,
    kind: 'life',
    title: '아침·낮·저녁',
    buddy: 'owl',
    intro: [
      {
        text: '하루는 아침, 낮, 저녁, 밤으로 나뉘어. 해가 뜨면 아침, 해가 높으면 낮, 해가 지면 저녁이야.',
        visual: {
          k: 'row',
          items: [
            { k: 'big', text: '🌅', sub: '아침' },
            { k: 'big', text: '☀️', sub: '낮' },
            { k: 'big', text: '🌇', sub: '저녁' },
            { k: 'big', text: '🌙', sub: '밤' },
          ],
          gap: 8,
        },
      },
      {
        text: '아침에는 일어나서 밥을 먹고 학교에 가. 낮에는 점심을 먹고 놀아. 저녁에는 집에 와서 저녁밥을 먹어.',
      },
    ],
    explore: [{ skill: 'time.daypart', n: 10 }],
    game: { skill: 'game.dayCards', levels: [1, 1, 2, 2, 3] },
    tip: '"지금은 아침일까, 낮일까, 저녁일까?" 하고 하루에 한 번 물어봐 주세요. 하는 일과 시각을 연결하는 게 목표예요.',
  },

  // ───────── 블록 5: 모양과 달력 ─────────
  {
    day: 21,
    kind: 'math',
    title: '상자·기둥·공 모양',
    buddy: 'bear',
    intro: [
      {
        text: '우리 둘레에는 여러 가지 모양이 있어. 상자 모양, 둥근 기둥 모양, 공 모양!',
        visual: {
          k: 'row',
          items: [
            { k: 'solid', solid: 'box', size: 80 },
            { k: 'solid', solid: 'cylinder', size: 80 },
            { k: 'solid', solid: 'ball', size: 80 },
          ],
          gap: 16,
        },
      },
      { text: '상자는 평평한 면이 있어서 잘 쌓여. 공은 둥글어서 잘 굴러가. 둥근 기둥은 세우면 쌓이고 눕히면 굴러가!' },
    ],
    explore: [{ skill: 'geo.solid', n: 10 }],
    game: { skill: 'game.balloons.solid', levels: [1, 1, 2, 2, 2] },
    tip: '집 안에서 상자·둥근 기둥·공 모양 물건을 하나씩 찾아보게 해 주세요. 과자 상자, 통조림, 공이 좋아요.',
  },
  {
    day: 22,
    kind: 'math',
    title: '네모·세모·동그라미',
    buddy: 'bear',
    intro: [
      {
        text: '납작한 모양에는 네모, 세모, 동그라미가 있어. 뾰족한 곳이 몇 개인지 세어 보면 쉽게 알 수 있어.',
        visual: {
          k: 'row',
          items: [
            { k: 'shape', shape: 'square', color: 'sky', size: 80, label: '네모' },
            { k: 'shape', shape: 'triangle', color: 'tangerine', size: 80, label: '세모' },
            { k: 'shape', shape: 'circle', color: 'leaf', size: 80, label: '동그라미' },
          ],
          gap: 16,
        },
      },
      { text: '뾰족한 곳이 네 개면 네모, 세 개면 세모, 뾰족한 곳이 없으면 동그라미야.' },
    ],
    explore: [
      { skill: 'geo.shape2d', n: 8 },
      { skill: 'geo.solid', n: 2 },
    ],
    game: { skill: 'game.balloons.shape', levels: [1, 1, 2, 2, 3] },
    tip: '표지판과 간판에서 네모·세모·동그라미를 찾아보게 해 주세요. 산책길에 몇 개 찾는지 세어 보면 재미있어요.',
  },
  {
    day: 23,
    kind: 'life',
    title: '열두 달 이야기',
    buddy: 'mole',
    intro: [
      {
        text: '일 년은 열두 달이야. 1월부터 12월까지 차례대로 지나가.',
        visual: { k: 'months' },
      },
      {
        text: '6월은 "유월", 10월은 "시월"이라고 읽어. 다른 달은 숫자 뒤에 월을 붙여서 읽어.',
        visual: { k: 'months', highlight: 6 },
      },
    ],
    explore: [{ skill: 'cal.months', n: 10 }],
    game: { skill: 'game.monthTrain', levels: [1, 1, 2, 2, 3] },
    tip: '가족 생일이 몇 월인지 달력에서 같이 찾아보세요. 지금이 몇 월인지 이야기해 보는 것도 좋아요.',
  },
  {
    day: 24,
    kind: 'life',
    title: '달력 읽는 법',
    buddy: 'mole',
    intro: (env) => [
      {
        text: `달력은 한 줄에 일곱 칸이야. 한 줄이 한 주고, 칸 하나가 하루야. 이번 달은 ${env.today.m}월이야.`,
        visual: { k: 'calendar', year: env.today.y, month: env.today.m, marks: { [env.today.d]: 'today' } },
      },
      {
        text: '위쪽에는 요일이 쓰여 있어. 같은 세로줄은 같은 요일이야.',
        visual: { k: 'calendar', year: env.today.y, month: env.today.m, highlightWeekday: env.today.wd, marks: { [env.today.d]: 'today' } },
      },
    ],
    explore: [{ skill: 'cal.grid', n: 10 }],
    game: { skill: 'game.dateHunt.a', levels: [1, 1, 2, 2, 3] },
    tip: '달력에서 오늘 날짜에 동그라미를 치고, 몇 번째 줄 무슨 요일인지 이야기해 보세요.',
  },
];
