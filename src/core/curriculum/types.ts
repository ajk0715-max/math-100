import type { GenEnv } from '../question';
import type { Level, OptionalFlag, Visual } from '../types';

/** 길잡이 캐릭터: 수 곰, 시계 부엉이, 달력 두더지 */
export type Buddy = 'bear' | 'owl' | 'mole';

export interface IntroCard {
  /** 말풍선에 보이는 글 */
  text: string;
  /** 읽어 줄 글. 없으면 text를 speak()로 바꿔 읽는다 */
  say?: string;
  visual?: Visual;
}

export type IntroSpec = IntroCard[] | ((env: GenEnv) => IntroCard[]);

/** 탐험 단계에서 한 스킬을 몇 문제 풀지. 목록 순서대로 이어서 푼다. */
export interface SkillUse {
  skill: string;
  n: number;
  /** 이 사용에서 넘지 않을 최고 단계 */
  maxLevel?: Level;
}

/** 보너스 게임. 게임 종류는 스킬 등록부(Skill.game)에서 정해진다. */
export interface GameSpec {
  skill: string;
  /** 라운드마다 쓸 단계. 길이가 라운드 수 */
  levels: Level[];
}

export interface DayDef {
  day: number;
  kind: 'math' | 'life';
  title: string;
  buddy: Buddy;
  intro: IntroSpec;
  explore: SkillUse[];
  game: GameSpec;
  /** 부모용 한 줄 생활 활동 */
  tip: string;
}

export interface BlockDef {
  n: number;
  /** 짧은 이름 */
  title: string;
  /** 수학 줄기 이름(1~2일차) */
  math: string;
  /** 시계·달력·생활 줄기 이름(3~4일차) */
  life: string;
  sticker: { emoji: string; name: string };
  /** 이 단계의 날들이 구현되어 있는가 */
  ready: boolean;
}

export type LessonKind = 'math' | 'life' | 'boss';

/** 5일 단위 블록의 한 날을 화면이 쓰는 모양으로 푼 것 */
export interface Lesson {
  day: number;
  block: number;
  /** 블록 안에서 몇째 날(1~5) */
  idx: 1 | 2 | 3 | 4 | 5;
  kind: LessonKind;
  title: string;
  buddy: Buddy;
  intro: IntroSpec;
  explore: SkillUse[];
  game: GameSpec | null;
  tip: string;
  /** 처음 나오는 스킬들(복습 일정이 시작되는 스킬) */
  newSkills: string[];
}

export interface BossPart {
  skill: string;
  n: number;
}

export interface BossSpec {
  block: number;
  /** 이번 블록에서 낼 문제 */
  current: BossPart[];
  /** 앞 블록에서 낼 문제 수 */
  previousCount: number;
}
