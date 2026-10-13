import type { Profile } from './model';

/** 마을 꾸미기: 별로 건물·동물·정원·놀이터를 들여놓는다. 한 번 산 것은 마을에 계속 남는다. */
export type VillageCat = 'house' | 'animal' | 'garden' | 'play';

export interface VillageItem {
  id: string;
  emoji: string;
  name: string;
  cat: VillageCat;
  cost: number;
  /** 이 Day부터 살 수 있다 */
  from: number;
}

export const CAT_LABEL: Record<VillageCat, string> = { house: '집', animal: '동물', garden: '정원', play: '놀이터' };
export const CAT_ORDER: VillageCat[] = ['house', 'animal', 'garden', 'play'];

/** 이모지는 2018년 이전 것만 쓴다(오래된 폰에서도 보이도록) */
export const VILLAGE_ITEMS: VillageItem[] = [
  { id: 'hut', emoji: '🏠', name: '작은 집', cat: 'house', cost: 8, from: 1 },
  { id: 'yard', emoji: '🏡', name: '마당 집', cat: 'house', cost: 12, from: 1 },
  { id: 'shop', emoji: '🏪', name: '가게', cat: 'house', cost: 18, from: 10 },
  { id: 'school', emoji: '🏫', name: '학교', cat: 'house', cost: 22, from: 25 },
  { id: 'clinic', emoji: '🏥', name: '병원', cat: 'house', cost: 26, from: 40 },
  { id: 'castle', emoji: '🏰', name: '성', cat: 'house', cost: 40, from: 60 },

  { id: 'chick', emoji: '🐥', name: '병아리', cat: 'animal', cost: 4, from: 1 },
  { id: 'hen', emoji: '🐔', name: '닭', cat: 'animal', cost: 6, from: 1 },
  { id: 'cow', emoji: '🐄', name: '소', cat: 'animal', cost: 10, from: 5 },
  { id: 'sheep', emoji: '🐑', name: '양', cat: 'animal', cost: 10, from: 10 },
  { id: 'pig', emoji: '🐖', name: '돼지', cat: 'animal', cost: 10, from: 15 },
  { id: 'dog', emoji: '🐕', name: '강아지', cat: 'animal', cost: 14, from: 20 },
  { id: 'cat', emoji: '🐈', name: '고양이', cat: 'animal', cost: 14, from: 30 },
  { id: 'horse', emoji: '🐴', name: '말', cat: 'animal', cost: 20, from: 45 },

  { id: 'tree', emoji: '🌳', name: '나무', cat: 'garden', cost: 5, from: 1 },
  { id: 'pine', emoji: '🌲', name: '소나무', cat: 'garden', cost: 5, from: 1 },
  { id: 'tulip', emoji: '🌷', name: '꽃밭', cat: 'garden', cost: 6, from: 1 },
  { id: 'sunflower', emoji: '🌻', name: '해바라기', cat: 'garden', cost: 8, from: 12 },
  { id: 'mushroom', emoji: '🍄', name: '버섯', cat: 'garden', cost: 8, from: 20 },
  { id: 'fountain', emoji: '⛲', name: '분수', cat: 'garden', cost: 24, from: 35 },

  { id: 'ball', emoji: '⚽', name: '공놀이터', cat: 'play', cost: 10, from: 8 },
  { id: 'train', emoji: '🚂', name: '꼬마 기차', cat: 'play', cost: 20, from: 15 },
  { id: 'carousel', emoji: '🎠', name: '회전목마', cat: 'play', cost: 24, from: 20 },
  { id: 'circus', emoji: '🎪', name: '서커스 천막', cat: 'play', cost: 28, from: 40 },
  { id: 'wheel', emoji: '🎡', name: '관람차', cat: 'play', cost: 36, from: 50 },
];

export function itemById(id: string): VillageItem | undefined {
  return VILLAGE_ITEMS.find((i) => i.id === id);
}

/** 장면 안의 자리(가로·세로는 장면 크기에 대한 %, 가로폭 대비 글자 크기 cqw) */
export interface Slot {
  x: number;
  y: number;
  /** 글자 크기(cqw) */
  s: number;
}

/**
 * 종류마다 정해 둔 자리. 뒤쪽(위)일수록 작게 그린다.
 * 산 순서대로 자리를 채우므로, 처음에는 가운데 근처부터 마을이 생긴다.
 */
export const SLOTS: Record<VillageCat, Slot[]> = {
  house: [
    { x: 30, y: 47, s: 13 },
    { x: 66, y: 46, s: 13 },
    { x: 48, y: 41, s: 12 },
    { x: 14, y: 43, s: 12 },
    { x: 84, y: 42, s: 12 },
    { x: 49, y: 53, s: 15 },
  ],
  animal: [
    { x: 24, y: 66, s: 9 },
    { x: 63, y: 64, s: 9 },
    { x: 80, y: 68, s: 9 },
    { x: 40, y: 71, s: 9.5 },
    { x: 12, y: 71, s: 9.5 },
    { x: 66, y: 74, s: 10 },
    { x: 90, y: 74, s: 10 },
    { x: 30, y: 77, s: 10 },
  ],
  garden: [
    { x: 8, y: 54, s: 9 },
    { x: 92, y: 55, s: 9 },
    { x: 72, y: 57, s: 7.5 },
    { x: 20, y: 58, s: 7.5 },
    { x: 5, y: 82, s: 8 },
    { x: 50, y: 62, s: 12 },
  ],
  play: [
    { x: 22, y: 90, s: 12 },
    { x: 46, y: 89, s: 13 },
    { x: 70, y: 90, s: 13 },
    { x: 90, y: 88, s: 12 },
    { x: 8, y: 94, s: 12 },
  ],
};

export interface Placed {
  item: VillageItem;
  slot: Slot;
  /** 장면에 놓인 순서(애니메이션 지연에 쓴다) */
  order: number;
}

/** 가진 것(산 순서)을 장면의 자리에 놓는다 */
export function layout(owned: readonly string[]): Placed[] {
  const used: Record<VillageCat, number> = { house: 0, animal: 0, garden: 0, play: 0 };
  const out: Placed[] = [];
  owned.forEach((id, order) => {
    const item = itemById(id);
    if (!item) return;
    const slot = SLOTS[item.cat][used[item.cat]];
    if (!slot) return;
    used[item.cat] += 1;
    out.push({ item, slot, order });
  });
  return out;
}

/** 아직 비어 있는 자리(희미한 터로 보여 준다) */
export function emptySlots(owned: readonly string[]): { cat: VillageCat; slot: Slot }[] {
  const used: Record<VillageCat, number> = { house: 0, animal: 0, garden: 0, play: 0 };
  for (const id of owned) {
    const item = itemById(id);
    if (item) used[item.cat] += 1;
  }
  const out: { cat: VillageCat; slot: Slot }[] = [];
  for (const cat of CAT_ORDER) SLOTS[cat].slice(used[cat]).forEach((slot) => out.push({ cat, slot }));
  return out;
}

/** 마을이 자란 정도: 1 풀밭 → 2 꽃 핀 마을 → 3 큰 마을 → 4 반짝이는 도시 */
export function villageStage(day: number): 1 | 2 | 3 | 4 {
  return day <= 25 ? 1 : day <= 50 ? 2 : day <= 75 ? 3 : 4;
}

export const STAGE_NAME: Record<1 | 2 | 3 | 4, string> = { 1: '풀밭 마을', 2: '꽃이 핀 마을', 3: '큰 마을', 4: '반짝이는 도시' };

/** 지금까지 간 가장 먼 날(되돌려도 이미 열린 것은 닫지 않는다) */
export function farthestDay(p: Pick<Profile, 'day' | 'doneDays'>): number {
  return Math.max(1, p.day, ...p.doneDays);
}

export type BuyCheck = { ok: true } | { ok: false; reason: 'owned' | 'locked' | 'stars'; need?: number; from?: number };

export function canBuy(p: Pick<Profile, 'day' | 'doneDays' | 'stars' | 'village'>, item: VillageItem): BuyCheck {
  if (p.village.includes(item.id)) return { ok: false, reason: 'owned' };
  if (farthestDay(p) < item.from) return { ok: false, reason: 'locked', from: item.from };
  if (p.stars < item.cost) return { ok: false, reason: 'stars', need: item.cost - p.stars };
  return { ok: true };
}

/** 별을 내고 마을에 들인다. 살 수 없으면 null */
export function buyItem(p: Profile, id: string): Profile | null {
  const item = itemById(id);
  if (!item || !canBuy(p, item).ok) return null;
  return { ...p, stars: p.stars - item.cost, village: [...p.village, item.id] };
}

export function villageValue(owned: readonly string[]): number {
  return owned.reduce((t, id) => t + (itemById(id)?.cost ?? 0), 0);
}
