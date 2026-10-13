import type { DateParts } from './dates';
import type { Rng } from './rng';

export type Level = 1 | 2 | 3;

export type Tone = 'ink' | 'sky' | 'tangerine' | 'leaf' | 'grape' | 'rose' | 'sun' | 'tomato';

export type ShapeKind = 'circle' | 'triangle' | 'square' | 'rect' | 'star' | 'heart' | 'oval';
export type Solid = 'box' | 'cylinder' | 'ball';
export type CalMark = 'today' | 'target' | 'event' | 'range' | 'dim' | 'start';

export interface Group {
  emoji: string;
  n: number;
  /** true면 개수를 숨기고 물음표 상자로 그린다 */
  unknown?: boolean;
}

/** 문제 그림. 화면은 이 값만 보고 그린다. 함수나 DOM 참조를 넣지 않는다(저장·재생이 가능해야 함). */
export type Visual =
  | {
      k: 'objects';
      emoji: string;
      n: number;
      layout?: 'row' | 'scatter' | 'frame10' | 'frame20';
      crossed?: number;
      numbered?: boolean;
      countable?: boolean;
      size?: 'sm' | 'md' | 'lg';
      cols?: number;
    }
  | { k: 'groups'; a: Group; b: Group; op: '+' | '-' | 'vs'; crossed?: boolean }
  | { k: 'big'; text: string; tone?: Tone; sub?: string }
  | { k: 'eq'; parts: string[]; tone?: Tone }
  | { k: 'bond'; total: number | null; a: number | null; b: number | null }
  | { k: 'numberLine'; from: number; to: number; blanks?: number[]; marks?: number[]; hop?: { from: number; to: number } }
  | { k: 'stones'; seq: (number | null)[] }
  | {
      k: 'clock';
      h: number;
      m: number;
      hands?: 'both' | 'hour' | 'none';
      numbers?: boolean;
      mark?: 'hour' | 'minute' | number;
      size?: 'sm' | 'md' | 'lg';
    }
  | { k: 'digital'; h: number; m: number }
  | {
      k: 'calendar';
      year: number;
      month: number;
      marks?: Record<number, CalMark>;
      compact?: boolean;
      highlightWeekday?: number;
    }
  | { k: 'weekdays'; hide?: number[]; highlight?: number; names?: 'short' | 'long' }
  | { k: 'months'; hide?: number[]; highlight?: number }
  | { k: 'coins'; coins: number[] }
  | { k: 'price'; emoji: string; name: string; won: number }
  | { k: 'shape'; shape: ShapeKind; color: Tone; rot?: number; size?: number; label?: string }
  | { k: 'solid'; solid: Solid; size?: number; emoji?: string }
  | { k: 'bars'; items: { label: string; value: number; tone: Tone; emoji?: string }[]; dir: 'h' | 'v'; unitMax?: number; showValues?: boolean; grid?: boolean }
  | { k: 'seesaw'; left: Group; right: Group; tilt?: 'left' | 'right' | 'level' }
  | { k: 'cells'; cols: number; rows: number; fill?: number; tone: Tone; numbered?: boolean; fit?: number }
  | { k: 'pattern'; seq: string[]; blanks?: number[]; kind: 'color' | 'emoji' | 'text' | 'shape' }
  /** 십 모형. tens개의 10개 묶음 막대와 낱개 ones개 */
  | { k: 'tens'; tens: number; ones: number; tone?: Tone; caption?: boolean }
  /** 수 배열표(from~to). blanks는 물음표 칸, marks는 색칠 칸 */
  | { k: 'chart'; from: number; to: number; cols?: number; blanks?: number[]; marks?: number[]; tone?: Tone }
  /** 간단한 표. 칸 값이 null이면 물음표 칸 */
  | { k: 'table'; head: string[]; rows: (string | number | null)[][]; tone?: Tone }
  /** 섞여 있는 그림 더미(분류하기) */
  | { k: 'bag'; items: string[]; size?: 'sm' | 'md' }
  /** 줄 서 있는 그림. mark는 표시할 자리(0부터), sides면 양 끝에 왼쪽·오른쪽 글자를 붙인다 */
  | { k: 'queue'; items: string[]; mark?: number; sides?: boolean }
  | { k: 'pictograph'; rows: { emoji: string; n: number; label: string }[] }
  | { k: 'routine'; items: { emoji: string; label: string; time?: string }[] }
  | { k: 'timetable'; day?: string; periods: { label: string; subject: string; emoji: string }[] }
  | { k: 'story'; text: string; emoji?: string }
  | { k: 'row'; items: Visual[]; gap?: number; wrap?: boolean }
  | { k: 'col'; items: Visual[]; gap?: number };

export interface Option {
  key: string;
  text?: string;
  visual?: Visual;
  /** 눌렀을 때 읽어 줄 말. 없으면 text를 읽는다. */
  say?: string;
}

export interface OrderItem {
  key: string;
  text?: string;
  visual?: Visual;
  say?: string;
}

export interface TapItem {
  key: string;
  visual?: Visual;
  text?: string;
  say?: string;
}

export interface MatchPair {
  key: string;
  a: { visual?: Visual; text?: string };
  b: { visual?: Visual; text?: string };
}

export type AnswerSpec =
  | { t: 'choice'; options: Option[]; correct: number; cols?: number }
  | { t: 'number'; correct: number; maxDigits: 1 | 2 | 3 }
  | { t: 'pickN'; emoji: string; total: number; n: number; unitSay: string }
  | { t: 'gaps'; seq: (number | null)[]; tokens: number[]; answers: number[] }
  | { t: 'order'; items: OrderItem[]; correct: string[]; style?: 'cards' | 'train' | 'chips' | 'oneline' }
  | { t: 'clockSet'; h: number; m: number; mode: 'hour' | 'half' | 'five' }
  | { t: 'tapTargets'; items: TapItem[]; targets: string[]; cols?: number; need?: 'all' | 'one' }
  | { t: 'coins'; target: number; denoms: number[]; showSum: boolean }
  | { t: 'trace'; glyph: string }
  | { t: 'calTap'; year: number; month: number; targets: number[]; marks?: Record<number, CalMark>; need?: 'one' | 'all' }
  | { t: 'split'; total: number; left: number; emoji: string }
  | { t: 'match'; pairs: MatchPair[] };

export interface Hint {
  say: string;
  visual?: Visual;
}

export interface Question {
  id: string;
  skill: string;
  level: Level;
  /** 화면에 보이는 질문 */
  prompt: string;
  /** 음성으로 읽을 문장(숫자를 한글로 풀어 씀) */
  say: string;
  visual?: Visual;
  answer: AnswerSpec;
  hint?: Hint;
  /** 오답을 확인할 때 보여 주고 읽어 줄 설명 */
  explain?: string;
}

export interface FamilyEvent {
  id: string;
  label: string;
  month: number;
  day: number;
  kind: 'birthday' | 'anniversary' | 'holiday';
}

export type Area = 'num' | 'shape' | 'measure' | 'pattern' | 'data' | 'story' | 'clock' | 'cal' | 'money' | 'life' | 'mix';

export type OptionalFlag = 'clock5' | 'hour60' | 'carry';

export interface GenCtx {
  rng: Rng;
  level: Level;
  seed: number;
  skillId: string;
  today: DateParts;
  events: FamilyEvent[];
}

export interface Skill {
  id: string;
  name: string;
  area: Area;
  gen: (c: GenCtx) => Question;
  /** 정답 키와 고른 키로 헷갈린 쌍을 설명하는 문구를 만든다. 예: "7시와 8시 혼동" */
  confuse?: (expected: string, given: string) => string | null;
  optional?: OptionalFlag;
  /** 보너스 게임용 스킬이면 어떤 게임 화면으로 그릴지 */
  game?: GameId;
  /** 스스로 확인하는 문제처럼 점수로 매길 수 없어 보스전·숙련도에서 빼는 스킬 */
  noBoss?: boolean;
}

export type GameId =
  | 'fish'
  | 'stones'
  | 'jars'
  | 'balloons'
  | 'hands'
  | 'clockMatch'
  | 'dayCards'
  | 'weekTrain'
  | 'dateHunt'
  | 'lineup'
  | 'seesaw'
  | 'shop'
  | 'bundle'
  | 'pattern'
  | 'sort'
  | 'story'
  | 'school'
  | 'adventure';

export interface QuestionRequest {
  skill: string;
  level: Level;
  seed: number;
}
