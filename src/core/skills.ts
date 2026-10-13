import { WEEKDAYS_LONG } from './dates';
import { josa } from './ko';
import { arithGen, balloonsArithGen, mixGen } from './gen/arith';
import { calGridGen, dateReadGen, dateTodayGen, findDateGen, monthsGen, relDayGen, weekdayNameGen, weekdayOrderGen } from './gen/calendar';
import { eventGen, eventHuntGen, laterGen, laterHuntGen, monthLenGen, monthLoopTrainGen, weekLenGen, weekLoopTrainGen, yearLenGen } from './gen/calendar2';
import { clockPartsGen, daypartGen, halfReadGen, halfSeeGen, halfTapGen, hourHandGen, hourReadGen } from './gen/clock';
import { clockDigitalMatchGen, digitalHalfGen, digitalHourGen, digitalPickGen, digitalSetGen, digitalTapGen, fiveReadGen, fiveSetGen, hour60Gen, hourAfterGen } from './gen/clock2';
import { countCompareGen, pictoGen, sortGen, tableGen } from './gen/data';
import { buyGen, coinCompareGen, coinCountGen, coinNameGen, exchangeGen, moneyConfuse, shopPayGen } from './gen/money';
import { patternGen, patternNumGen, patternRuleGen } from './gen/pattern';
import { schoolDayGen, timetableGen } from './gen/school';
import { storyGen } from './gen/story';
import { ordGen, posGen, wordGen } from './gen/term';
import { balloonsTenGen, calc20Gen, calc3Gen, calcConfuse, carryTasteGen, tenEqGen, tenPairsGen, tenPicGen } from './gen/ten';
import { bondGen, compareGen, countGen, orderGen, writeGen } from './gen/number';
import { compareBigGen, orderBigGen, placeConfuse, readNumGen, skipGen, teenGen, tensGen, tensOnesGen } from './gen/place';
import {
  balloonsCompareGen,
  balloonsShapeGen,
  balloonsSolidGen,
  clockMatchGen,
  dateHuntGen,
  dayCardsGen,
  fishGen,
  handsGen,
  jarsGen,
  monthTrainGen,
  stonesGen,
  weekTrainGen,
} from './gen/games';
import { areaGen, lengthGen, lineupGen, weightGen } from './gen/measure';
import { routineGen, routineMatchGen, routineTimeGen } from './gen/routine';
import { shape2dGen, solidGen } from './gen/shape';
import { range } from './gen/util';
import { pick } from './rng';
import type { Area, GameId, GenCtx, OptionalFlag, Question, Skill } from './types';

const REGISTRY = new Map<string, Skill>();

function def(
  id: string,
  name: string,
  area: Area,
  gen: (c: GenCtx) => Question,
  extra: Partial<Pick<Skill, 'confuse' | 'optional' | 'game' | 'noBoss'>> = {},
): void {
  if (REGISTRY.has(id)) throw new Error(`중복된 스킬: ${id}`);
  REGISTRY.set(id, { id, name, area, gen, ...extra });
}

const hourConfuse: Skill['confuse'] = (e, g) => {
  const a = Number(e);
  const b = Number(g);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return null;
  const [x, y] = a < b ? [a, b] : [b, a];
  return `${x}시와 ${y}시 혼동`;
};
const weekdayConfuse: Skill['confuse'] = (e, g) => {
  const a = Number(e);
  const b = Number(g);
  if (!Number.isInteger(a) || !Number.isInteger(b) || a === b) return null;
  const [x, y] = a < b ? [a, b] : [b, a];
  return `${WEEKDAYS_LONG[x]}과 ${WEEKDAYS_LONG[y]} 혼동`;
};
const monthConfuse: Skill['confuse'] = (e, g) => {
  const a = Number(e);
  const b = Number(g);
  if (!Number.isInteger(a) || !Number.isInteger(b) || a === b) return null;
  const [x, y] = a < b ? [a, b] : [b, a];
  return `${x}월과 ${y}월 혼동`;
};

/** "3" 또는 "3:30" 또는 "3:0" 꼴의 시각 키를 읽는다 */
function parseTimeKey(k: string): { h: number; m: number } | null {
  const [hs, ms] = k.split(':');
  const h = Number(hs);
  const m = ms === undefined ? 0 : Number(ms);
  if (!Number.isInteger(h) || h < 1 || h > 12 || !Number.isInteger(m)) return null;
  return { h, m };
}
const timeLabel = (t: { h: number; m: number }): string => (t.m === 0 ? `${t.h}시` : `${t.h}시 ${t.m}분`);
/** 정각·30분 시각 사이의 헷갈림: "3시와 3시 30분 혼동", "3시 30분과 4시 30분 혼동" */
const halfConfuse: Skill['confuse'] = (e, g) => {
  const a = parseTimeKey(e);
  const b = parseTimeKey(g);
  if (!a || !b || (a.h === b.h && a.m === b.m)) return null;
  const [x, y] = a.h * 60 + a.m < b.h * 60 + b.m ? [a, b] : [b, a];
  const lx = timeLabel(x);
  return `${lx}${josa(lx, '과/와')} ${timeLabel(y)} 혼동`;
};
/** 긴바늘이 12인지 6인지 */
const halfKindConfuse: Skill['confuse'] = (e, g) => (e === g ? null : '정각과 30분 혼동');
/** 날짜를 읽을 때 헷갈린 부분을 큰 갈래로 묶는다 */
const dateConfuse: Skill['confuse'] = (e, g) => {
  const a = e.split('-');
  const b = g.split('-');
  if (e === g || a.length !== b.length) return null;
  if (a.length === 1) return /^\d+$/.test(e) && /^\d+$/.test(g) ? '며칠인지 헷갈림' : null;
  if (a[0] !== b[0]) return '몇 월인지 헷갈림';
  if (a[1] !== b[1]) return '며칠인지 헷갈림';
  if (a[2] !== b[2]) return '요일이 헷갈림';
  return null;
};
/** 답이 정확히 1 차이로 틀린 경우 */
const offByOne = (what: string) => (e: string, g: string): string | null => {
  const a = Number(e);
  const b = Number(g);
  return Number.isInteger(a) && Number.isInteger(b) && Math.abs(a - b) === 1 ? `${what} 하나 차이로 틀림` : null;
};
const opConfuse: Skill['confuse'] = (e, g) => ((e === '+' && g === '−') || (e === '−' && g === '+') ? '더하기와 빼기 혼동' : offByOne('덧셈·뺄셈')(e, g));

// ---- 블록 1 ----
def('num.count5', '5까지 세기', 'num', countGen({ lo: 1, hi: 5, l1hi: 3 }));
def('num.count10', '10까지 세기·읽기', 'num', countGen({ lo: 6, hi: 10, l1hi: 8 }));
def('num.write', '숫자 따라 쓰기', 'num', writeGen({ lo: 1, hi: 10 }), { noBoss: true });
def('cal.weekdayName', '요일 이름', 'cal', weekdayNameGen, { confuse: weekdayConfuse });
def('cal.weekdayOrder', '요일 순서', 'cal', weekdayOrderGen, { confuse: weekdayConfuse });

// ---- 블록 2 ----
def('num.order10', '10까지 수의 순서', 'num', orderGen({ lo: 1, hi: 10 }));
def('num.compare10', '10까지 수의 크기 비교', 'num', compareGen({ lo: 1, hi: 10 }));
def('clk.parts', '시계의 구성', 'clock', clockPartsGen);
def('clk.hourHand', '짧은바늘이 가리키는 숫자', 'clock', hourHandGen);

// ---- 블록 3 ----
def('num.split5', '5 이하 가르기', 'num', bondGen({ lo: 2, hi: 5, mode: 'split' }));
def('num.merge5', '5 이하 모으기', 'num', bondGen({ lo: 2, hi: 5, mode: 'merge' }));
def('clk.hour.a', '정각 읽기 (1~3시)', 'clock', hourReadGen({ hours: [1, 2, 3] }), { confuse: hourConfuse });
def('clk.hour.b', '정각 읽기 (4~6시)', 'clock', hourReadGen({ hours: [4, 5, 6] }), { confuse: hourConfuse });

// ---- 블록 4 ----
def('num.split10', '10 이하 가르기', 'num', bondGen({ lo: 6, hi: 10, mode: 'split' }));
def('num.merge10', '10 이하 모으기', 'num', bondGen({ lo: 6, hi: 10, mode: 'merge' }));
def('clk.hour.c', '정각 읽기 (7~12시)', 'clock', hourReadGen({ hours: [7, 8, 9, 10, 11, 12] }), { confuse: hourConfuse });
def('time.daypart', '아침·낮·저녁', 'clock', daypartGen);

// ---- 블록 5 ----
def('geo.solid', '상자·둥근 기둥·공 모양', 'shape', solidGen);
def('geo.shape2d', '네모·세모·동그라미', 'shape', shape2dGen);
def('cal.months', '12개월', 'cal', monthsGen, { confuse: monthConfuse });
def('cal.grid', '달력 보는 법', 'cal', calGridGen, { confuse: weekdayConfuse });

// ---- 블록 6 ----
def('add.pic5', '덧셈: 합치기 (합 5 이하)', 'num', arithGen({ op: '+', lo: 2, hi: 5, l1hi: 4, form: 'pic' }), { confuse: offByOne('덧셈') });
def('add.eq5', '덧셈식 (합 5 이하)', 'num', arithGen({ op: '+', lo: 2, hi: 5, l1hi: 4, form: 'eq' }), { confuse: offByOne('덧셈') });
def('clk.half.see', '정각과 30분 구별', 'clock', halfSeeGen, { confuse: halfKindConfuse });
def('clk.half.a', '몇 시 30분 읽기 (1~6시)', 'clock', halfReadGen({ hours: range(1, 6) }), { confuse: halfConfuse });

// ---- 블록 7 ----
def('add.pic9', '덧셈: 합치기 (합 9 이하)', 'num', arithGen({ op: '+', lo: 5, hi: 9, l1hi: 7, form: 'pic' }), { confuse: offByOne('덧셈') });
def('add.eq9', '덧셈식 (합 9 이하)', 'num', arithGen({ op: '+', lo: 5, hi: 9, l1hi: 7, form: 'eq' }), { confuse: offByOne('덧셈') });
def('clk.half.b', '몇 시 30분 읽기 (7~12시)', 'clock', halfReadGen({ hours: range(7, 12) }), { confuse: halfConfuse });
def('clk.read.mix', '몇 시·몇 시 30분 읽기', 'clock', halfReadGen({ hours: range(1, 12), mix: true }), { confuse: halfConfuse });
def('clk.set.half', '시계 바늘 맞추기 (몇 시, 몇 시 30분)', 'clock', handsGen({ hours: range(1, 12), wording: 'time', half: 0.6, halfFrom: 1 }), { confuse: halfConfuse });

// ---- 블록 8 ----
def('sub.pic5', '뺄셈: 덜어 내기 (5 이하)', 'num', arithGen({ op: '−', lo: 2, hi: 5, l1hi: 4, form: 'pic' }), { confuse: offByOne('뺄셈') });
def('sub.eq5', '뺄셈식 (5 이하)', 'num', arithGen({ op: '−', lo: 2, hi: 5, l1hi: 4, form: 'eq' }), { confuse: offByOne('뺄셈') });
def('cal.today', '오늘은 몇 월 며칠', 'cal', dateTodayGen, { confuse: dateConfuse });
def('cal.dateRead', '달력에서 날짜 읽기', 'cal', dateReadGen, { confuse: dateConfuse });

// ---- 블록 9 ----
def('sub.pic9', '뺄셈: 덜어 내기 (9 이하)', 'num', arithGen({ op: '−', lo: 5, hi: 9, l1hi: 7, form: 'pic' }), { confuse: offByOne('뺄셈') });
def('sub.eq9', '뺄셈식 (9 이하)', 'num', arithGen({ op: '−', lo: 5, hi: 9, l1hi: 7, form: 'eq' }), { confuse: offByOne('뺄셈') });
def('mix.addsub9', '덧셈·뺄셈 섞기 (9 이하)', 'num', mixGen({ hi: 9, l1hi: 6 }), { confuse: opConfuse });
def('cal.relday', '어제·오늘·내일', 'cal', relDayGen, { confuse: dateConfuse });
def('cal.find', '달력에서 날짜 찾기', 'cal', findDateGen, { confuse: dateConfuse });

// ---- 블록 10 ----
def('cmp.length', '길이·높이 비교', 'measure', lengthGen);
def('cmp.weight', '무게 비교', 'measure', weightGen);
def('cmp.area', '넓이 비교', 'measure', areaGen);
def('life.routine', '하루 일과 순서', 'life', routineGen);
def('life.routineTime', '일과와 시각', 'life', routineTimeGen, { confuse: halfConfuse });

// ---- 블록 11 ----
def('num.count20', '20까지 세기', 'num', countGen({ lo: 11, hi: 20, l1hi: 15 }), { confuse: offByOne('세기') });
def('num.teen', '십 몇 (11~19)', 'num', teenGen, { confuse: placeConfuse });
def('num.order20', '20까지 수의 순서', 'num', orderBigGen({ lo: 10, hi: 20 }), { confuse: placeConfuse });
def('num.compare20', '20까지 수의 크기 비교', 'num', compareBigGen({ lo: 11, hi: 20 }));

// ---- 블록 12 ----
def('num.count50', '50까지 세기', 'num', countGen({ lo: 21, hi: 50, l1hi: 30 }), { confuse: placeConfuse });
def('num.tens50', '몇십 (10~50)', 'num', tensGen({ minTens: 1, maxTens: 5 }), { confuse: placeConfuse });
def('num.tensOnes50', '몇십몇: 묶음과 낱개 (50까지)', 'num', tensOnesGen({ lo: 21, hi: 49, l1hi: 39 }), { confuse: placeConfuse });
def('num.read50', '수 읽기 (50까지)', 'num', readNumGen({ lo: 11, hi: 50 }), { confuse: placeConfuse });

// ---- 블록 13 ----
def('num.order50', '50까지 수의 순서', 'num', orderBigGen({ lo: 20, hi: 50 }), { confuse: placeConfuse });
def('num.compare50', '50까지 수의 크기 비교', 'num', compareBigGen({ lo: 21, hi: 50 }));
def('num.skip.a', '10씩·5씩 뛰어 세기', 'num', skipGen({ steps: [10, 5], hi: 50 }), { confuse: offByOne('뛰어 세기') });
def('num.skip.b', '2씩·5씩·10씩 뛰어 세기', 'num', skipGen({ steps: [2, 5, 10], hi: 50 }), { confuse: offByOne('뛰어 세기') });

// ---- 블록 14 ----
def('num.tens100', '몇십 (60~100)', 'num', tensGen({ minTens: 6, maxTens: 10 }), { confuse: placeConfuse });
def('num.tensOnes100', '몇십몇: 묶음과 낱개 (99까지)', 'num', tensOnesGen({ lo: 51, hi: 99, l1hi: 69 }), { confuse: placeConfuse });
def('num.read100', '수 읽기 (99까지)', 'num', readNumGen({ lo: 51, hi: 99 }), { confuse: placeConfuse });
def('num.order100', '100까지 수의 순서', 'num', orderBigGen({ lo: 50, hi: 100 }), { confuse: placeConfuse });
def('num.compare100', '100까지 수의 크기 비교', 'num', compareBigGen({ lo: 51, hi: 100 }));

// ---- 보너스 게임 (블록 1~5) ----
function game(id: string, name: string, area: Area, gameId: GameId, gen: (c: GenCtx) => Question, confuse?: Skill['confuse'], optional?: OptionalFlag): void {
  def(id, name, area, gen, { game: gameId, noBoss: true, ...(confuse ? { confuse } : {}), ...(optional ? { optional } : {}) });
}

/** 여러 스킬의 문제를 번갈아 내는 종합 스킬. 문제는 고른 스킬의 생성기가 만들고, 기록은 이 종합 스킬로 남는다. */
function mixOf(ids: string[]): (c: GenCtx) => Question {
  return (c) => getSkill(pick(c.rng, ids)).gen(c);
}
game('game.fish.5', '별 낚시 (5까지)', 'num', 'fish', fishGen({ lo: 1, hi: 5 }));
game('game.fish.10', '별 낚시 (10까지)', 'num', 'fish', fishGen({ lo: 1, hi: 10 }));
game('game.weekTrain.a', '요일 기차', 'cal', 'weekTrain', weekTrainGen, weekdayConfuse);
game('game.stones.10', '징검다리 (10까지)', 'num', 'stones', stonesGen({ lo: 1, hi: 10 }));
game('game.balloons.cmp10', '풍선 터뜨리기 (크기 비교)', 'num', 'balloons', balloonsCompareGen({ lo: 1, hi: 10 }));
game('game.hands.point.a', '바늘 돌리기 (짧은바늘 12·3·6·9)', 'clock', 'hands', handsGen({ hours: [12, 3, 6, 9], wording: 'pointer' }), hourConfuse);
game('game.hands.point.b', '바늘 돌리기 (짧은바늘 1~12)', 'clock', 'hands', handsGen({ hours: range(1, 12), wording: 'pointer' }), hourConfuse);
game('game.jars.split5', '구슬 병 (5 가르기)', 'num', 'jars', jarsGen({ lo: 2, hi: 5, mode: 'split' }));
game('game.jars.mix5', '구슬 병 (5 가르기·모으기)', 'num', 'jars', jarsGen({ lo: 2, hi: 5, mode: 'mix' }));
game('game.hands.time.a', '바늘 돌리기 (1~3시)', 'clock', 'hands', handsGen({ hours: [1, 2, 3], wording: 'time' }), hourConfuse);
game('game.hands.time.b', '바늘 돌리기 (4~6시)', 'clock', 'hands', handsGen({ hours: [4, 5, 6], wording: 'time' }), hourConfuse);
game('game.clockMatch.b', '시계 짝 맞추기 (1~6시)', 'clock', 'clockMatch', clockMatchGen({ hours: [1, 2, 3, 4, 5, 6] }), hourConfuse);
game('game.jars.split10', '구슬 병 (10 가르기)', 'num', 'jars', jarsGen({ lo: 6, hi: 10, mode: 'split' }));
game('game.jars.mix10', '구슬 병 (10 가르기·모으기)', 'num', 'jars', jarsGen({ lo: 6, hi: 10, mode: 'mix' }));
game('game.hands.time.c', '바늘 돌리기 (7~12시)', 'clock', 'hands', handsGen({ hours: [7, 8, 9, 10, 11, 12], wording: 'time' }), hourConfuse);
game('game.dayCards', '하루 카드', 'clock', 'dayCards', dayCardsGen);
game('game.balloons.solid', '풍선 터뜨리기 (입체 모양)', 'shape', 'balloons', balloonsSolidGen);
game('game.balloons.shape', '풍선 터뜨리기 (평면 모양)', 'shape', 'balloons', balloonsShapeGen);
game('game.monthTrain', '달 기차', 'cal', 'weekTrain', monthTrainGen, monthConfuse);
game('game.dateHunt.a', '날짜 보물찾기', 'cal', 'dateHunt', dateHuntGen, weekdayConfuse);

// ---- 보너스 게임 (블록 6~10) ----
game('game.jars.merge5', '구슬 병 (5 모으기)', 'num', 'jars', jarsGen({ lo: 2, hi: 5, mode: 'merge' }));
game('game.balloons.halfSee', '풍선 터뜨리기 (정각·30분 시계)', 'clock', 'balloons', halfTapGen, halfKindConfuse);
game('game.balloons.add5', '풍선 터뜨리기 (더하기 5까지)', 'num', 'balloons', balloonsArithGen({ op: '+', lo: 2, hi: 5 }));
game('game.hands.half.a', '바늘 돌리기 (몇 시 30분, 1~6시)', 'clock', 'hands', handsGen({ hours: range(1, 6), wording: 'time', half: 0.6, halfFrom: 1 }), halfConfuse);
game('game.clockMatch.half.a', '시계 짝 맞추기 (30분 포함, 1~6시)', 'clock', 'clockMatch', clockMatchGen({ hours: range(1, 6), half: 0.6, halfFrom: 1 }), halfConfuse);
game('game.balloons.add9', '풍선 터뜨리기 (더하기 9까지)', 'num', 'balloons', balloonsArithGen({ op: '+', lo: 5, hi: 9 }));
game('game.fish.add9', '별 낚시 (더하기)', 'num', 'fish', arithGen({ op: '+', lo: 2, hi: 9, l1hi: 6, form: 'eq' }), offByOne('덧셈'));
game('game.hands.half.b', '바늘 돌리기 (몇 시 30분, 7~12시)', 'clock', 'hands', handsGen({ hours: range(7, 12), wording: 'time', half: 0.6, halfFrom: 1 }), halfConfuse);
game('game.clockMatch.half.b', '시계 짝 맞추기 (30분 포함, 1~12시)', 'clock', 'clockMatch', clockMatchGen({ hours: range(1, 12), half: 0.5, halfFrom: 1 }), halfConfuse);
game('game.balloons.sub5', '풍선 터뜨리기 (빼기 5까지)', 'num', 'balloons', balloonsArithGen({ op: '−', lo: 2, hi: 5 }));
game('game.balloons.sub9', '풍선 터뜨리기 (빼기 9까지)', 'num', 'balloons', balloonsArithGen({ op: '−', lo: 5, hi: 9 }));
game('game.fish.sub9', '별 낚시 (빼기)', 'num', 'fish', arithGen({ op: '−', lo: 2, hi: 9, l1hi: 6, form: 'eq' }), offByOne('뺄셈'));
game('game.balloons.mix9', '풍선 터뜨리기 (더하기·빼기 9까지)', 'num', 'balloons', balloonsArithGen({ op: 'mix', lo: 2, hi: 9 }));
game('game.lineup', '막대 줄 세우기', 'measure', 'lineup', lineupGen);
game('game.seesaw', '시소 놀이', 'measure', 'seesaw', weightGen);
game('game.routineMatch', '일과와 시계 짝 맞추기', 'life', 'clockMatch', routineMatchGen, halfConfuse);


// ---------------------------------------------------------------------------
// 3단계: 블록 11~20
// ---------------------------------------------------------------------------

// ---- 블록 11 ----
def('clk.digital.hour', '디지털 시계 읽기 (정각)', 'clock', digitalHourGen, { confuse: hourConfuse });
def('clk.digital.half', '디지털 시계 읽기 (30분)', 'clock', digitalHalfGen, { confuse: halfConfuse });
def('clk.digital.pick', '아날로그·디지털 시계 고르기', 'clock', digitalPickGen, { confuse: halfConfuse });
def('clk.match.mix', '시계 짝 맞추기 (아날로그·디지털)', 'clock', clockDigitalMatchGen({ hours: range(1, 12), half: 0.5, halfFrom: 2 }), { confuse: halfConfuse });
def('clk.set.digital', '디지털 시계에 맞춰 바늘 돌리기', 'clock', digitalSetGen({ hours: range(1, 12), half: 0.5, halfFrom: 2 }), { confuse: halfConfuse });
game('game.fish.20', '별 낚시 (20까지)', 'num', 'fish', fishGen({ lo: 11, hi: 20 }), offByOne('세기'));
game('game.stones.20', '징검다리 (20까지)', 'num', 'stones', stonesGen({ lo: 1, hi: 20 }), placeConfuse);
game('game.balloons.cmp20', '풍선 터뜨리기 (20까지 크기 비교)', 'num', 'balloons', balloonsCompareGen({ lo: 11, hi: 20 }));
game('game.balloons.digital', '풍선 터뜨리기 (디지털 시계)', 'clock', 'balloons', digitalTapGen, halfKindConfuse);
game('game.clockMatch.digital', '시계 짝 맞추기 (디지털 시계)', 'clock', 'clockMatch', clockDigitalMatchGen({ hours: range(1, 12), half: 0.5, halfFrom: 1 }), halfConfuse);
game('game.hands.digital', '바늘 돌리기 (디지털 시계 보고)', 'clock', 'hands', digitalSetGen({ hours: range(1, 12), half: 0.5, halfFrom: 1 }), halfConfuse);

// ---- 블록 12 ----
def('cal.weekLen', '일주일은 며칠', 'cal', weekLenGen);
def('cal.monthLen', '한 달은 며칠', 'cal', monthLenGen);
def('cal.yearLen', '일 년은 열두 달', 'cal', yearLenGen);
game('game.fish.50', '별 낚시 (50까지)', 'num', 'fish', fishGen({ lo: 21, hi: 50 }), placeConfuse);
game('game.bundle.a', '선물 포장 (50까지)', 'num', 'bundle', tensOnesGen({ lo: 21, hi: 49, l1hi: 39 }), placeConfuse);
game('game.weekLoop', '요일 기차 (일주일 돌기)', 'cal', 'weekTrain', weekLoopTrainGen, weekdayConfuse);
game('game.monthLoop', '달 기차 (열두 달 돌기)', 'cal', 'weekTrain', monthLoopTrainGen, monthConfuse);

// ---- 블록 13 ----
def('cal.event', '가족 기념일 찾기', 'cal', eventGen, { confuse: dateConfuse });
def('cal.later', '며칠 뒤 세어 보기', 'cal', laterGen, { confuse: dateConfuse });
game('game.stones.50', '징검다리 (50까지)', 'num', 'stones', stonesGen({ lo: 1, hi: 50 }), placeConfuse);
game('game.stones.skip', '징검다리 (뛰어 세기)', 'num', 'stones', skipGen({ steps: [2, 5, 10], hi: 50 }), offByOne('뛰어 세기'));
game('game.balloons.cmp50', '풍선 터뜨리기 (50까지 크기 비교)', 'num', 'balloons', balloonsCompareGen({ lo: 21, hi: 50 }));
game('game.dateHunt.event', '날짜 보물찾기 (기념일)', 'cal', 'dateHunt', eventHuntGen, dateConfuse);
game('game.dateHunt.later', '날짜 보물찾기 (며칠 뒤)', 'cal', 'dateHunt', laterHuntGen, dateConfuse);

// ---- 블록 14 ----
def('money.coinName', '동전 알아보기', 'money', coinNameGen, { confuse: moneyConfuse });
def('money.coinCompare', '동전 값 비교하기', 'money', coinCompareGen, { confuse: moneyConfuse });
def('money.exchange', '동전 바꾸기', 'money', exchangeGen, { confuse: moneyConfuse });
game('game.stones.100', '징검다리 (100까지)', 'num', 'stones', stonesGen({ lo: 1, hi: 100 }), placeConfuse);
game('game.bundle.b', '선물 포장 (99까지)', 'num', 'bundle', tensOnesGen({ lo: 51, hi: 99, l1hi: 69 }), placeConfuse);
game('game.balloons.cmp100', '풍선 터뜨리기 (100까지 크기 비교)', 'num', 'balloons', balloonsCompareGen({ lo: 51, hi: 100 }));
game('game.shop.a', '마을 가게 (100원 안에서)', 'money', 'shop', shopPayGen({ denoms: [10, 50, 100], maxWon: 100 }), moneyConfuse);
game('game.shop.b', '마을 가게 (동전 세 가지)', 'money', 'shop', shopPayGen({ denoms: [10, 50, 100], maxWon: 300 }), moneyConfuse);

// ---- 블록 15 ----
def('ten.pic', '10 만들기: 그림', 'num', tenPicGen, { confuse: calcConfuse });
def('ten.eq', '10 만들기: 식', 'num', tenEqGen, { confuse: calcConfuse });
def('ten.pairs', '10이 되는 짝 찾기', 'num', tenPairsGen, { confuse: calcConfuse });
def('money.count', '동전 세기', 'money', coinCountGen, { confuse: moneyConfuse });
def('money.buy', '500원 안에서 물건 사기', 'money', buyGen, { confuse: moneyConfuse });
game('game.jars.ten', '구슬 병 (10 만들기)', 'num', 'jars', jarsGen({ lo: 10, hi: 10, mode: 'mix' }), calcConfuse);
game('game.balloons.ten', '풍선 터뜨리기 (10 만들기)', 'num', 'balloons', balloonsTenGen, calcConfuse);
game('game.shop.c', '마을 가게 (300원 안에서)', 'money', 'shop', shopPayGen({ denoms: [10, 50, 100], maxWon: 300, fine: true }), moneyConfuse);
game('game.shop.d', '마을 가게 (500원 안에서)', 'money', 'shop', shopPayGen({ denoms: [10, 50, 100, 500], maxWon: 500, fine: true }), moneyConfuse);

// ---- 블록 16 ----
def('pat.color', '색 규칙 찾기', 'pattern', patternGen('color'));
def('pat.emoji', '그림 규칙 찾기', 'pattern', patternGen('emoji'));
def('pat.shape', '모양 규칙 찾기', 'pattern', patternGen('shape'));
def('pat.num', '수 규칙 찾기', 'pattern', patternNumGen, { confuse: offByOne('규칙') });
def('pat.rule', '규칙 말하기와 틀린 것 찾기', 'pattern', patternRuleGen);
def('clk.five.read', '5분 단위 시계 읽기', 'clock', fiveReadGen, { optional: 'clock5' });
def('clk.five.set', '5분 단위로 바늘 맞추기', 'clock', fiveSetGen, { optional: 'clock5' });
game('game.pattern.a', '구슬 꿰기 (색)', 'pattern', 'pattern', patternGen('color'));
game('game.pattern.b', '구슬 꿰기 (그림)', 'pattern', 'pattern', patternGen('emoji'));
game('game.pattern.c', '구슬 꿰기 (모양)', 'pattern', 'pattern', patternGen('shape'));
game('game.pattern.d', '구슬 꿰기 (수)', 'pattern', 'pattern', patternNumGen, offByOne('규칙'));
game('game.hands.five', '바늘 돌리기 (5분 단위)', 'clock', 'hands', fiveSetGen, undefined, 'clock5');

// ---- 블록 17 ----
def('data.sort', '분류하기', 'data', sortGen);
def('data.count', '세어서 비교하기', 'data', countCompareGen);
def('data.table', '표 읽기', 'data', tableGen);
def('data.picto', '그림그래프 읽기', 'data', pictoGen);
def('time.hour60', '1시간은 60분', 'clock', hour60Gen, { optional: 'hour60' });
def('time.after', '1시간 뒤의 시각', 'clock', hourAfterGen, { optional: 'hour60', confuse: halfConfuse });
game('game.sort.a', '장난감 정리 (분류)', 'data', 'sort', sortGen);
game('game.sort.b', '장난감 정리 (세기와 표)', 'data', 'sort', tableGen);
game('game.sort.c', '장난감 정리 (비교)', 'data', 'sort', countCompareGen);

// ---- 블록 18 ----
def('story.add', '이야기 식 세우기 (더하기)', 'story', storyGen({ op: '+' }), { confuse: opConfuse });
def('story.sub', '이야기 식 세우기 (빼기)', 'story', storyGen({ op: '−' }), { confuse: opConfuse });
def('story.mix', '이야기 식 세우기 (더하기·빼기)', 'story', storyGen({ op: 'mix' }), { confuse: opConfuse });
def('school.timetable', '학교 시간표 읽기', 'life', timetableGen);
def('school.day', '학교 가는 날의 하루', 'life', schoolDayGen, { confuse: halfConfuse });
game('game.story.a', '이야기 극장 (더하기)', 'story', 'story', storyGen({ op: '+' }), opConfuse);
game('game.story.b', '이야기 극장 (빼기)', 'story', 'story', storyGen({ op: '−' }), opConfuse);
game('game.school.a', '학교 가는 길 (시간표)', 'life', 'school', timetableGen);
game('game.school.b', '학교 가는 길 (하루 계획)', 'life', 'school', schoolDayGen, halfConfuse);

// ---- 블록 19 ----
def('calc3.add', '세 수 더하기', 'num', calc3Gen({ kind: 'add' }), { confuse: calcConfuse });
def('calc3.sub', '세 수 빼기', 'num', calc3Gen({ kind: 'sub' }), { confuse: calcConfuse });
def('calc3.mix', '세 수 더하고 빼기', 'num', calc3Gen({ kind: 'mix' }), { confuse: calcConfuse });
def('calc20.add', '20 이내 덧셈 (받아올림 없음)', 'num', calc20Gen({ op: '+' }), { confuse: calcConfuse });
def('calc20.sub', '20 이내 뺄셈 (받아내림 없음)', 'num', calc20Gen({ op: '−' }), { confuse: calcConfuse });
def('carry.taste', '받아올림 맛보기 (8 + 5)', 'num', carryTasteGen, { optional: 'carry', confuse: calcConfuse });
def('clk.total.hour', '시계 총정리: 정각', 'clock', mixOf(['clk.hour.a', 'clk.hour.b', 'clk.hour.c', 'clk.digital.hour']), { confuse: hourConfuse });
def('clk.total.half', '시계 총정리: 30분', 'clock', mixOf(['clk.half.a', 'clk.half.b', 'clk.digital.half', 'clk.read.mix']), { confuse: halfConfuse });
def('clk.total.set', '시계 총정리: 바늘 맞추기와 짝 맞추기', 'clock', mixOf(['clk.set.half', 'clk.set.digital', 'clk.match.mix']), { confuse: halfConfuse });
game('game.balloons.calc3', '풍선 터뜨리기 (세 수 계산)', 'num', 'balloons', calc3Gen({ kind: 'mix' }), calcConfuse);
game('game.fish.calc20', '별 낚시 (20 이내 계산)', 'num', 'fish', mixOf(['calc20.add', 'calc20.sub']), calcConfuse);
game('game.hands.total', '바늘 돌리기 (정각과 30분 총정리)', 'clock', 'hands', handsGen({ hours: range(1, 12), wording: 'time', half: 0.5, halfFrom: 1 }), halfConfuse);
game('game.clockMatch.total', '시계 짝 맞추기 (총정리)', 'clock', 'clockMatch', mixOf(['game.clockMatch.half.b', 'game.clockMatch.digital']), halfConfuse);

// ---- 블록 20 ----
def('term.ord', '몇째', 'mix', ordGen);
def('term.pos', '위치를 나타내는 말', 'mix', posGen);
def('term.word', '모두·남은·더 많은', 'mix', wordGen);
def('adv.num', '종합 모험: 수와 계산', 'mix', mixOf(['num.compare100', 'num.tensOnes100', 'ten.eq', 'calc20.add', 'calc20.sub', 'calc3.mix', 'story.mix']));
def('adv.time', '종합 모험: 시계', 'mix', mixOf(['clk.total.hour', 'clk.total.half', 'clk.total.set', 'school.day', 'life.routineTime']), { confuse: halfConfuse });
def('adv.cal', '종합 모험: 달력', 'mix', mixOf(['cal.weekdayOrder', 'cal.find', 'cal.event', 'cal.later', 'cal.monthLen', 'cal.yearLen']), { confuse: dateConfuse });
def('adv.money', '종합 모험: 돈', 'mix', mixOf(['money.coinName', 'money.count', 'money.buy', 'money.exchange']), { confuse: moneyConfuse });
game('game.adventure.num', '종합 모험 (수와 계산)', 'mix', 'adventure', mixOf(['num.compare100', 'ten.eq', 'calc20.add', 'calc20.sub', 'story.mix']));
game('game.adventure.time', '종합 모험 (시간과 달력)', 'mix', 'adventure', mixOf(['clk.total.half', 'clk.total.set', 'cal.later', 'cal.event', 'school.timetable']), halfConfuse);
game('game.adventure.money', '종합 모험 (돈 쓰기)', 'mix', 'adventure', mixOf(['money.count', 'money.buy', 'money.exchange']), moneyConfuse);

export function getSkill(id: string): Skill {
  const s = REGISTRY.get(id);
  if (!s) throw new Error(`알 수 없는 스킬: ${id}`);
  return s;
}

export function hasSkill(id: string): boolean {
  return REGISTRY.has(id);
}

export function allSkills(): Skill[] {
  return [...REGISTRY.values()];
}
