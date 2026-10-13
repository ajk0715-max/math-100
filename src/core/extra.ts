import { lessonFor } from './curriculum';
import type { Profile } from './model';
import { hashSeed, makeRng, shuffle } from './rng';
import type { Slot } from './session';
import type { Level } from './types';

/** 수업을 마친 날 별 없이 더 노는 시간에 쓰는 게임들 */
export interface UnlockedGame {
  skill: string;
  /** 이 게임을 처음 한 수업 날 */
  day: number;
  levels: Level[];
}

/** 이 게임 한 번에 몇 판을 이어서 내는가는 게임 정의(levels)를 따른다. 한 번에 고르는 게임 수: */
export const EXTRA_GAMES = 3;

/**
 * 아이가 실제로 마친 날들의 보너스 게임. 건너뛴 단계의 게임은 설명 카드를 보지 못했으므로 넣지 않는다.
 * 같은 게임(스킬)은 가장 나중 날의 것 하나만 둔다.
 */
export function unlockedGames(doneDays: readonly number[]): UnlockedGame[] {
  const byGame = new Map<string, UnlockedGame>();
  for (const d of [...doneDays].sort((a, b) => a - b)) {
    const g = lessonFor(d)?.game;
    if (g) byGame.set(g.skill, { skill: g.skill, day: d, levels: g.levels });
  }
  return [...byGame.values()];
}

/** 이미 해 본 게임 중 몇 개를 골라 한 게임씩 이어서 낸다. run이 바뀌면 다른 문제가 나온다. */
export function buildExtraPlan(profile: Pick<Profile, 'seedSalt' | 'doneDays'>, run: number): Slot[] {
  const games = unlockedGames(profile.doneDays);
  if (games.length === 0) return [];
  const rng = makeRng(profile.seedSalt, 'extra', run);
  const slots: Slot[] = [];
  for (const g of shuffle(rng, games).slice(0, EXTRA_GAMES)) {
    for (const level of g.levels) {
      const id = slots.length;
      slots.push({ id, section: 'game', skill: g.skill, level, seed: (hashSeed(profile.seedSalt, 'extra', run, id) % 1_000_000_000) + 1 });
    }
  }
  return slots;
}
