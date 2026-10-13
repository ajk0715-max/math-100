import { DEFAULT_SETTINGS, type Profile } from '@/core/model';
import { db, type AttemptRec, type SessionRec } from './db';

// ---- 키-값 ----

export async function getKv<T>(key: string, fallback: T): Promise<T> {
  const rec = await db().kv.get(key);
  return rec ? (rec.value as T) : fallback;
}

export async function setKv(key: string, value: unknown): Promise<void> {
  await db().kv.put({ key, value });
}

// ---- 프로필 ----

/** 예전 버전에서 저장된 프로필에 빠진 항목을 채운다 */
export function normalizeProfile(p: Profile): Profile {
  return {
    ...p,
    settings: { ...DEFAULT_SETTINGS, ...p.settings, optional: { ...DEFAULT_SETTINGS.optional, ...(p.settings?.optional ?? {}) } },
    extraLessonDate: p.extraLessonDate ?? null,
    lastLessonDate: p.lastLessonDate ?? null,
  };
}

export async function loadProfiles(): Promise<Profile[]> {
  const all = await db().profiles.toArray();
  return all.map(normalizeProfile).sort((a, b) => a.createdAt - b.createdAt);
}

export async function saveProfile(p: Profile): Promise<void> {
  await db().profiles.put(p);
}

export async function deleteProfile(id: string): Promise<void> {
  const d = db();
  await d.transaction('rw', d.profiles, d.sessions, d.attempts, async () => {
    await d.profiles.delete(id);
    await d.sessions.where('profileId').equals(id).delete();
    await d.attempts.where('profileId').equals(id).delete();
  });
}

// ---- 수업 기록 ----

export async function saveSession(s: SessionRec): Promise<void> {
  await db().sessions.put(s);
}

/** 끝나지 않은 수업(가장 최근 것). 닫아 둔(endedAt이 있는) 수업은 제외한다. */
export async function findOpenSession(profileId: string): Promise<SessionRec | undefined> {
  const list = await db().sessions.where('profileId').equals(profileId).toArray();
  return list.filter((s) => !s.completed && s.endedAt === undefined).sort((a, b) => b.startedAt - a.startedAt)[0];
}

export async function sessionsOnDate(profileId: string, date: string): Promise<SessionRec[]> {
  return db().sessions.where('date').equals(date).and((s) => s.profileId === profileId).toArray();
}

export async function allSessions(profileId: string): Promise<SessionRec[]> {
  return db().sessions.where('profileId').equals(profileId).toArray();
}

export async function addAttempt(a: AttemptRec): Promise<void> {
  await db().attempts.add(a);
}

export async function attemptsOf(profileId: string): Promise<AttemptRec[]> {
  return db().attempts.where('profileId').equals(profileId).toArray();
}

// ---- 백업 ----

export interface BackupFile {
  app: 'math-100';
  version: 1;
  exportedAt: number;
  profiles: Profile[];
  sessions: SessionRec[];
  attempts: AttemptRec[];
  kv: { key: string; value: unknown }[];
}

export async function exportAll(): Promise<BackupFile> {
  const d = db();
  const [profiles, sessions, attempts, kv] = await Promise.all([d.profiles.toArray(), d.sessions.toArray(), d.attempts.toArray(), d.kv.toArray()]);
  return { app: 'math-100', version: 1, exportedAt: Date.now(), profiles, sessions, attempts, kv };
}

export function isBackup(x: unknown): x is BackupFile {
  const b = x as BackupFile;
  return !!b && b.app === 'math-100' && b.version === 1 && Array.isArray(b.profiles) && Array.isArray(b.sessions) && Array.isArray(b.attempts) && Array.isArray(b.kv);
}

/** 백업 파일로 모든 기록을 바꾼다 */
export async function importAll(b: BackupFile): Promise<void> {
  const d = db();
  await d.transaction('rw', d.profiles, d.sessions, d.attempts, d.kv, async () => {
    await Promise.all([d.profiles.clear(), d.sessions.clear(), d.attempts.clear(), d.kv.clear()]);
    await d.profiles.bulkPut(b.profiles);
    await d.sessions.bulkPut(b.sessions);
    await d.attempts.bulkAdd(b.attempts.map((a) => ({ ...a, id: undefined })));
    await d.kv.bulkPut(b.kv);
  });
}

export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* 지원하지 않는 환경 */
  }
  return false;
}
