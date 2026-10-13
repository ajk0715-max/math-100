import type { Level } from './types';

/** 스킬마다 쌓이는 풀이 기록 요약. 난이도 조절과 복습 일정에 쓴다. */
export interface SkillStat {
  level: Level;
  seen: number;
  /** 첫 시도에 맞힌 수 */
  right: number;
  streakRight: number;
  streakWrong: number;
  /** 연속으로 틀려 단계를 낮춘 뒤에는 다음 문제에서 그림 도움을 먼저 보여 준다 */
  autoHint: boolean;
  /** 마지막으로 푼 날 */
  lastDay: number;
  /** "7시와 8시 혼동" 같은 혼동 문구별 횟수 */
  confusions: Record<string, number>;
}

export interface ReviewTask {
  skill: string;
  /** 이 날(Day) 또는 그 이후 첫 수업의 워밍업에서 푼다 */
  due: number;
  stage: 1 | 2 | 3;
}

export interface BlockResult {
  tries: number;
  best: number;
  passedAt?: number;
  gold: boolean;
  skipped?: boolean;
}

/** 아이가 부모에게 한 실물 보상 요청 */
export interface WishRequest {
  id: string;
  rewardId: string;
  /** 요청할 때의 이름·그림·값을 그대로 남겨 두어, 목록을 고쳐도 기록이 바뀌지 않는다 */
  title: string;
  emoji: string;
  cost: number;
  ts: number;
  status: 'pending' | 'approved' | 'declined';
  decidedAt?: number;
}

/** 시작 진단 결과 */
export interface DiagnosticRecord {
  ts: number;
  /** 풀어 본 문제 수와 첫 시도에 맞힌 수 */
  asked: number;
  right: number;
  /** 통과한 단계(0~4) */
  tiers: number;
  /** 진단이 제안한 시작 블록 */
  suggested: number;
  /** 부모가 확정한 시작 블록 */
  chosen: number;
}

export interface ProfileSettings {
  dailyCapMin: number;
  /** 수업을 마친 뒤 별 없이 더 놀 수 있는 시간(분) */
  extraMin: number;
  allowedFrom: string;
  allowedTo: string;
  /** 0=일 … 6=토 */
  studyDays: number[];
  /** 하루에 수업 하나만 열어 둔다 */
  oneLessonPerDay: boolean;
  voice: boolean;
  sfx: boolean;
  optional: { clock5: boolean; hour60: boolean; carry: boolean };
}

export interface Profile {
  id: string;
  nickname: string;
  avatar: string;
  createdAt: number;
  startBlock: number;
  /** 다음에 할 날(1~100). 날짜가 아니라 끝낸 수업 수를 따른다. */
  day: number;
  doneDays: number[];
  blocks: Record<number, BlockResult>;
  stars: number;
  starsTotal: number;
  stickers: Record<number, 'normal' | 'gold'>;
  village: string[];
  skills: Record<string, SkillStat>;
  reviews: ReviewTask[];
  /** 마지막으로 수업을 끝낸 날짜(YYYY-MM-DD) */
  lastLessonDate: string | null;
  /** 부모가 오늘 수업을 하나 더 열어 준 날짜 */
  extraLessonDate: string | null;
  /** 실물 보상 요청 기록(최근 것이 뒤) */
  wishes: WishRequest[];
  diagnostic: DiagnosticRecord | null;
  seedSalt: number;
  settings: ProfileSettings;
  /** 100일 마지막 보스를 처음 통과한 날짜(YYYY-MM-DD). 수료증에 적는다. */
  completedOn?: string;
  /** 수료증에 쓸 이름. 비어 있으면 별명을 쓴다. */
  certName?: string;
}

export const DEFAULT_SETTINGS: ProfileSettings = {
  dailyCapMin: 20,
  extraMin: 5,
  allowedFrom: '07:00',
  allowedTo: '21:00',
  studyDays: [0, 1, 2, 3, 4, 5, 6],
  oneLessonPerDay: true,
  voice: true,
  sfx: true,
  optional: { clock5: false, hour60: false, carry: false },
};

export function newSkillStat(day: number): SkillStat {
  return { level: 1, seen: 0, right: 0, streakRight: 0, streakWrong: 0, autoHint: false, lastDay: day, confusions: {} };
}

export function newProfile(init: { id: string; nickname: string; avatar: string; now: number; seedSalt: number }): Profile {
  return {
    id: init.id,
    nickname: init.nickname,
    avatar: init.avatar,
    createdAt: init.now,
    startBlock: 1,
    day: 1,
    doneDays: [],
    blocks: {},
    stars: 0,
    starsTotal: 0,
    stickers: {},
    village: [],
    skills: {},
    reviews: [],
    lastLessonDate: null,
    extraLessonDate: null,
    wishes: [],
    diagnostic: null,
    seedSalt: init.seedSalt,
    settings: structuredClone(DEFAULT_SETTINGS),
  };
}
