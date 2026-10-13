'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { stopSpeech } from '@/audio/speech';
import { josa } from '@/core/ko';
import { lessonFor, type IntroCard } from '@/core/curriculum';
import type { Profile } from '@/core/model';
import {
  applyAttempt,
  buildLessonPlan,
  fingerprint,
  finishLesson,
  lessonSummary,
  materialize,
  resolveLevel,
  type Plan,
  type Slot,
} from '@/core/session';
import { generate } from '@/core/question';
import { getSkill } from '@/core/skills';
import type { Level, Question } from '@/core/types';
import { addAttempt, allSessions, findOpenSession, saveSession, sessionsOnDate } from '@/db/repo';
import type { SessionRec } from '@/db/db';
import { QuestionView, type QuestionOutcome } from '../QuestionView';
import { useStore } from '../store';
import { BreakCard, IntroCards } from './Cards';
import { Frame } from './Frame';
import { GAME_EMOJI, GAME_TITLE } from './labels';
import { Summary } from './Summary';
import { useActiveClock } from './useActiveClock';

type Phase = 'boot' | 'intro' | 'q' | 'break' | 'cap' | 'summary';

interface Made {
  q: Question;
  level: Level;
  seed: number;
}

const rid = (): string => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);

/** 하루치 수업: 워밍업 → (소개) → 탐험 → 보너스 게임 → 도장 */
export function LessonRunner({ day }: { day: number }) {
  const store = useStore();
  const { env, today, go, update, latest } = store;
  const lesson = useMemo(() => lessonFor(day), [day]);

  const [rec, setRec] = useState<SessionRec | null>(null);
  const [phase, setPhase] = useState<Phase>('boot');
  const [result, setResult] = useState<{ stars: number; correct: number; total: number } | null>(null);

  const made = useRef(new Map<number, Made>());
  const used = useRef(new Set<string>());
  const othersMs = useRef(0);
  const activeMs = useRef(0);
  const recRef = useRef<SessionRec | null>(null);
  const bootP = useRef<Promise<{ rec: SessionRec; phase: Phase; others: number }> | null>(null);

  useActiveClock((ms) => {
    activeMs.current += ms;
  }, phase !== 'boot' && phase !== 'summary');

  // ---- 시작: 이어하기이거나 새 수업 만들기 ----
  useEffect(() => {
    let alive = true;
    bootP.current ??= (async () => {
      const p = latest() as Profile;
      const open = await findOpenSession(p.id);
      let r: SessionRec | null = null;
      if (open && open.kind === 'lesson' && open.day === day) {
        r = open;
      } else {
        if (open) await saveSession({ ...open, endedAt: Date.now() });
        const prevRuns = (await allSessions(p.id)).filter((s) => s.day === day && s.kind === 'lesson').length;
        const plan = buildLessonPlan(p, day, prevRuns) as Plan;
        r = {
          id: rid(),
          profileId: p.id,
          date: today,
          day,
          kind: 'lesson',
          run: prevRuns,
          startedAt: Date.now(),
          activeMs: 0,
          plan,
          cursor: 0,
          introSeen: false,
          completed: false,
          firstOfDay: p.lastLessonDate !== today,
        };
        await saveSession(r);
      }
      const todays = await sessionsOnDate(p.id, today);
      const others = todays.filter((s) => s.id !== r?.id).reduce((a, s) => a + s.activeMs, 0);
      // 이미 푼 문제들을 기억해 같은 문제가 또 나오지 않게 한다
      for (const s of r.plan.slots) {
        if (s.done && s.level) used.current.add(fingerprint(generate({ skill: s.skill, level: s.level, seed: s.seed }, env)));
      }
      const first = r.plan.slots.findIndex((s) => s.section === 'explore');
      const ph: Phase = !r.introSeen && (first === -1 || r.cursor >= first) ? 'intro' : 'q';
      return { rec: r, phase: ph, others };
    })();
    void bootP.current.then((b) => {
      if (!alive) return;
      recRef.current = b.rec;
      othersMs.current = b.others;
      activeMs.current = b.rec.activeMs;
      setRec(b.rec);
      if (b.rec.cursor >= b.rec.plan.slots.length) finish(b.rec, b.rec.plan.slots);
      else setPhase(b.phase);
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
    const p = latest() as Profile;
    const level = slot.level ?? resolveLevel(p.skills[slot.skill], slot.maxLevel);
    const m = materialize(slot, level, env, used.current);
    const v: Made = { q: m.q, level, seed: m.seed };
    made.current.set(slot.id, v);
    return v;
  };

  const capMs = ((latest() as Profile | null)?.settings.dailyCapMin ?? 20) * 60_000;

  const finish = (r: SessionRec, slots: Slot[]) => {
    const p0 = latest() as Profile;
    const firstOfDay = p0.lastLessonDate !== today;
    const plan: Plan = { ...r.plan, slots };
    const before = p0.stars;
    const p1 = update((p) => finishLesson(p, plan, today, firstOfDay));
    const sum = lessonSummary(slots);
    const done: SessionRec = { ...r, plan, cursor: slots.length, completed: true, endedAt: Date.now(), firstOfDay, activeMs: activeMs.current };
    recRef.current = done;
    setRec(done);
    void saveSession(done);
    setResult({ stars: p1.stars - before, correct: sum.correctFirst, total: sum.total });
    setPhase('summary');
  };

  const onIntroDone = () => {
    const r = recRef.current;
    if (!r) return;
    persist({ ...r, introSeen: true });
    setPhase('q');
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

    update((p) => ({
      ...p,
      skills: { ...p.skills, [slot.skill]: applyAttempt(p.skills[slot.skill], day, { correctFirst: o.correctFirst, confusion: o.confusion }) },
    }));
    void addAttempt({
      profileId: r.profileId,
      sessionId: r.id,
      day,
      section: slot.section,
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
    if (nextIdx >= slots.length) {
      finish({ ...r, plan: { ...r.plan, slots } }, slots);
      return;
    }
    const nr: SessionRec = { ...r, plan: { ...r.plan, slots }, cursor: nextIdx };
    persist(nr);

    if (othersMs.current + activeMs.current >= capMs) {
      setPhase('cap');
      return;
    }
    const nextSection = slots[nextIdx]?.section;
    if (nextSection !== slot.section) setPhase(nextSection === 'explore' && !nr.introSeen ? 'intro' : 'break');
    else setPhase('q');
  };

  const exit = () => {
    const r = recRef.current;
    if (r && !r.completed) void saveSession({ ...r, activeMs: activeMs.current });
    stopSpeech();
    go({ name: 'home' });
  };

  if (!lesson) {
    return (
      <main className="app">
        <div className="page center-all">
          <p className="muted">이 수업은 아직 준비 중이에요.</p>
          <button type="button" className="btn" onClick={() => go({ name: 'home' })}>
            돌아가기
          </button>
        </div>
      </main>
    );
  }
  if (!rec || phase === 'boot') {
    return (
      <main className="app">
        <div className="page center-all">
          <p className="display muted">불러오는 중…</p>
        </div>
      </main>
    );
  }

  const profile = latest() as Profile;
  const slots = rec.plan.slots;
  const slot = slots[rec.cursor];

  if (phase === 'summary' && result) {
    const nextLesson = lessonFor(Math.min(100, day + 1));
    return (
      <Summary
        heading={`Day ${day} 끝!`}
        buddy={lesson.buddy}
        stars={result.stars}
        starsTotal={profile.stars}
        correct={result.correct}
        total={result.total}
        teaser={day < 100 && nextLesson ? `내일은 ‘${nextLesson.title}’${josa(nextLesson.title, '을/를')} 해 볼 거야.` : null}
        button="홈으로"
        onDone={() => go({ name: 'home' }, { replace: true })}
      />
    );
  }

  const intro: IntroCard[] = typeof lesson.intro === 'function' ? lesson.intro(env) : lesson.intro;
  const gameId = slot ? getSkill(slot.skill).game : undefined;

  const body = (() => {
    if (phase === 'intro') return <IntroCards cards={intro} buddy={lesson.buddy} onDone={onIntroDone} />;
    if (phase === 'cap') {
      return <BreakCard buddy={lesson.buddy} mood="happy" title="오늘은 여기까지!" text="오늘 공부를 충분히 했어요. 남은 건 내일 이어서 해요." button="홈으로" onGo={exit} />;
    }
    if (phase === 'break' && slot) {
      const g = getSkill(slot.skill).game;
      return (
        <BreakCard
          buddy={lesson.buddy}
          title={slot.section === 'game' && g ? GAME_TITLE[g] : '다음 차례'}
          emoji={slot.section === 'game' && g ? GAME_EMOJI[g] : undefined}
          text={slot.section === 'game' ? '여기까지 잘했어! 이제 보너스 게임 시간이야.' : '준비됐으면 시작해 볼까?'}
          button={slot.section === 'game' ? '게임 시작' : '시작'}
          onGo={() => setPhase('q')}
        />
      );
    }
    if (phase === 'q' && slot) {
      const m = questionFor(slot);
      const stat = profile.skills[slot.skill];
      const isGame = slot.section === 'game' && gameId;
      const round = slots.filter((s) => s.section === 'game').findIndex((s) => s.id === slot.id) + 1;
      const rounds = slots.filter((s) => s.section === 'game').length;
      const view = (
        <QuestionView
          key={`${rec.id}-${slot.id}`}
          q={m.q}
          theme={isGame ? gameId : undefined}
          buddy={lesson.buddy}
          autoHint={!!stat?.autoHint && slot.section !== 'game'}
          autoNext={!!isGame}
          nextLabel={rec.cursor === slots.length - 1 ? '끝!' : '다음'}
          onDone={onOutcome}
        />
      );
      if (!isGame) return view;
      return (
        <div className={`gamestage t-${gameId}`}>
          <div className="gamebar">
            <span className="emo">{GAME_EMOJI[gameId]}</span>
            <strong>{GAME_TITLE[gameId]}</strong>
            <span className="muted">
              {round}/{rounds}
            </span>
          </div>
          {view}
        </div>
      );
    }
    return null;
  })();

  return (
    <Frame title={`Day ${day} · ${lesson.title}`} section={phase === 'q' && slot ? slot.section : undefined} slots={slots} cursor={rec.cursor} idle={phase !== 'q'} onExit={exit}>
      {body}
    </Frame>
  );
}
