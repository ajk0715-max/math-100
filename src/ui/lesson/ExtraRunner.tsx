'use client';

import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { say, stopSpeech } from '@/audio/speech';
import { buildExtraPlan, unlockedGames } from '@/core/extra';
import { EXTRA_MIN_MS, extraAvailable, extraBudgetMs } from '@/core/limits';
import type { Profile } from '@/core/model';
import { generate } from '@/core/question';
import { fingerprint, materialize, type Plan, type Slot } from '@/core/session';
import { getSkill } from '@/core/skills';
import type { Buddy as BuddyId } from '@/core/curriculum/types';
import type { Level, Question } from '@/core/types';
import { addAttempt, allSessions, findOpenSession, saveSession, sessionsOnDate } from '@/db/repo';
import type { SessionRec } from '@/db/db';
import { Buddy } from '../Buddy';
import { QuestionView, type QuestionOutcome } from '../QuestionView';
import { useStore } from '../store';
import { BreakCard } from './Cards';
import { Frame } from './Frame';
import { GAME_EMOJI, GAME_TITLE } from './labels';
import { useActiveClock } from './useActiveClock';

type Phase = 'boot' | 'closed' | 'break' | 'q' | 'end';

interface Made {
  q: Question;
  level: Level;
  seed: number;
}

type Boot = { ok: true; rec: SessionRec; budget: number; gameDay: Map<string, number> } | { ok: false; why: 'busy' | 'none' };

const rid = (): string => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `x${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);

const sum = (list: SessionRec[]): number => list.reduce((t, s) => t + s.activeMs, 0);

const buddyOf = (skill: string): BuddyId => {
  const area = getSkill(skill).area;
  return area === 'clock' ? 'owl' : area === 'cal' ? 'mole' : 'bear';
};

/** 남은 시간을 줄어드는 막대로 보여 준다. 숫자는 분 단위로만 말해 서두르게 하지 않는다. */
function TimeBar({ spent, budget }: { spent: MutableRefObject<number>; budget: number }) {
  const [left, setLeft] = useState(() => Math.max(0, budget - spent.current));
  useEffect(() => {
    const id = setInterval(() => setLeft(Math.max(0, budget - spent.current)), 500);
    return () => clearInterval(id);
  }, [budget, spent]);
  const pct = budget > 0 ? Math.min(100, (left / budget) * 100) : 0;
  const min = Math.ceil(left / 60_000);
  return (
    <div className="timebar" role="progressbar" aria-label="놀이 시간" aria-valuemin={0} aria-valuemax={Math.round(budget / 1000)} aria-valuenow={Math.round(left / 1000)}>
      <div className="fill" style={{ width: `${pct}%` }} />
      <span>
        <span className="emo" aria-hidden="true">
          ⏳
        </span>{' '}
        {left <= 0 ? '마지막 문제!' : `놀이 시간 ${min}분 남았어요`}
      </span>
    </div>
  );
}

/**
 * 수업을 마친 날, 별 없이 더 노는 시간.
 * 이미 해 본 게임만 나오고, 하루 놀이 시간(기본 5분)과 하루 공부 상한 안에서 끝난다.
 * 점수·별·단계 조절에는 반영하지 않는다.
 */
export function ExtraRunner() {
  const { env, today, go, latest } = useStore();

  const [rec, setRec] = useState<SessionRec | null>(null);
  const [phase, setPhase] = useState<Phase>('boot');
  const [why, setWhy] = useState<'busy' | 'none'>('none');
  const [played, setPlayed] = useState(0);
  const [moreLeft, setMoreLeft] = useState(false);

  const made = useRef(new Map<number, Made>());
  const used = useRef(new Set<string>());
  const activeMs = useRef(0);
  const budget = useRef(0);
  const gameDay = useRef(new Map<string, number>());
  const recRef = useRef<SessionRec | null>(null);
  const bootP = useRef<Promise<Boot> | null>(null);

  useActiveClock((ms) => {
    activeMs.current += ms;
  }, phase === 'q');

  // ---- 시작: 하던 놀이를 이어서 하거나 새로 만들기 ----
  useEffect(() => {
    let alive = true;
    bootP.current ??= (async (): Promise<Boot> => {
      const p = latest() as Profile;
      const [open, todays] = await Promise.all([findOpenSession(p.id), sessionsOnDate(p.id, today)]);
      // 하던 수업이나 보스전이 있으면 그것을 먼저 마치게 한다(열어 둔 채로 두고 건드리지 않는다)
      if (open && open.kind !== 'extra') return { ok: false, why: 'busy' };

      let r: SessionRec | null = null;
      if (open && open.date === today) r = open;
      else if (open) await saveSession({ ...open, endedAt: Date.now() });

      const others = todays.filter((s) => s.id !== r?.id);
      const usedOthers = sum(others);
      const extraOthers = sum(others.filter((s) => s.kind === 'extra'));
      const own = r?.activeMs ?? 0;
      const games = unlockedGames(p.doneDays, p.settings.optional);

      if (games.length === 0 || !extraAvailable(p, new Date(), today, usedOthers + own, extraOthers + own)) {
        if (r) await saveSession({ ...r, endedAt: Date.now() });
        return { ok: false, why: 'none' };
      }

      if (!r) {
        const run = (await allSessions(p.id)).filter((s) => s.kind === 'extra').length;
        const plan: Plan = { day: Math.max(0, ...p.doneDays), kind: 'extra', run, slots: buildExtraPlan(p, run) };
        r = {
          id: rid(),
          profileId: p.id,
          date: today,
          day: plan.day,
          kind: 'extra',
          run,
          startedAt: Date.now(),
          activeMs: 0,
          plan,
          cursor: 0,
          introSeen: true,
          completed: false,
          firstOfDay: false,
        };
        await saveSession(r);
      }
      for (const s of r.plan.slots) {
        if (s.done && s.level) used.current.add(fingerprint(generate({ skill: s.skill, level: s.level, seed: s.seed }, env)));
      }
      return { ok: true, rec: r, budget: extraBudgetMs(p, usedOthers, extraOthers), gameDay: new Map(games.map((g) => [g.skill, g.day])) };
    })();
    void bootP.current.then((b) => {
      if (!alive) return;
      if (!b.ok) {
        setWhy(b.why);
        setPhase('closed');
        return;
      }
      recRef.current = b.rec;
      activeMs.current = b.rec.activeMs;
      budget.current = b.budget;
      gameDay.current = b.gameDay;
      setRec(b.rec);
      if (b.rec.cursor >= b.rec.plan.slots.length) finish(b.rec, b.rec.plan.slots, b.rec.cursor);
      else setPhase(b.rec.cursor > 0 ? 'q' : 'break');
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 화면을 떠날 때 지금까지의 시간을 저장한다
  useEffect(
    () => () => {
      stopSpeech();
      const r = recRef.current;
      if (r && !r.completed) void saveSession({ ...r, activeMs: activeMs.current });
    },
    [],
  );

  const persist = (r: SessionRec) => {
    recRef.current = r;
    setRec(r);
    void saveSession({ ...r, activeMs: activeMs.current });
  };

  const questionFor = (slot: Slot): Made => {
    const hit = made.current.get(slot.id);
    if (hit) return hit;
    const level = slot.level ?? 1;
    const m = materialize(slot, level, env, used.current);
    const v: Made = { q: m.q, level, seed: m.seed };
    made.current.set(slot.id, v);
    return v;
  };

  const finish = (r: SessionRec, slots: Slot[], cursor: number) => {
    const done: SessionRec = { ...r, plan: { ...r.plan, slots }, cursor, completed: true, endedAt: Date.now(), activeMs: activeMs.current };
    recRef.current = done;
    setRec(done);
    void saveSession(done);
    setPlayed(slots.filter((s) => s.done).length);
    setMoreLeft(budget.current - activeMs.current >= EXTRA_MIN_MS);
    setPhase('end');
  };

  const onOutcome = (o: QuestionOutcome) => {
    const r = recRef.current;
    if (!r) return;
    const slot = r.plan.slots[r.cursor];
    if (!slot) return;
    const info = made.current.get(slot.id) as Made;
    const slots = r.plan.slots.map((s) =>
      s.id === slot.id ? { ...s, done: true, level: info.level, seed: info.seed, correctFirst: o.correctFirst, tries: o.tries, revealed: o.revealed, hinted: o.hinted, ms: o.ms } : s,
    );
    void addAttempt({
      profileId: r.profileId,
      sessionId: r.id,
      day: gameDay.current.get(slot.skill) ?? r.day,
      section: 'extra',
      skill: slot.skill,
      level: info.level,
      seed: info.seed,
      correctFirst: o.correctFirst,
      tries: o.tries,
      hinted: o.hinted,
      revealed: o.revealed,
      ms: o.ms,
      expected: o.expected,
      given: o.given,
      confusion: o.confusion,
      ts: Date.now(),
    });

    const nextIdx = r.cursor + 1;
    if (nextIdx >= slots.length || activeMs.current >= budget.current) {
      finish({ ...r, plan: { ...r.plan, slots } }, slots, nextIdx);
      return;
    }
    persist({ ...r, plan: { ...r.plan, slots }, cursor: nextIdx });
    setPhase(slots[nextIdx]?.skill !== slot.skill ? 'break' : 'q');
  };

  const exit = () => {
    const r = recRef.current;
    if (r && !r.completed) void saveSession({ ...r, activeMs: activeMs.current });
    stopSpeech();
    go({ name: 'home' }, { replace: true });
  };

  // 끝 화면에서 한마디
  useEffect(() => {
    if (phase !== 'end') return;
    const id = setTimeout(() => void say('놀이 끝! 수고했어요.'), 250);
    return () => {
      clearTimeout(id);
      stopSpeech();
    };
  }, [phase]);

  if (phase === 'boot' || (phase !== 'closed' && !rec)) {
    return (
      <main className="app">
        <div className="page center-all">
          <p className="display muted">불러오는 중…</p>
        </div>
      </main>
    );
  }

  if (phase === 'closed') {
    return (
      <main className="app">
        <div className="page center-all">
          <section className="col center sumcol">
            <Buddy who="bear" mood="happy" size={8} />
            <h1 className="title">{why === 'busy' ? '하던 수업이 있어요' : '오늘은 여기까지!'}</h1>
            <p className="lead">{why === 'busy' ? '먼저 그 수업을 마치고 놀자.' : '놀이 시간을 다 썼어요. 내일 또 만나요.'}</p>
            <div className="grow" />
            <button type="button" className="btn go block" onClick={() => go({ name: 'home' }, { replace: true })}>
              홈으로
            </button>
          </section>
        </div>
      </main>
    );
  }

  const r = rec as SessionRec;
  const slots = r.plan.slots;
  const slot = slots[r.cursor];

  if (phase === 'end') {
    return (
      <main className="app summary">
        <div className="page center-all">
          <section className="col center sumcol">
            <Buddy who="bear" mood="cheer" size={8} className="hop" />
            <h1 className="title">놀이 끝!</h1>
            <p className="lead">{played}판을 놀았어요.</p>
            <p className="muted">이 시간에는 별을 받지 않아요. 내일 새 수업에서 또 만나요.</p>
            <div className="grow" />
            {moreLeft && (
              <button type="button" className="btn warm block" onClick={() => go({ name: 'extra', n: Date.now() }, { replace: true })}>
                한 번 더 놀기
              </button>
            )}
            <button type="button" className={`btn block ${moreLeft ? 'ghost' : 'go'}`} onClick={() => go({ name: 'home' }, { replace: true })}>
              홈으로
            </button>
          </section>
        </div>
      </main>
    );
  }

  const gameId = slot ? getSkill(slot.skill).game : undefined;

  const body = (() => {
    if (!slot || !gameId) return null;
    const buddy = buddyOf(slot.skill);
    if (phase === 'break') {
      const first = r.cursor === 0;
      const mins = Math.max(1, Math.round(budget.current / 60_000));
      return (
        <BreakCard
          buddy={buddy}
          title={GAME_TITLE[gameId]}
          emoji={GAME_EMOJI[gameId]}
          text={first ? `별은 없지만 마음껏 놀아 봐! 최대 ${mins}분 놀 수 있어.` : '다음 게임이야!'}
          button="시작"
          onGo={() => setPhase('q')}
        />
      );
    }
    const m = questionFor(slot);
    const same = slots.filter((s) => s.skill === slot.skill);
    const round = same.findIndex((s) => s.id === slot.id) + 1;
    return (
      <div className={`gamestage t-${gameId}`}>
        <div className="gamebar">
          <span className="emo">{GAME_EMOJI[gameId]}</span>
          <strong>{GAME_TITLE[gameId]}</strong>
          <span className="muted">
            {round}/{same.length}
          </span>
        </div>
        <QuestionView key={`${r.id}-${slot.id}`} q={m.q} theme={gameId} buddy={buddy} autoNext nextLabel="다음" onDone={onOutcome} />
      </div>
    );
  })();

  return (
    <Frame
      title="더 놀기"
      section={phase === 'q' ? 'game' : undefined}
      slots={slots}
      cursor={r.cursor}
      idle={phase !== 'q'}
      meter={<TimeBar spent={activeMs} budget={budget.current} />}
      leave="그만하면 홈으로 가요. 시간이 남아 있으면 다시 놀 수 있어요."
      onExit={exit}
    >
      {body}
    </Frame>
  );
}
