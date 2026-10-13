import { WEEKDAYS_LONG } from './dates';
import { josa } from './ko';
import { arithGen, balloonsArithGen, mixGen } from './gen/arith';
import { calGridGen, dateReadGen, dateTodayGen, findDateGen, monthsGen, relDayGen, weekdayNameGen, weekdayOrderGen } from './gen/calendar';
import { clockPartsGen, daypartGen, halfReadGen, halfSeeGen, halfTapGen, hourHandGen, hourReadGen } from './gen/clock';
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
import type { Area, GameId, GenCtx, Question, Skill } from './types';

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
function game(id: string, name: string, area: Area, gameId: GameId, gen: (c: GenCtx) => Question, confuse?: Skill['confuse']): void {
  def(id, name, area, gen, { game: gameId, noBoss: true, ...(confuse ? { confuse } : {}) });
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
