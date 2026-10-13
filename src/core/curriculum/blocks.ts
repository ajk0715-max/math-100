import type { BlockDef } from './types';

/** 20개 블록(5일씩). 제목은 기획서의 블록 표를 따른다. ready는 수업 데이터가 들어간 단계부터 true. */
export const BLOCKS: BlockDef[] = [
  { n: 1, title: '세기와 요일', math: '10까지 세기·읽기·쓰기', life: '요일 이름과 순서', sticker: { emoji: '🐰', name: '토끼' }, ready: true },
  { n: 2, title: '수 순서와 시계', math: '10까지 수의 순서·크기 비교', life: '시계의 구성', sticker: { emoji: '🐯', name: '호랑이' }, ready: true },
  { n: 3, title: '가르기·모으기와 정각', math: '가르기·모으기(5 이하)', life: '정각 읽기 1~6시', sticker: { emoji: '🐼', name: '판다' }, ready: true },
  { n: 4, title: '10 가르기와 하루', math: '가르기·모으기(10 이하)', life: '정각 7~12시, 아침·낮·저녁', sticker: { emoji: '🐧', name: '펭귄' }, ready: true },
  { n: 5, title: '모양과 달력', math: '여러 가지 모양', life: '달력의 구조', sticker: { emoji: '🦊', name: '여우' }, ready: true },
  { n: 6, title: '덧셈 첫걸음과 30분', math: '덧셈 개념(합 5 이하)', life: '몇 시 30분 처음 보기', sticker: { emoji: '🐬', name: '돌고래' }, ready: true },
  { n: 7, title: '덧셈과 시계 맞추기', math: '덧셈(합 9 이하)', life: '몇 시·몇 시 30분 읽기, 바늘 맞추기', sticker: { emoji: '🐢', name: '거북이' }, ready: true },
  { n: 8, title: '뺄셈 첫걸음과 날짜', math: '뺄셈 개념(5 이하)', life: '날짜 읽기', sticker: { emoji: '🦋', name: '나비' }, ready: true },
  { n: 9, title: '뺄셈·섞기와 달력', math: '뺄셈(9 이하), 덧셈·뺄셈 섞기', life: '어제·오늘·내일, 달력에서 날짜 찾기', sticker: { emoji: '🐸', name: '개구리' }, ready: true },
  { n: 10, title: '비교하기와 하루 일과', math: '길이·무게·넓이 비교', life: '하루 일과와 시각 잇기', sticker: { emoji: '🦁', name: '사자' }, ready: true },
  { n: 11, title: '스무 개까지', math: '20까지의 수', life: '아날로그·디지털 시계 짝 맞추기', sticker: { emoji: '🐘', name: '코끼리' }, ready: true },
  { n: 12, title: '쉰까지, 묶음과 낱개', math: '50까지의 수(십 묶음과 낱개)', life: '일주일·한 달·일 년의 길이', sticker: { emoji: '🐙', name: '문어' }, ready: true },
  { n: 13, title: '뛰어 세기와 며칠 뒤', math: '50까지 수의 순서·크기, 뛰어 세기', life: '가족 기념일 찾기, 며칠 뒤 세어 보기', sticker: { emoji: '🐳', name: '고래' }, ready: true },
  { n: 14, title: '백까지와 동전', math: '100까지의 수', life: '동전 알아보기(10·50·100·500원)', sticker: { emoji: '🦄', name: '유니콘' }, ready: true },
  { n: 15, title: '10 만들기와 물건 사기', math: '10이 되는 덧셈', life: '돈 세기, 500원 안에서 물건 사기', sticker: { emoji: '🐝', name: '꿀벌' }, ready: true },
  { n: 16, title: '규칙 찾기', math: '규칙 찾기', life: '5분 단위 시계(선택)', sticker: { emoji: '🐞', name: '무당벌레' }, ready: true },
  { n: 17, title: '분류하기와 표', math: '분류하기와 간단한 표 읽기', life: '1시간은 60분(선택)', sticker: { emoji: '🦀', name: '게' }, ready: true },
  { n: 18, title: '이야기 식 세우기', math: '이야기 읽고 식 세우기(9 이내)', life: '학교 시간표와 하루 일과', sticker: { emoji: '🐿️', name: '다람쥐' }, ready: true },
  { n: 19, title: '세 수 계산과 시계 총정리', math: '세 수 계산, 20 이내 받아올림 없는 덧셈·뺄셈', life: '시계 총정리 정각·30분', sticker: { emoji: '🦅', name: '독수리' }, ready: true },
  { n: 20, title: '종합 모험', math: '수학 용어 총정리(몇째·모두·남은)', life: '시간·달력·돈 종합 모험', sticker: { emoji: '🐲', name: '용' }, ready: true },
];

export function blockDef(n: number): BlockDef {
  const b = BLOCKS[n - 1];
  if (!b) throw new RangeError(`없는 블록: ${n}`);
  return b;
}
