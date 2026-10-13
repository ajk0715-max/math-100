import type { Visual } from '../types';
import type { DayDef } from './types';

const clock = (h: number, m: number, extra: Partial<Extract<Visual, { k: 'clock' }>> = {}): Visual => ({ k: 'clock', h, m, numbers: true, size: 'md', ...extra });
const digital = (h: number, m: number): Visual => ({ k: 'digital', h, m });
const eq = (parts: string[], tone: 'sky' | 'tangerine' | 'grape' = 'sky'): Visual => ({ k: 'eq', parts, tone });
const tens = (t: number, o: number, caption = true): Visual => ({ k: 'tens', tens: t, ones: o, caption });
const row = (items: Visual[], gap = 14): Visual => ({ k: 'row', items, gap, wrap: true });
const col = (items: Visual[], gap = 10): Visual => ({ k: 'col', items, gap });
const arrow: Visual = { k: 'big', text: '➜', tone: 'ink' };
const hourLater = (h: number, m: number): Visual => row([clock(h, m, { size: 'sm' }), arrow, clock(h === 12 ? 1 : h + 1, m, { size: 'sm' })], 10);
const GAME_LEVELS: (1 | 2 | 3)[] = [1, 1, 2, 2, 3];

/** 블록 16~20 (Day 76~99, 보스 날 제외). 선택 과제가 걸린 날은 off에 꺼졌을 때의 복습 수업이 있다. */
export const DAYS_16_20: DayDef[] = [
  // ───────── 블록 16: 규칙 찾기 ─────────
  {
    day: 76,
    kind: 'math',
    title: '규칙을 찾아요: 색과 그림',
    buddy: 'bear',
    intro: [
      {
        text: '되풀이되는 것을 규칙이라고 해. 빨간색, 파란색, 빨간색, 파란색이 이어졌으면 다음은 빨간색이야.',
        visual: { k: 'pattern', seq: ['tomato', 'sky', 'tomato', 'sky', 'tomato', 'sky', 'tomato'], blanks: [6], kind: 'color' },
      },
      {
        text: '그림도 규칙이 있어. 사과, 딸기, 딸기가 되풀이되면 사과 다음에는 딸기 두 개가 와.',
        visual: { k: 'pattern', seq: ['🍎', '🍓', '🍓', '🍎', '🍓', '🍓', '🍎'], blanks: [7], kind: 'emoji' },
      },
    ],
    explore: [
      { skill: 'pat.color', n: 5 },
      { skill: 'pat.emoji', n: 5 },
    ],
    game: { skill: 'game.pattern.a', levels: GAME_LEVELS },
    tip: '블록이나 구슬로 "빨강 파랑 빨강 파랑" 같은 규칙을 만들고 아이가 이어 가게 해 보세요. 반대로 아이가 규칙을 만들어 문제를 내도 좋아요.',
  },
  {
    day: 77,
    kind: 'math',
    title: '규칙을 찾아요: 모양과 수',
    buddy: 'bear',
    intro: [
      {
        text: '모양도 규칙이 있어. 동그라미, 세모가 되풀이되면 동그라미 다음에는 세모가 와.',
        visual: { k: 'pattern', seq: ['circle:sky', 'triangle:tangerine', 'circle:sky', 'triangle:tangerine', 'circle:sky'], blanks: [5], kind: 'shape' },
      },
      {
        text: '수에도 규칙이 있어. 2, 4, 6, 8은 2씩 커져. 다음에는 10이 와.',
        visual: { k: 'pattern', seq: ['2', '4', '6', '8'], blanks: [4], kind: 'text' },
      },
    ],
    explore: [
      { skill: 'pat.shape', n: 3 },
      { skill: 'pat.num', n: 4 },
      { skill: 'pat.rule', n: 3 },
    ],
    game: { skill: 'game.pattern.d', levels: GAME_LEVELS },
    tip: '계단 무늬, 타일, 옷 무늬에서 규칙을 찾아보게 해 주세요. "다음에는 무슨 색일까?" 하고 물어보면 좋아요.',
  },
  {
    day: 78,
    kind: 'life',
    title: '5분씩 세어 시계 읽기',
    buddy: 'owl',
    intro: [
      {
        text: '긴바늘이 숫자 하나를 지날 때마다 5분이 지나. 1에 있으면 5분, 2에 있으면 10분이야.',
        visual: row([clock(3, 5, { size: 'sm', mark: 'minute' }), clock(3, 10, { size: 'sm', mark: 'minute' })], 16),
      },
      {
        text: '3에 있으면 15분, 6에 있으면 30분, 9에 있으면 45분이야. 긴바늘 아래 숫자에 5씩 뛰어 세면 돼.',
        visual: row([clock(3, 15, { size: 'sm', mark: 'minute' }), clock(3, 30, { size: 'sm', mark: 'minute' }), clock(3, 45, { size: 'sm', mark: 'minute' })], 10),
      },
    ],
    explore: [{ skill: 'clk.five.read', n: 10 }],
    game: { skill: 'game.hands.five', levels: GAME_LEVELS },
    tip: '시계의 긴바늘이 가리키는 숫자에 5씩 뛰어 세면 분이 나온다고 알려 주세요. "5, 10, 15" 하고 손가락으로 짚으며 세면 쉬워요. 선택 과제라서 어려워하면 꺼 두어도 괜찮아요.',
    off: {
      flag: 'clock5',
      body: {
        kind: 'life',
        title: '시계 읽고 맞추기 놀이',
        buddy: 'owl',
        intro: [
          {
            text: '오늘은 시계 놀이 날이야! 긴바늘이 12에 있으면 정각, 6에 있으면 30분이야.',
            visual: row([clock(5, 0, { size: 'sm' }), clock(5, 30, { size: 'sm' })], 16),
          },
          {
            text: '짧은바늘이 가리키는 숫자가 시야. 30분일 때는 짧은바늘이 숫자 사이에 있어.',
            visual: clock(8, 30, { mark: 'hour' }),
          },
        ],
        explore: [
          { skill: 'clk.read.mix', n: 6 },
          { skill: 'clk.set.half', n: 4 },
        ],
        game: { skill: 'game.hands.half.b', levels: GAME_LEVELS },
        tip: '집에서 시계를 볼 때마다 "지금은 몇 시야? 몇 시 30분이야?" 하고 한 번씩 물어보세요. 정각과 30분은 이제 거의 다 익힌 거예요.',
      },
    },
  },
  {
    day: 79,
    kind: 'life',
    title: '5분 단위로 바늘 맞추기',
    buddy: 'owl',
    intro: [
      {
        text: '몇 시 10분을 맞출 때는 긴바늘을 2에 두고, 짧은바늘은 그 시를 막 지난 곳에 놓아.',
        visual: clock(7, 10),
      },
      {
        text: '5시 25분이면 긴바늘은 5에 두고, 짧은바늘은 5와 6 사이에 놓아.',
        visual: clock(5, 25),
      },
    ],
    explore: [
      { skill: 'clk.five.set', n: 7 },
      { skill: 'clk.five.read', n: 3 },
    ],
    game: { skill: 'game.hands.five', levels: GAME_LEVELS },
    tip: '시각을 말해 주고(예: "7시 10분") 아이가 시계 바늘을 돌려 맞추게 해 보세요. 긴바늘부터 맞추고 짧은바늘을 맞추면 헷갈리지 않아요.',
    off: {
      flag: 'clock5',
      body: {
        kind: 'life',
        title: '시계 짝 맞추기 놀이',
        buddy: 'owl',
        intro: [
          {
            text: '아날로그 시계와 디지털 시계가 같은 시각인지 짝지어 보자. 긴바늘이 6에 있으면 디지털 시계의 뒤 숫자는 30이야.',
            visual: row([clock(9, 30, { size: 'sm' }), digital(9, 30)], 16),
          },
          {
            text: '디지털 시계를 보고 아날로그 시계의 바늘을 돌려 맞춰도 좋아. 앞의 숫자가 시, 뒤의 숫자가 분이야.',
            visual: digital(11, 0),
          },
        ],
        explore: [
          { skill: 'clk.match.mix', n: 5 },
          { skill: 'clk.set.digital', n: 5 },
        ],
        game: { skill: 'game.hands.digital', levels: GAME_LEVELS },
        tip: '벽시계와 휴대폰 시계를 나란히 놓고 같은 시각인지 확인해 보게 해 주세요. 아이가 시각을 말하고 부모가 바늘을 돌리는 놀이도 좋아요.',
      },
    },
  },

  // ───────── 블록 17: 분류하기와 표 ─────────
  {
    day: 81,
    kind: 'math',
    title: '비슷한 것끼리 나누기',
    buddy: 'bear',
    intro: [
      {
        text: '여러 가지가 섞여 있을 때는 기준을 정해서 나눌 수 있어. 과일끼리, 동물끼리, 탈것끼리 모아 보자.',
        visual: { k: 'bag', items: ['🍎', '🐶', '🚗', '🍌', '🐱', '🚌', '🍓', '🐰', '🚲'] },
      },
      {
        text: '나눈 뒤에는 몇 개인지 세어서 비교해. 사과가 3개이고 바나나가 5개면 바나나가 2개 더 많아.',
        visual: row([{ k: 'objects', emoji: '🍎', n: 3, size: 'sm' }, { k: 'objects', emoji: '🍌', n: 5, size: 'sm' }], 20),
      },
    ],
    explore: [
      { skill: 'data.sort', n: 5 },
      { skill: 'data.count', n: 5 },
    ],
    game: { skill: 'game.sort.a', levels: GAME_LEVELS },
    tip: '장난감이나 빨래를 종류별로 나눠 보게 하고, 나눈 것의 개수를 세어 비교해 보세요. 기준을 바꿔서 한 번 더 나눠 봐도 좋아요.',
  },
  {
    day: 82,
    kind: 'math',
    title: '표와 그림그래프 읽기',
    buddy: 'bear',
    intro: [
      {
        text: '센 것을 표로 정리하면 한눈에 볼 수 있어. 표에서 사과는 3개, 바나나는 5개야.',
        visual: { k: 'table', head: ['과일', '개수'], rows: [['🍎 사과', 3], ['🍌 바나나', 5]] },
      },
      {
        text: '그림으로 나타낸 그래프도 있어. 그림이 더 많이 있는 줄이 더 많다는 뜻이야.',
        visual: {
          k: 'pictograph',
          rows: [
            { emoji: '🍎', n: 3, label: '사과' },
            { emoji: '🍌', n: 5, label: '바나나' },
          ],
        },
      },
    ],
    explore: [
      { skill: 'data.table', n: 5 },
      { skill: 'data.picto', n: 5 },
    ],
    game: { skill: 'game.sort.b', levels: GAME_LEVELS },
    tip: '집에 있는 과일이나 신발을 세어서 표로 적어 보게 해 주세요. "가장 많은 건 뭐야?", "몇 개 차이야?" 하고 물어보세요.',
  },
  {
    day: 83,
    kind: 'life',
    title: '1시간은 60분',
    buddy: 'owl',
    intro: [
      {
        text: '긴바늘이 한 바퀴를 돌면 1시간이 지난 거야. 1시간은 60분이야.',
        visual: hourLater(3, 0),
      },
      {
        text: '30분이 두 번이면 1시간이야. 짧은바늘이 숫자 하나만큼 움직이면 1시간이 지난 거야.',
        visual: eq(['30', '+', '30', '=', '60']),
      },
    ],
    explore: [{ skill: 'time.hour60', n: 10 }],
    game: { skill: 'game.hands.half.b', levels: GAME_LEVELS },
    tip: '30분짜리 만화 두 편을 보면 1시간이라는 식으로 생활에서 시간 길이를 느끼게 해 주세요. 선택 과제라서 어려워하면 꺼 두어도 괜찮아요.',
    off: {
      flag: 'hour60',
      body: {
        kind: 'life',
        title: '일과와 시계 놀이',
        buddy: 'owl',
        intro: [
          {
            text: '하루 일과를 시계로 읽어 보자. 일어나기 7시, 학교 가기 8시 30분처럼 시각이 같이 쓰여 있어.',
            visual: {
              k: 'routine',
              items: [
                { emoji: '⏰', label: '일어나기', time: '7시' },
                { emoji: '🎒', label: '학교 가기', time: '8시 30분' },
                { emoji: '🍱', label: '점심 먹기', time: '12시 30분' },
              ],
            },
          },
          {
            text: '일과표의 시각을 읽고 같은 시각을 가리키는 시계를 찾아봐. 8시 30분은 긴바늘이 6에 있어.',
            visual: clock(8, 30),
          },
        ],
        explore: [
          { skill: 'life.routineTime', n: 6 },
          { skill: 'clk.read.mix', n: 4 },
        ],
        game: { skill: 'game.routineMatch', levels: GAME_LEVELS },
        tip: '아이와 함께 우리 집 하루 일과표를 시계 그림과 함께 만들어 보세요. 일어나는 시각, 밥 먹는 시각, 자는 시각을 시계로 붙이면 좋아요.',
      },
    },
  },
  {
    day: 84,
    kind: 'life',
    title: '1시간 뒤의 시각',
    buddy: 'owl',
    intro: [
      {
        text: '1시간 뒤에는 짧은바늘이 숫자 하나만큼 앞으로 가. 3시에서 1시간 뒤는 4시야.',
        visual: hourLater(3, 0),
      },
      {
        text: '30분이 있어도 같아. 3시 30분에서 1시간 뒤는 4시 30분이야.',
        visual: hourLater(3, 30),
      },
    ],
    explore: [
      { skill: 'time.after', n: 7 },
      { skill: 'time.hour60', n: 3 },
    ],
    game: { skill: 'game.clockMatch.half.b', levels: GAME_LEVELS },
    tip: '"지금이 3시인데 1시간 뒤에 간식을 먹자" 같은 말을 해 보세요. 시계를 보며 1시간 뒤의 시각을 맞혀 보게 하면 좋아요.',
    off: {
      flag: 'hour60',
      body: {
        kind: 'life',
        title: '바늘 돌리기 놀이',
        buddy: 'owl',
        intro: [
          {
            text: '오늘은 바늘을 직접 돌려 시각을 맞춰 보자. 정각은 긴바늘이 12에, 30분은 긴바늘이 6에 놓아.',
            visual: row([clock(2, 0, { size: 'sm' }), clock(2, 30, { size: 'sm' })], 16),
          },
          {
            text: '디지털 시계가 알려 주는 시각에 맞춰도 돼. 앞의 숫자가 시, 뒤의 숫자가 분이야.',
            visual: digital(10, 30),
          },
        ],
        explore: [
          { skill: 'clk.set.half', n: 5 },
          { skill: 'clk.set.digital', n: 5 },
        ],
        game: { skill: 'game.hands.digital', levels: GAME_LEVELS },
        tip: '아이에게 시각을 말해 주고 시계 바늘을 돌려 맞추게 해 보세요. 반대로 부모가 바늘을 돌리고 아이가 시각을 말해도 좋아요.',
      },
    },
  },

  // ───────── 블록 18: 이야기 식 세우기 ─────────
  {
    day: 86,
    kind: 'math',
    title: '이야기를 읽고 더하기 식 세우기',
    buddy: 'bear',
    intro: [
      {
        text: '이야기에서 합치거나 더 받으면 더하기야. 사과 3개에 2개를 더 따면 3 + 2 = 5야.',
        say: '이야기에서 합치거나 더 받으면 더하기야. 사과 세 개에 두 개를 더 따면 삼 더하기 이는 오야.',
        visual: { k: 'groups', a: { emoji: '🍎', n: 3 }, b: { emoji: '🍎', n: 2 }, op: '+' },
      },
      {
        text: '‘모두’, ‘합쳐서’, ‘더 왔어요’ 같은 말이 나오면 더하기를 떠올려 봐. 그림으로 그려 보면 쉬워.',
        visual: { k: 'story', text: '공 4개가 있었어요. 2개를 더 가져왔어요. 모두 몇 개일까요?', emoji: '⚽' },
      },
    ],
    explore: [
      { skill: 'story.add', n: 7 },
      { skill: 'story.mix', n: 3 },
    ],
    game: { skill: 'game.story.a', levels: GAME_LEVELS },
    tip: '"귤이 4개 있는데 2개를 더 받았어. 모두 몇 개일까?" 하고 이야기를 만들어 식으로 말해 보게 해 주세요. 그림을 그려 보면 이해가 쉬워요.',
  },
  {
    day: 87,
    kind: 'math',
    title: '이야기를 읽고 빼기 식 세우기',
    buddy: 'bear',
    intro: [
      {
        text: '이야기에서 먹거나 가져가면 빼기야. 쿠키 5개 중에서 2개를 먹으면 5 − 2 = 3이야.',
        say: '이야기에서 먹거나 가져가면 빼기야. 쿠키 다섯 개 중에서 두 개를 먹으면 오 빼기 이는 삼이야.',
        visual: { k: 'objects', emoji: '🍪', n: 5, crossed: 2, layout: 'row', size: 'md' },
      },
      {
        text: '‘남은’, ‘먹었어요’ 같은 말이 나오면 빼기를 떠올려 봐. 누가 더 많은지 비교할 때도 빼기를 써.',
        visual: { k: 'groups', a: { emoji: '🍎', n: 5 }, b: { emoji: '🍌', n: 3 }, op: 'vs' },
      },
    ],
    explore: [
      { skill: 'story.sub', n: 6 },
      { skill: 'story.mix', n: 4 },
    ],
    game: { skill: 'game.story.b', levels: GAME_LEVELS },
    tip: '간식을 먹을 때 "과자가 6개 있었는데 2개 먹었어. 몇 개 남았을까?" 하고 이야기해 보세요. 먹은 것과 남은 것을 눈으로 확인하게 해요.',
  },
  {
    day: 88,
    kind: 'life',
    title: '학교 시간표 읽기',
    buddy: 'owl',
    intro: [
      {
        text: '학교에서는 시간마다 다른 수업을 해. 1교시, 2교시, 3교시는 위에서부터 차례로 읽어.',
        visual: {
          k: 'timetable',
          day: '월요일',
          periods: [
            { label: '1교시', subject: '국어', emoji: '📖' },
            { label: '2교시', subject: '수학', emoji: '🔢' },
            { label: '3교시', subject: '체육', emoji: '🏃' },
          ],
        },
      },
      {
        text: '시간표에서 수업 이름을 찾으면 몇 교시인지 알 수 있어. 국어 다음 시간은 수학이야.',
        visual: {
          k: 'timetable',
          day: '화요일',
          periods: [
            { label: '1교시', subject: '음악', emoji: '🎵' },
            { label: '2교시', subject: '국어', emoji: '📖' },
            { label: '3교시', subject: '수학', emoji: '🔢' },
            { label: '4교시', subject: '미술', emoji: '🎨' },
          ],
        },
      },
    ],
    explore: [{ skill: 'school.timetable', n: 10 }],
    game: { skill: 'game.school.a', levels: GAME_LEVELS },
    tip: '입학 전에 학교 시간표 사진이나 예시를 같이 보며 "1교시엔 뭐 해?" 하고 읽어 보게 해 주세요. 내일 챙길 준비물과 연결하면 더 좋아요.',
  },
  {
    day: 89,
    kind: 'life',
    title: '학교 가는 날의 하루',
    buddy: 'owl',
    intro: [
      {
        text: '학교 가는 날에는 일어나기, 아침밥, 학교 가기, 점심, 집에 오기가 시각마다 정해져 있어.',
        visual: {
          k: 'routine',
          items: [
            { emoji: '⏰', label: '일어나기', time: '7시' },
            { emoji: '🍚', label: '아침밥 먹기', time: '7시 30분' },
            { emoji: '🚌', label: '학교 가기', time: '8시 30분' },
            { emoji: '🍱', label: '점심 먹기', time: '12시 30분' },
            { emoji: '🏠', label: '집에 오기', time: '1시' },
          ],
        },
      },
      {
        text: '계획표의 시각을 읽고 시계에서 찾아보자. 8시 30분은 긴바늘이 6에 있어.',
        visual: clock(8, 30, { mark: 'minute' }),
      },
    ],
    explore: [
      { skill: 'school.day', n: 8 },
      { skill: 'school.timetable', n: 2 },
    ],
    game: { skill: 'game.school.b', levels: GAME_LEVELS },
    tip: '내일 아침에 일어나는 시각과 학교 가는 시각을 아이와 함께 계획표로 써 보세요. 시계 그림을 붙여 두면 스스로 확인할 수 있어요.',
  },

  // ───────── 블록 19: 세 수 계산과 시계 총정리 ─────────
  {
    day: 91,
    kind: 'math',
    title: '세 수로 계산하기',
    buddy: 'bear',
    intro: [
      {
        text: '세 수도 앞에서부터 차례로 계산해. 2 + 3 + 1은 먼저 2 + 3 = 5, 그다음 5 + 1 = 6이야.',
        say: '세 수도 앞에서부터 차례로 계산해. 이 더하기 삼 더하기 일은 먼저 이 더하기 삼이 오, 그다음 오 더하기 일이 육이야.',
        visual: eq(['2', '+', '3', '+', '1', '=', '6']),
      },
      {
        text: '빼기도 앞에서부터 해. 9 − 4 − 2는 먼저 9 − 4 = 5, 그다음 5 − 2 = 3이야. 더하기와 빼기가 섞여도 앞에서부터 해.',
        say: '빼기도 앞에서부터 해. 구 빼기 사 빼기 이는 먼저 구 빼기 사가 오, 그다음 오 빼기 이가 삼이야. 더하기와 빼기가 섞여도 앞에서부터 해.',
        visual: eq(['9', '−', '4', '−', '2', '=', '3'], 'tangerine'),
      },
    ],
    explore: [
      { skill: 'calc3.add', n: 4 },
      { skill: 'calc3.sub', n: 3 },
      { skill: 'calc3.mix', n: 3 },
    ],
    game: { skill: 'game.balloons.calc3', levels: GAME_LEVELS },
    tip: '"과자가 3개 있는데 2개를 더 받고 1개를 먹었어" 같은 세 단계 이야기를 만들어 보세요. 한 번에 하나씩 계산하는 습관을 들이면 좋아요.',
  },
  {
    day: 92,
    kind: 'math',
    title: '20 이내 계산과 10 만들기 도전',
    buddy: 'bear',
    intro: [
      {
        text: '10보다 큰 수도 더하고 뺄 수 있어. 13 + 5는 낱개끼리 3 + 5 = 8이니까 18이야.',
        say: '십보다 큰 수도 더하고 뺄 수 있어. 십삼 더하기 오는 낱개끼리 삼 더하기 오가 팔이니까 십팔이야.',
        visual: col([tens(1, 3, false), eq(['13', '+', '5', '=', '18'])]),
      },
      {
        text: '빼기도 같아. 16 − 4는 낱개끼리 6 − 4 = 2니까 12야. 10개 묶음은 그대로야.',
        say: '빼기도 같아. 십육 빼기 사는 낱개끼리 육 빼기 사가 이니까 십이야. 십 개 묶음은 그대로야.',
        visual: col([tens(1, 6, false), eq(['16', '−', '4', '=', '12'], 'tangerine')]),
      },
      {
        text: '8 + 5처럼 낱개끼리 더하면 10이 넘을 때는 10을 먼저 만들어. 8 + 2 = 10, 거기에 3을 더하면 13이야. 새 도전이라서 어려워도 괜찮아.',
        say: '팔 더하기 오처럼 낱개끼리 더하면 십이 넘을 때는 십을 먼저 만들어. 팔 더하기 이는 십, 거기에 삼을 더하면 십삼이야. 새 도전이라서 어려워도 괜찮아.',
        visual: eq(['8', '+', '5', '=', '13'], 'grape'),
      },
    ],
    explore: [
      { skill: 'calc20.add', n: 3 },
      { skill: 'calc20.sub', n: 3 },
      { skill: 'carry.taste', n: 4 },
    ],
    game: { skill: 'game.fish.calc20', levels: GAME_LEVELS },
    tip: '8 + 5는 "8에 2를 더해 10, 남은 3을 더해 13"으로 풀어 보게 해 주세요. 받아올림은 선택 과제라서 어려워하면 꺼 두어도 괜찮아요.',
    off: {
      flag: 'carry',
      body: {
        kind: 'math',
        title: '20 이내 더하기와 빼기',
        buddy: 'bear',
        intro: [
          {
            text: '10보다 큰 수도 더하고 뺄 수 있어. 13 + 5는 낱개끼리 3 + 5 = 8이니까 18이야.',
            say: '십보다 큰 수도 더하고 뺄 수 있어. 십삼 더하기 오는 낱개끼리 삼 더하기 오가 팔이니까 십팔이야.',
            visual: col([tens(1, 3, false), eq(['13', '+', '5', '=', '18'])]),
          },
          {
            text: '빼기도 같아. 16 − 4는 낱개끼리 6 − 4 = 2니까 12야. 10개 묶음은 그대로야.',
            say: '빼기도 같아. 십육 빼기 사는 낱개끼리 육 빼기 사가 이니까 십이야. 십 개 묶음은 그대로야.',
            visual: col([tens(1, 6, false), eq(['16', '−', '4', '=', '12'], 'tangerine')]),
          },
        ],
        explore: [
          { skill: 'calc20.add', n: 5 },
          { skill: 'calc20.sub', n: 5 },
        ],
        game: { skill: 'game.fish.calc20', levels: GAME_LEVELS },
        tip: '"12개 중에서 2개를 먹으면?", "14개에 3개를 더하면?" 같은 질문을 간식 시간에 해 보세요. 10개 묶음은 그대로 두고 낱개만 계산하게 해요.',
      },
    },
  },
  {
    day: 93,
    kind: 'life',
    title: '시계 총정리: 읽기',
    buddy: 'owl',
    intro: [
      {
        text: '정각은 긴바늘이 12에 있고, 30분은 긴바늘이 6에 있어. 짧은바늘이 가리키는 숫자가 시야.',
        visual: row([clock(5, 0, { size: 'sm' }), clock(5, 30, { size: 'sm' })], 16),
      },
      {
        text: '디지털 시계는 앞의 숫자가 시, 뒤의 숫자가 분이야. 정각은 뒤가 00이고 30분은 뒤가 30이야.',
        visual: row([digital(5, 0), digital(5, 30)], 16),
      },
    ],
    explore: [
      { skill: 'clk.total.hour', n: 5 },
      { skill: 'clk.total.half', n: 5 },
    ],
    game: { skill: 'game.hands.total', levels: GAME_LEVELS },
    tip: '하루 동안 시계를 볼 때마다 "몇 시야? 몇 시 30분이야?" 하고 읽어 보게 하고, 디지털 시계와 아날로그 시계를 둘 다 읽어 보게 해 주세요.',
  },
  {
    day: 94,
    kind: 'life',
    title: '시계 총정리: 맞추기',
    buddy: 'owl',
    intro: [
      {
        text: '시계를 읽는 것뿐 아니라 시각을 듣고 바늘을 맞출 수도 있어. 6시는 긴바늘을 12에, 짧은바늘을 6에 놓아.',
        visual: clock(6, 0),
      },
      {
        text: '6시 30분은 긴바늘을 6에 두고, 짧은바늘을 6과 7 사이에 놓아. 짝 맞추기도 같은 방법으로 풀면 돼.',
        visual: clock(6, 30),
      },
    ],
    explore: [
      { skill: 'clk.total.set', n: 6 },
      { skill: 'clk.total.hour', n: 2 },
      { skill: 'clk.total.half', n: 2 },
    ],
    game: { skill: 'game.clockMatch.total', levels: GAME_LEVELS },
    tip: '아이에게 시각을 말해 주고(예: "7시 30분") 시계 바늘을 돌려 맞추게 해 보세요. 반대로 아이가 시각을 말하고 부모가 맞춰도 좋아요.',
  },

  // ───────── 블록 20: 종합 모험 ─────────
  {
    day: 96,
    kind: 'math',
    title: '몇째와 위치 말',
    buddy: 'bear',
    intro: [
      {
        text: '줄을 서면 몇째인지 말할 수 있어. 왼쪽에서부터 첫째, 둘째, 셋째 하고 세어. 어느 쪽에서 세는지에 따라 몇째인지가 달라져.',
        visual: { k: 'queue', items: ['🐶', '🐱', '🐰', '🐻', '🐼'], sides: true },
      },
      {
        text: '다섯 명이 서 있으면 가운데 친구는 셋째야. 셋째 친구는 둘째와 넷째 사이에 있어.',
        visual: { k: 'queue', items: ['🐶', '🐱', '🐰', '🐻', '🐼'], mark: 2, sides: true },
      },
    ],
    explore: [
      { skill: 'term.ord', n: 6 },
      { skill: 'term.pos', n: 4 },
    ],
    game: { skill: 'game.adventure.num', levels: GAME_LEVELS },
    tip: '줄을 서거나 엘리베이터를 기다릴 때 "앞에서 몇째야?", "뒤에서 몇째야?" 하고 물어보세요. 왼쪽·오른쪽 말도 같이 써 봐요.',
  },
  {
    day: 97,
    kind: 'math',
    title: '수학 낱말 총정리',
    buddy: 'bear',
    intro: [
      {
        text: '‘모두’, ‘합쳐서’는 더하는 말이고, ‘남은’, ‘먹은’은 빼는 말이야. 문제에서 이런 낱말을 찾아봐.',
        visual: row([{ k: 'big', text: '모두 ➜ 더하기', tone: 'tangerine' }, { k: 'big', text: '남은 ➜ 빼기', tone: 'sky' }], 14),
      },
      {
        text: '‘더 많다’, ‘더 적다’는 두 수를 비교하는 말이야. 5개와 3개를 비교하면 5개가 2개 더 많아.',
        visual: { k: 'groups', a: { emoji: '🍎', n: 5 }, b: { emoji: '🍌', n: 3 }, op: 'vs' },
      },
    ],
    explore: [
      { skill: 'term.word', n: 7 },
      { skill: 'term.ord', n: 3 },
    ],
    game: { skill: 'game.story.b', levels: GAME_LEVELS },
    tip: '일상에서 "모두", "남은", "더 많은" 같은 말을 일부러 써서 질문해 보세요. 낱말을 듣고 더할지 뺄지 말해 보게 하면 좋아요.',
  },
  {
    day: 98,
    kind: 'life',
    title: '종합 모험: 시계와 달력',
    buddy: 'owl',
    intro: [
      {
        text: '오늘은 모험을 떠나는 날이야! 시계, 달력, 수를 모두 써서 길을 열어야 해.',
        visual: { k: 'big', text: '🏰', tone: 'grape' },
      },
      {
        text: '100일 동안 배운 것을 믿어 봐. 모르는 문제는 힌트를 눌러도 괜찮아.',
        visual: row([clock(3, 30, { size: 'sm' }), { k: 'weekdays', names: 'short' }], 14),
      },
    ],
    explore: [
      { skill: 'adv.time', n: 4 },
      { skill: 'adv.cal', n: 4 },
      { skill: 'adv.num', n: 2 },
    ],
    game: { skill: 'game.adventure.time', levels: GAME_LEVELS },
    tip: '오늘은 아이가 시계와 달력을 직접 보며 "오늘은 며칠이고 지금은 몇 시야?" 하고 말해 보게 해 주세요. 스스로 말하면 가장 오래 기억돼요.',
  },
  {
    day: 99,
    kind: 'life',
    title: '종합 모험: 돈과 수',
    buddy: 'bear',
    intro: [
      {
        text: '마지막 모험이야! 이번에는 돈을 쓰는 마을 가게와 수 문제가 나와.',
        visual: { k: 'coins', coins: [500, 100, 50, 10] },
      },
      {
        text: '내일은 100일째 마지막 보스전이야. 오늘 모험을 잘 마치면 준비가 끝나!',
        visual: { k: 'big', text: '🐲', tone: 'tomato' },
      },
    ],
    explore: [
      { skill: 'adv.money', n: 5 },
      { skill: 'adv.num', n: 3 },
      { skill: 'adv.time', n: 2 },
    ],
    game: { skill: 'game.adventure.money', levels: GAME_LEVELS },
    tip: '내일이 마지막 보스전이에요. 오늘은 칭찬을 듬뿍 해 주시고, 100일 동안 한 일을 같이 돌아보며 이야기해 보세요.',
  },
];
