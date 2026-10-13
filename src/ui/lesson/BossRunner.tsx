'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { say, stopSpeech } from '@/audio/speech';
import { sfx } from '@/audio/sfx';
import { BLOCKS, lessonFor, type IntroCard } from '@/core/curriculum';
import type { Profile } from '@/core/model';
import { bossOutcome, buildBossPlan, fingerprint, finishBoss, materialize, noteConfusion, recordBossFail, resolveLevel, type BossOutcome, type Plan, type Slot } from '@/core/session';
import { generate } from '@/core/question';
import type { Level, Question } from '@/core/types';
import { addAttempt, allSessions, findOpenSession, saveSession } from '@/db/repo';
import type { SessionRec } from '@/db/db';
import { Buddy } from '../Buddy';
import { Boss } from '../parts/Boss';
import { QuestionView, type QuestionOutcome } from '../QuestionView';
import { useStore } from '../store';
import { IntroCards } from './Cards';
import { Frame } from './Frame';
import { Summary } from './Summary';
import { useActiveClock } from './useActiveClock';

type Phase = 'boot' | 'intro' | 'q' | 'result';

interface Made {
  q: Question;
  level: Level;
  seed: number;
}

interface Result {
  passed: boolean;
  correct: number;
  total: number;
  stars: number;
  gold: boolean;
  wrongTypes: number;
}

const SKIP_INTRO: IntroCard[] = [
  { text: '이 단계를 이미 알고 있는지 확인해 볼게!', say: '이 단계를 이미 알고 있는지 확인해 볼게!' },
  { text: '열다섯 문제 중 열두 문제를 한 번에 맞히면, 이 단계는 건너뛰고 다음으로 가!', say: '열다섯 문제 중 열두 문제를 한 번에 맞히면, 이 단계는 건너뛰고 다음으로 가!' },
];

const rid = (): string => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);

function BossBar({ left, total, hit }: { left: number; total: number; hit: number }) {
  const hp = total > 0 ? left / total : 0;
  const mood = left === 0 ? 'down' : hp <= 0.5 ? 'worried' : 'smug';
  return (
    <div className="bossbar" aria-label={`먹물 도깨비 체력 ${left}`}>
      <Boss mood={mood} size={3.4 + 2.2 * hp} hit={hit} />
      <div className="hp" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={left}>
        <div className="fill" style={{ width: `${hp * 100}%` }} />
        <span>{left === 0 ? '쓰러졌어요!' : `체력 ${left}`}</span>
      </div>
    </div>
  );
}

/**
 * 5일째 보스전: 열다섯 문제를 한 번씩만 풀고, 80% 이상이면 스티커를 받는다.
 * skip이면 보호자가 연 '건너뛰기 도전'이다. 통과하면 이 단계를 건너뛰고, 통과하지 못해도 기록에는 아무 영향이 없다.
 */
export function BossRunner({ block, skip = false }: { block: number; skip?: boolean }) {
  const store = useStore();
  const { env, today, go, update, latest } = store;
  const day = block * 5;
  const lesson = useMemo(() => lessonFor(day), [day]);
  const def = BLOCKS[block - 1];

  const [rec, setRec] = useState<SessionRec | null>(null);
  const [phase, setPhase] = useState<Phase>('boot');
  const [result, setResult] = useState<Result | null>(null);
  const [hit, setHit] = useState(0);

  const made = useRef(new Map<number, Made>());
  const used = useRef(new Set<string>());
  const activeMs = useRef(0);
  const recRef = useRef<SessionRec | null>(null);
  const bootP = useRef<Promise<{ rec: SessionRec }> | null>(null);

  useActiveClock((ms) => {
    activeMs.current += ms;
  }, phase === 'q' || phase === 'intro');

  useEffect(() => {
    let alive = true;
    bootP.current ??= (async () => {
      const p = latest() as Profile;
      const open = await findOpenSession(p.id);
      let r: SessionRec | null = null;
      if (open && open.kind === 'boss' && open.day === day && !!open.skip === skip) {
        r = open;
      } else {
        if (open) await saveSession({ ...open, endedAt: Date.now() });
        const past = (await allSessions(p.id)).filter((s) => s.day === day && s.kind === 'boss').sort((a, b) => a.startedAt - b.startedAt);
        // 지난번에 통과하지 못했다면 틀린 유형만 다시 낸다(건너뛰기 도전은 언제나 처음부터 열다섯 문제)
        const last = skip ? undefined : past.filter((s) => !s.skip).pop();
        let retryFrom: { skill: string; wrong: number }[] | undefined;
        if (last?.completed) {
          const o = bossOutcome(last.plan.slots);
          if (!o.passed && o.wrongBySkill.length > 0) retryFrom = o.wrongBySkill;
        }
        const plan = buildBossPlan(p, block, past.length, retryFrom) as Plan;
        r = {
          id: rid(),
          profileId: p.id,
          date: today,
          day,
          kind: 'boss',
          run: past.length,
          startedAt: Date.now(),
          activeMs: 0,
          plan,
          cursor: 0,
          introSeen: false,
          completed: false,
          firstOfDay: false,
          ...(skip ? { skip: true } : {}),
        };
        await saveSession(r);
      }
      for (const s of r.plan.slots) {
        if (s.done && s.level) used.current.add(fingerprint(generate({ skill: s.skill, level: s.level, seed: s.seed }, env)));
      }
      return { rec: r };
    })();
    void bootP.current.then(({ rec: r }) => {
      if (!alive) return;
      recRef.current = r;
      activeMs.current = r.activeMs;
      setRec(r);
      setPhase(r.introSeen || r.cursor > 0 ? 'q' : 'intro');
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const hitQ = made.current.get(slot.id);
    if (hitQ) return hitQ;
    const p = latest() as Profile;
    const level = slot.level ?? resolveLevel(p.skills[slot.skill], slot.maxLevel);
    const m = materialize(slot, level, env, used.current);
    const v: Made = { q: m.q, level, seed: m.seed };
    made.current.set(slot.id, v);
    return v;
  };

  const finish = (r: SessionRec, slots: Slot[]) => {
    const p0 = latest() as Profile;
    const out: BossOutcome = bossOutcome(slots);
    const plan: Plan = { ...r.plan, slots };
    let res: Result;
    if (out.passed) {
      const rate = out.correct / Math.max(1, out.total);
      const firstRate = (p0.blocks[block]?.tries ?? 0) === 0 ? rate : 0;
      const before = p0.stars;
      const p1 = update((p) => finishBoss(p, block, out, firstRate, today, skip));
      res = { passed: true, correct: out.correct, total: out.total, stars: p1.stars - before, gold: p1.stickers[block] === 'gold', wrongTypes: 0 };
    } else {
      // 건너뛰기 도전에서 통과하지 못한 것은 기록하지 않는다(나중에 보스를 첫 도전에 통과하면 금 스티커를 받을 수 있게)
      if (!skip) update((p) => recordBossFail(p, block, out.correct, out.total));
      res = { passed: false, correct: out.correct, total: out.total, stars: 0, gold: false, wrongTypes: out.wrongBySkill.length };
    }
    const done: SessionRec = { ...r, plan, cursor: slots.length, completed: true, endedAt: Date.now(), activeMs: activeMs.current };
    recRef.current = done;
    setRec(done);
    void saveSession(done);
    setResult(res);
    setPhase('result');
    if (res.passed) sfx.fanfare();
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
    if (o.correctFirst) setHit((h) => h + 1);
    if (!o.correctFirst && o.confusion) {
      update((p) => ({ ...p, skills: { ...p.skills, [slot.skill]: noteConfusion(p.skills[slot.skill], day, o.confusion) } }));
    }
    void addAttempt({
      profileId: r.profileId,
      sessionId: r.id,
      day,
      section: 'boss',
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
    persist({ ...r, plan: { ...r.plan, slots }, cursor: nextIdx });
  };

  const exit = () => {
    const r = recRef.current;
    if (r && !r.completed) void saveSession({ ...r, activeMs: activeMs.current });
    stopSpeech();
    go({ name: 'home' });
  };

  if (!lesson || !def) {
    return (
      <main className="app">
        <div className="page center-all">
          <p className="muted">이 보스전은 아직 준비 중이에요.</p>
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
  const total = slots.length;
  const solvedRight = slots.filter((s) => s.done && s.correctFirst).length;

  if (phase === 'result' && result) {
    if (result.passed) {
      return (
        <Summary
          heading={skip ? '이 단계는 건너뛰어요!' : result.gold ? '금 스티커 획득!' : '보스 격파!'}
          buddy="bear"
          stars={result.stars}
          starsTotal={profile.stars}
          correct={result.correct}
          total={result.total}
          stampLines={['보스', '격파!']}
          teaser={block < 20 ? '다음 단계에서 또 만나자!' : null}
          button="홈으로"
          onDone={() => go({ name: 'home' }, { replace: true })}
        >
          <div className={`stickerbig${result.gold ? ' gold' : ''}`} aria-label={`${def.sticker.name} 스티커`}>
            <span className="emo">{def.sticker.emoji}</span>
            <span className="stickername">{def.sticker.name} 스티커</span>
          </div>
        </Summary>
      );
    }
    if (skip) {
      return (
        <main className="app">
          <div className="page center-all">
            <section className="col center sumcol">
              <Buddy who="bear" mood="happy" size={8} />
              <h1 className="title">여기까지 해 봤어!</h1>
              <p className="lead">
                {result.total}문제 중 {result.correct}문제를 한 번에 맞혔어.
                <br />
                이번에는 건너뛰지 않고 이 단계를 차근차근 해 보자.
              </p>
              <p className="muted">괜찮아. 이 도전은 기록에 남지 않아.</p>
              <div className="grow" />
              <button type="button" className="btn go block" onClick={() => go({ name: 'home' }, { replace: true })}>
                홈으로
              </button>
            </section>
          </div>
        </main>
      );
    }
    return (
      <main className="app">
        <div className="page center-all">
          <section className="col center sumcol">
            <Buddy who="bear" mood="happy" size={8} />
            <h1 className="title">아깝다!</h1>
            <p className="lead">
              {result.total}문제 중 {result.correct}문제를 한 번에 맞혔어.
              <br />
              {Math.ceil(result.total * 0.8)}문제를 맞히면 통과야.
            </p>
            <p className="muted">틀린 {result.wrongTypes}가지 유형만 골라서 다시 풀어 볼 수 있어. 도깨비는 도망가지 않아!</p>
            <div className="grow" />
            <button type="button" className="btn go block" onClick={() => go({ name: 'boss', block, n: Date.now() }, { replace: true })}>
              틀린 곳만 다시 도전
            </button>
            <button type="button" className="btn ghost block" onClick={() => go({ name: 'home' }, { replace: true })}>
              나중에 할래요
            </button>
          </section>
        </div>
      </main>
    );
  }

  const intro: IntroCard[] = skip
    ? SKIP_INTRO
    : rec.plan.retry
      ? [{ text: '지난번에 헷갈렸던 문제만 다시 풀어 볼 거야. 이번엔 꼭 해낼 수 있어!' }]
      : typeof lesson.intro === 'function'
        ? lesson.intro(env)
        : lesson.intro;

  const body = (() => {
    if (phase === 'intro') {
      return (
        <IntroCards
          cards={intro}
          buddy="bear"
          last="도전!"
          onDone={() => {
            persist({ ...rec, introSeen: true });
            setPhase('q');
          }}
        />
      );
    }
    if (phase === 'q' && slot) {
      const m = questionFor(slot);
      return (
        <>
          <BossBar left={total - solvedRight} total={total} hit={hit} />
          <QuestionView key={`${rec.id}-${slot.id}`} q={m.q} buddy="bear" exam nextLabel={rec.cursor === total - 1 ? '결과 보기' : '다음'} onDone={onOutcome} />
        </>
      );
    }
    return null;
  })();

  return (
    <Frame title={skip ? `${block}단계 건너뛰기 도전` : `${block}단계 보스 도전`} section={phase === 'q' ? 'boss' : undefined} slots={slots} cursor={rec.cursor} idle={phase !== 'q'} boss onExit={exit}>
      {body}
    </Frame>
  );
}
