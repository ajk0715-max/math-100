'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { initSpeech, setSpeechEnabled, setSpeechRate, setVoiceName } from '@/audio/speech';
import { setSfxEnabled } from '@/audio/sfx';
import { localYmd, parseYmd } from '@/core/dates';
import { newProfile, type Profile } from '@/core/model';
import type { GenEnv } from '@/core/question';
import type { FamilyEvent } from '@/core/types';
import type { RewardDef } from '@/core/wishes';
import { getKv, loadProfiles, saveProfile, setKv } from '@/db/repo';

/** n은 같은 화면을 새로 시작할 때(보스 다시 도전 등) 바꿔 주는 값 */
export type Screen =
  | { name: 'home' }
  | { name: 'setup' }
  | { name: 'lesson'; day: number; n?: number }
  | { name: 'boss'; block: number; n?: number; skip?: boolean }
  | { name: 'parent' }
  | { name: 'stickers' }
  | { name: 'village'; tab?: 'town' | 'wish' }
  | { name: 'diagnostic'; n?: number }
  | { name: 'extra'; n?: number }
  | { name: 'certificate' };

export interface VoicePrefs {
  name: string | null;
  rate: number;
}

interface Store {
  ready: boolean;
  profiles: Profile[];
  profile: Profile | null;
  today: string;
  env: GenEnv;
  events: FamilyEvent[];
  /** 부모가 정한 실물 보상 목록(가족 공통) */
  rewards: RewardDef[];
  /** 마지막으로 기록 파일을 내려받은 시각(없으면 0) */
  lastBackupAt: number;
  voice: VoicePrefs;
  screen: Screen;
  go: (s: Screen, opts?: { replace?: boolean }) => void;
  /** 현재 프로필을 가장 최근 값에서 바꿔 저장한다 */
  update: (fn: (p: Profile) => Profile) => Profile;
  latest: () => Profile | null;
  selectProfile: (id: string) => void;
  createProfile: (nickname: string, avatar: string) => Promise<Profile>;
  setEvents: (e: FamilyEvent[]) => Promise<void>;
  setRewards: (r: RewardDef[]) => Promise<void>;
  markBackup: () => Promise<void>;
  /** 백업 파일을 불러오거나 프로필을 지운 뒤 저장소를 다시 읽는다. keepScreen이면 지금 화면에 머문다. */
  reload: (opts?: { keepScreen?: boolean }) => Promise<void>;
  setVoice: (v: VoicePrefs) => Promise<void>;
  /** 뒤로 가기(안드로이드 버튼·브라우저)를 가로챌 때 쓴다. 해제 함수를 돌려준다. */
  guardBack: (fn: () => void) => () => void;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider 밖에서 useStore를 불렀습니다');
  return s;
}

const randId = (): string => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [today, setToday] = useState<string>(() => localYmd());
  const [events, setEventsState] = useState<FamilyEvent[]>([]);
  const [rewards, setRewardsState] = useState<RewardDef[]>([]);
  const [lastBackupAt, setLastBackupAt] = useState(0);
  const [voice, setVoiceState] = useState<VoicePrefs>({ name: null, rate: 0.92 });
  const [screen, setScreen] = useState<Screen>({ name: 'home' });

  const profilesRef = useRef<Profile[]>([]);
  const activeRef = useRef<string | null>(null);
  const saving = useRef<Promise<void>>(Promise.resolve());
  const backGuard = useRef<(() => void) | null>(null);

  // ---- 시작: 저장된 기록 불러오기 ----
  const loadAll = useCallback(async (): Promise<{ empty: boolean }> => {
    const [list, active, ev, vp, rw, lb] = await Promise.all([
      loadProfiles(),
      getKv<string | null>('activeProfile', null),
      getKv<FamilyEvent[]>('events', []),
      getKv<VoicePrefs>('voice', { name: null, rate: 0.92 }),
      getKv<RewardDef[]>('rewards', []),
      getKv<number>('lastBackupAt', 0),
    ]);
    const id = list.find((p) => p.id === active)?.id ?? list[0]?.id ?? null;
    profilesRef.current = list;
    activeRef.current = id;
    setProfiles(list);
    setActiveId(id);
    setEventsState(ev);
    setVoiceState(vp);
    setRewardsState(rw);
    setLastBackupAt(lb);
    return { empty: list.length === 0 };
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      initSpeech();
      const { empty } = await loadAll();
      if (!alive) return;
      setScreen(empty ? { name: 'setup' } : { name: 'home' });
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [loadAll]);

  // ---- 날짜가 바뀌면 오늘 날짜를 갱신 ----
  useEffect(() => {
    const tick = () => setToday((t) => {
      const n = localYmd();
      return n === t ? t : n;
    });
    const id = setInterval(tick, 30_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  const profile = useMemo(() => profiles.find((p) => p.id === activeId) ?? null, [profiles, activeId]);

  // ---- 소리 설정을 오디오 모듈에 반영 ----
  useEffect(() => {
    setSpeechEnabled(profile?.settings.voice ?? true);
    setSfxEnabled(profile?.settings.sfx ?? true);
  }, [profile?.settings.voice, profile?.settings.sfx]);
  useEffect(() => {
    setVoiceName(voice.name);
    setSpeechRate(voice.rate);
  }, [voice]);

  // ---- 화면 이동과 뒤로 가기 ----
  const go = useCallback((s: Screen, opts?: { replace?: boolean }) => {
    try {
      if (opts?.replace) window.history.replaceState({ screen: s }, '');
      else window.history.pushState({ screen: s }, '');
    } catch {
      /* 일부 환경에서는 기록을 쓸 수 없다 */
    }
    setScreen(s);
  }, []);

  useEffect(() => {
    const onPop = () => {
      if (backGuard.current) {
        // 수업 중에는 되돌아가지 않고 확인창을 띄운다
        try {
          window.history.pushState({ guard: true }, '');
        } catch {
          /* 무시 */
        }
        backGuard.current();
        return;
      }
      setScreen(profilesRef.current.length === 0 ? { name: 'setup' } : { name: 'home' });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const guardBack = useCallback((fn: () => void) => {
    backGuard.current = fn;
    return () => {
      if (backGuard.current === fn) backGuard.current = null;
    };
  }, []);

  // ---- 프로필 저장 ----
  const latest = useCallback((): Profile | null => profilesRef.current.find((p) => p.id === activeRef.current) ?? null, []);

  const persist = useCallback((p: Profile) => {
    saving.current = saving.current.then(() => saveProfile(p)).catch((e) => console.error('저장 실패', e));
  }, []);

  const update = useCallback(
    (fn: (p: Profile) => Profile): Profile => {
      const cur = profilesRef.current.find((p) => p.id === activeRef.current);
      if (!cur) throw new Error('선택된 프로필이 없습니다');
      const next = fn(cur);
      profilesRef.current = profilesRef.current.map((p) => (p.id === next.id ? next : p));
      setProfiles(profilesRef.current);
      persist(next);
      return next;
    },
    [persist],
  );

  const selectProfile = useCallback((id: string) => {
    activeRef.current = id;
    setActiveId(id);
    void setKv('activeProfile', id);
  }, []);

  const createProfile = useCallback(
    async (nickname: string, avatar: string): Promise<Profile> => {
      const p = newProfile({ id: randId(), nickname: nickname.trim() || '친구', avatar, now: Date.now(), seedSalt: Math.floor(Math.random() * 1_000_000_000) + 1 });
      profilesRef.current = [...profilesRef.current, p];
      setProfiles(profilesRef.current);
      activeRef.current = p.id;
      setActiveId(p.id);
      await saveProfile(p);
      await setKv('activeProfile', p.id);
      return p;
    },
    [],
  );

  const setEvents = useCallback(async (e: FamilyEvent[]) => {
    setEventsState(e);
    await setKv('events', e);
  }, []);

  const setRewards = useCallback(async (r: RewardDef[]) => {
    setRewardsState(r);
    await setKv('rewards', r);
  }, []);

  const markBackup = useCallback(async () => {
    const now = Date.now();
    setLastBackupAt(now);
    await setKv('lastBackupAt', now);
  }, []);

  const reload = useCallback(
    async (opts?: { keepScreen?: boolean }) => {
      await saving.current;
      const { empty } = await loadAll();
      if (empty) setScreen({ name: 'setup' });
      else if (!opts?.keepScreen) setScreen({ name: 'home' });
    },
    [loadAll],
  );

  const setVoice = useCallback(async (v: VoicePrefs) => {
    setVoiceState(v);
    await setKv('voice', v);
  }, []);

  const env = useMemo<GenEnv>(() => ({ today: parseYmd(today), events }), [today, events]);

  const value: Store = {
    ready,
    profiles,
    profile,
    today,
    env,
    events,
    rewards,
    lastBackupAt,
    voice,
    screen,
    go,
    update,
    latest,
    selectProfile,
    createProfile,
    setEvents,
    setRewards,
    markBackup,
    reload,
    setVoice,
    guardBack,
  };

  // 점검용: 화면 검사 스크립트가 화면 이동을 직접 부를 수 있게 한다(NEXT_PUBLIC_LAB=1 일 때만)
  if (process.env.NEXT_PUBLIC_LAB && typeof window !== 'undefined') (window as unknown as { __store?: Store }).__store = value;

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
