import Dexie, { type Table } from 'dexie';
import type { Profile } from '@/core/model';
import type { Plan } from '@/core/session';

export interface SessionRec {
  id: string;
  profileId: string;
  /** YYYY-MM-DD */
  date: string;
  day: number;
  kind: 'lesson' | 'boss' | 'extra';
  run: number;
  startedAt: number;
  endedAt?: number;
  /** 화면을 보며 실제로 푼 시간(ms). 멈춰 있던 시간은 빼고 센다. */
  activeMs: number;
  plan: Plan;
  /** 다음에 풀 슬롯 번호(plan.slots의 인덱스) */
  cursor: number;
  /** 소개 카드를 이미 봤는가 */
  introSeen: boolean;
  completed: boolean;
  /** 이 날의 첫 수업인가(별은 첫 수업에서만 준다) */
  firstOfDay: boolean;
  /** 건너뛰기 도전으로 푼 보스전인가 */
  skip?: boolean;
}

export interface AttemptRec {
  id?: number;
  profileId: string;
  sessionId: string;
  day: number;
  section: string;
  skill: string;
  level: number;
  seed: number;
  correctFirst: boolean;
  tries: number;
  hinted: boolean;
  revealed: boolean;
  ms: number;
  expected: string;
  given: string;
  confusion: string | null;
  ts: number;
}

export interface KvRec {
  key: string;
  value: unknown;
}

class MathDb extends Dexie {
  profiles!: Table<Profile, string>;
  sessions!: Table<SessionRec, string>;
  attempts!: Table<AttemptRec, number>;
  kv!: Table<KvRec, string>;

  constructor() {
    super('math100');
    this.version(1).stores({
      profiles: 'id',
      sessions: 'id, profileId, date',
      attempts: '++id, profileId, day, skill, ts',
      kv: 'key',
    });
  }
}

let instance: MathDb | null = null;

/** 브라우저에서만 쓴다. 서버 렌더링 중에는 호출하지 않는다. */
export function db(): MathDb {
  if (!instance) instance = new MathDb();
  return instance;
}
