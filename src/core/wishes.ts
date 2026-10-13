import type { Profile, WishRequest } from './model';

/** 부모가 정해 두는 실물 보상(앱 밖에서 주는 것). 값은 별 개수. */
export interface RewardDef {
  id: string;
  title: string;
  emoji: string;
  cost: number;
}

export const MAX_REWARDS = 12;
export const MAX_COST = 999;
export const REWARD_EMOJIS = ['🍦', '🎬', '🎲', '📚', '🌳', '🍕', '🧁', '🎈', '🚲', '🎨', '🏊', '🧸'];

export const REWARD_SUGGESTIONS: Omit<RewardDef, 'id'>[] = [
  { title: '아이스크림 먹기', emoji: '🍦', cost: 30 },
  { title: '영상 30분 보기', emoji: '🎬', cost: 40 },
  { title: '가족 보드게임 하기', emoji: '🎲', cost: 25 },
  { title: '책 한 권 고르기', emoji: '📚', cost: 60 },
  { title: '공원에서 놀기', emoji: '🌳', cost: 35 },
];

export const cleanTitle = (s: string): string => s.trim().replace(/\s+/g, ' ').slice(0, 24);

/** 입력값이 쓸 만한 보상인지 확인해 정리한 값을 돌려준다 */
export function normalizeReward(input: { title: string; emoji: string; cost: number }, id: string): RewardDef | null {
  const title = cleanTitle(input.title);
  const cost = Math.round(input.cost);
  if (!title || !Number.isFinite(cost) || cost < 1 || cost > MAX_COST) return null;
  return { id, title, emoji: input.emoji || '🎁', cost };
}

export const pendingWishes = (p: Pick<Profile, 'wishes'>): WishRequest[] => p.wishes.filter((w) => w.status === 'pending');

/** 별을 먼저 내고 요청한다(허락을 기다리는 동안 같은 별을 마을에 쓰지 못하게). 못 하면 null */
export function requestWish(p: Profile, def: RewardDef, now: number, id: string): Profile | null {
  if (def.cost < 1 || p.stars < def.cost) return null;
  if (p.wishes.some((w) => w.status === 'pending' && w.rewardId === def.id)) return null;
  const w: WishRequest = { id, rewardId: def.id, title: def.title, emoji: def.emoji, cost: def.cost, ts: now, status: 'pending' };
  return { ...p, stars: p.stars - def.cost, wishes: [...p.wishes, w].slice(-60) };
}

/** 아이가 기다리는 요청을 거둔다: 별을 돌려 받고 기록에서도 지운다(부모가 아직 결정하지 않았을 때만) */
export function cancelWish(p: Profile, id: string): Profile {
  const w = p.wishes.find((x) => x.id === id);
  if (!w || w.status !== 'pending') return p;
  return { ...p, stars: p.stars + w.cost, wishes: p.wishes.filter((x) => x.id !== id) };
}

/** 허락하면 별은 그대로 쓴 것이 되고, 거절하면 별을 돌려 준다 */
export function decideWish(p: Profile, id: string, approve: boolean, now: number): Profile {
  const w = p.wishes.find((x) => x.id === id);
  if (!w || w.status !== 'pending') return p;
  return {
    ...p,
    stars: approve ? p.stars : p.stars + w.cost,
    wishes: p.wishes.map((x) => (x.id === id ? { ...x, status: approve ? 'approved' : 'declined', decidedAt: now } : x)),
  };
}
