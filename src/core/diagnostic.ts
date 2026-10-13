import { BLOCKS, BLOCK_DAYS, firstDayOf } from './curriculum';
import type { DiagnosticRecord, Profile } from './model';
import { hashSeed } from './rng';
import type { Level } from './types';

/**
 * 시작 진단: 수·시계·달력 12문항(네 단계 × 세 문항).
 * 한 단계에서 2문제 이상 첫 시도에 맞히면 통과하고, 통과하지 못하면 거기서 멈춘다.
 * 통과한 단계 수에 따라 시작 블록을 제안하고, 확정은 부모가 한다.
 */
export type DiagArea = 'num' | 'clock' | 'cal';

export interface DiagItem {
  skill: string;
  level: Level;
  tier: 1 | 2 | 3 | 4;
  area: DiagArea;
}

export const DIAG_ITEMS: DiagItem[] = [
  { tier: 1, area: 'num', skill: 'num.count10', level: 2 },
  { tier: 1, area: 'clock', skill: 'clk.parts', level: 1 },
  { tier: 1, area: 'cal', skill: 'cal.weekdayOrder', level: 1 },

  { tier: 2, area: 'num', skill: 'num.split10', level: 2 },
  { tier: 2, area: 'clock', skill: 'clk.hour.c', level: 2 },
  { tier: 2, area: 'cal', skill: 'cal.months', level: 1 },

  { tier: 3, area: 'num', skill: 'add.eq9', level: 2 },
  { tier: 3, area: 'clock', skill: 'clk.half.a', level: 2 },
  { tier: 3, area: 'cal', skill: 'cal.grid', level: 2 },

  { tier: 4, area: 'num', skill: 'sub.eq9', level: 2 },
  { tier: 4, area: 'clock', skill: 'clk.read.mix', level: 2 },
  { tier: 4, area: 'cal', skill: 'cal.dateRead', level: 2 },
];

export const PASS_PER_TIER = 2;
export const TIER_COUNT = 4;
/** 통과한 단계 수(0~4)에 따른 시작 블록 */
export const TIER_START_BLOCK = [1, 3, 6, 8, 11];

export const TIER_NAME: Record<1 | 2 | 3 | 4, string> = {
  1: '세기·요일·시계 구성',
  2: '가르기·정각·12개월',
  3: '덧셈·30분·달력',
  4: '뺄셈·날짜',
};

export interface DiagAnswer {
  index: number;
  correct: boolean;
}

/** run: 지난 진단의 시각 같은 값. 다시 진단할 때 같은 문제가 나오지 않게 한다(0이면 처음). */
export function diagSeed(profile: Pick<Profile, 'seedSalt'>, index: number, run = 0): number {
  const h = run > 0 ? hashSeed(profile.seedSalt, 'diag', index, run) : hashSeed(profile.seedSalt, 'diag', index);
  return (h % 1_000_000_000) + 1;
}

const itemAt = (i: number): DiagItem => DIAG_ITEMS[i] as DiagItem;

/** 지금까지의 답으로 다음에 풀 문항 번호. 끝났으면 null. */
export function nextIndex(answers: DiagAnswer[]): number | null {
  const asked = answers.length;
  if (asked >= DIAG_ITEMS.length) return null;
  if (asked > 0) {
    const last = itemAt(answers[asked - 1]!.index);
    const sameTier = answers.filter((a) => itemAt(a.index).tier === last.tier);
    const wrong = sameTier.filter((a) => !a.correct).length;
    // 이 단계에서 두 번 틀렸으면 더 어려운 문제로 가지 않는다
    if (wrong > 3 - PASS_PER_TIER) return null;
  }
  return asked;
}

/** 통과한 단계 수: 앞에서부터 연달아 통과한 단계까지만 센다 */
export function tiersPassed(answers: DiagAnswer[]): number {
  let n = 0;
  for (let tier = 1; tier <= TIER_COUNT; tier++) {
    const right = answers.filter((a) => itemAt(a.index).tier === tier && a.correct).length;
    if (right < PASS_PER_TIER) break;
    n = tier;
  }
  return n;
}

/** 준비된 블록 안에서 시작 블록을 제안한다 */
export function suggestBlock(passed: number, lastReadyBlock: number = BLOCKS.filter((b) => b.ready).length): number {
  const want = TIER_START_BLOCK[Math.max(0, Math.min(TIER_COUNT, passed))] as number;
  return Math.max(1, Math.min(want, lastReadyBlock));
}

export interface DiagResult {
  asked: number;
  right: number;
  tiers: number;
  suggested: number;
  byArea: Record<DiagArea, { asked: number; right: number }>;
}

export function summarize(answers: DiagAnswer[], lastReadyBlock?: number): DiagResult {
  const byArea: DiagResult['byArea'] = { num: { asked: 0, right: 0 }, clock: { asked: 0, right: 0 }, cal: { asked: 0, right: 0 } };
  for (const a of answers) {
    const it = itemAt(a.index);
    byArea[it.area].asked += 1;
    if (a.correct) byArea[it.area].right += 1;
  }
  const tiers = tiersPassed(answers);
  return { asked: answers.length, right: answers.filter((a) => a.correct).length, tiers, suggested: suggestBlock(tiers, lastReadyBlock), byArea };
}

/** 확정한 시작 블록을 프로필에 반영한다. 앞 블록은 '건너뜀'으로 표시하고 스티커를 보통 색으로 준다. */
export function applyPlacement(p: Profile, block: number, result: Pick<DiagResult, 'asked' | 'right' | 'tiers' | 'suggested'> | null, now: number): Profile {
  const blocks = { ...p.blocks };
  const stickers = { ...p.stickers };
  for (let b = 1; b < block; b++) {
    if (blocks[b]?.passedAt || stickers[b]) continue;
    blocks[b] = { tries: 0, best: 0, gold: false, skipped: true, passedAt: b * BLOCK_DAYS };
    stickers[b] = 'normal';
  }
  const diagnostic: DiagnosticRecord | null = result ? { ts: now, asked: result.asked, right: result.right, tiers: result.tiers, suggested: result.suggested, chosen: block } : p.diagnostic;
  return { ...p, startBlock: block, day: firstDayOf(block), blocks, stickers, diagnostic };
}
