import { WEEKDAYS_LONG } from './dates';
import { calGridGen, monthsGen, weekdayNameGen, weekdayOrderGen } from './gen/calendar';
import { clockPartsGen, daypartGen, hourHandGen, hourReadGen } from './gen/clock';
import { bondGen, compareGen, countGen, orderGen, writeGen } from './gen/number';
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
