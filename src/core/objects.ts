// 세기·묶기 문제에 쓰는 사물 목록. 단위(개, 마리, 송이…)가 달라서 이름·단위를 함께 둔다.

export interface Obj {
  key: string;
  name: string;
  emoji: string;
  counter: string;
}

export const OBJECTS: readonly Obj[] = [
  { key: 'apple', name: '사과', emoji: '🍎', counter: '개' },
  { key: 'fish', name: '물고기', emoji: '🐟', counter: '마리' },
  { key: 'star', name: '별', emoji: '⭐', counter: '개' },
  { key: 'balloon', name: '풍선', emoji: '🎈', counter: '개' },
  { key: 'cookie', name: '쿠키', emoji: '🍪', counter: '개' },
  { key: 'flower', name: '꽃', emoji: '🌸', counter: '송이' },
  { key: 'chick', name: '병아리', emoji: '🐥', counter: '마리' },
  { key: 'car', name: '자동차', emoji: '🚗', counter: '대' },
  { key: 'ball', name: '공', emoji: '⚽', counter: '개' },
  { key: 'strawberry', name: '딸기', emoji: '🍓', counter: '개' },
  { key: 'butterfly', name: '나비', emoji: '🦋', counter: '마리' },
  { key: 'candy', name: '사탕', emoji: '🍬', counter: '개' },
];

export const COUNT_OBJECTS: readonly Obj[] = OBJECTS;

export function objByKey(key: string): Obj {
  const o = OBJECTS.find((x) => x.key === key);
  if (!o) throw new Error(`알 수 없는 사물: ${key}`);
  return o;
}
