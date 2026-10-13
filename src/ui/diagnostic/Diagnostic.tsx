'use client';

import { useMemo, useRef, useState } from 'react';
import { sfx } from '@/audio/sfx';
import { stopSpeech } from '@/audio/speech';
import { BLOCKS, firstDayOf, type IntroCard } from '@/core/curriculum';
import {
  DIAG_ITEMS,
  PASS_PER_TIER,
  TIER_COUNT,
  TIER_NAME,
  applyPlacement,
  diagSeed,
  nextIndex,
  summarize,
  type DiagAnswer,
  type DiagArea,
} from '@/core/diagnostic';
import type { Profile } from '@/core/model';
import { generate } from '@/core/question';
import type { Question } from '@/core/types';
import { addAttempt } from '@/db/repo';
import { Buddy } from '../Buddy';
import { BreakCard, IntroCards } from '../lesson/Cards';
import { Frame } from '../lesson/Frame';
import { ParentGate } from '../ParentGate';
import { QuestionView, type QuestionOutcome } from '../QuestionView';
import { useStore } from '../store';

type Phase = 'intro' | 'q' | 'handoff' | 'confirm';

const INTRO: IntroCard[] = [
  { text: '먼저 지금 실력을 살짝 볼게!', say: '먼저 지금 실력을 살짝 볼게!' },
  { text: '틀려도 괜찮아. 한 문제에 한 번만 눌러 볼 수 있어. 아는 만큼만 해 보자!', say: '틀려도 괜찮아. 한 문제에 한 번만 눌러 볼 수 있어. 아는 만큼만 해 보자!' },
];

const AREA_NAME: Record<DiagArea, string> = { num: '수', clock: '시계', cal: '달력' };
const AREAS: DiagArea[] = ['num', 'clock', 'cal'];

/**
 * 시작 진단: 아이가 12문제(약 10분)를 풀고, 보호자가 PIN으로 확인한 뒤 시작 단계를 정한다.
 * 푼 기록은 별·단계·리포트에 영향을 주지 않는다.
 */
export function Diagnostic() {
  const { profile, env, go, update } = useStore();
  const p = profile as Profile;
  const lastReady = BLOCKS.filter((b) => b.ready).length;

  const [phase, setPhase] = useState<Phase>('intro');
  const [answers, setAnswers] = useState<DiagAnswer[]>([]);
  const [gate, setGate] = useState(false);
  const [chosen, setChosen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  // 다시 진단할 때 같은 문제가 나오지 않게, 지난 진단 시각을 섞는다
  const run = p.diagnostic?.ts ?? 0;
  const made = useRef(new Map<number, Question>());
  const startedAt = useRef(Date.now());

  const cur = nextIndex(answers);
  const result = useMemo(() => summarize(answers, lastReady), [answers, lastReady]);

  const questionAt = (index: number): Question => {
    const hit = made.current.get(index);
    if (hit) return hit;
    const it = DIAG_ITEMS[index];
    if (!it) throw new Error(`진단 문항 ${index}이 없습니다`);
    const q = generate({ skill: it.skill, level: it.level, seed: diagSeed(p, index, run) }, env);
    made.current.set(index, q);
    return q;
  };

  const onOutcome = (o: QuestionOutcome) => {
    if (cur === null) return;
    const it = DIAG_ITEMS[cur];
    if (!it) return;
    const next = [...answers, { index: cur, correct: o.correctFirst }];
    void addAttempt({
      profileId: p.id,
      sessionId: `diag-${startedAt.current}`,
      day: 0,
      section: 'diag',
      skill: it.skill,
      level: it.level,
      seed: diagSeed(p, cur, run),
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
    setAnswers(next);
    if (nextIndex(next) === null) {
      sfx.fanfare();
      setPhase('handoff');
    }
  };

  const leave = () => {
    stopSpeech();
    go({ name: 'home' }, { replace: true });
  };

  const apply = () => {
    if (chosen === null) return;
    setBusy(true);
    update((x) => applyPlacement(x, chosen, result, Date.now()));
    go({ name: 'home' }, { replace: true });
  };

  // 수업을 시작한 뒤에는 쓰지 않는다(이미 푼 날과 섞이지 않게)
  if (p.doneDays.length > 0) {
    return (
      <main className="app">
        <div className="page center-all">
          <section className="col center sumcol">
            <Buddy who="bear" mood="happy" size={7} />
            <h1 className="title">이미 수업을 시작했어요</h1>
            <p className="lead">시작 진단은 첫 수업 전에만 할 수 있어요. 이미 시작했다면 보호자 메뉴의 ‘진도’에서 단계를 옮길 수 있어요.</p>
            <div className="grow" />
            <button type="button" className="btn go block" onClick={leave}>
              홈으로
            </button>
          </section>
        </div>
      </main>
    );
  }

  if (phase === 'confirm') {
    const pick = chosen ?? result.suggested;
    const pickDef = BLOCKS[pick - 1];
    const sugDef = BLOCKS[result.suggested - 1];
    return (
      <main className="app parent">
        <div className="page">
          <header className="phead row">
            <h1 className="grow">시작 진단 결과</h1>
          </header>

          <section className="sheet col">
            <h2>
              {p.avatar} {p.nickname}
            </h2>
            <p>
              {result.asked}문제 중 <b>{result.right}개</b>를 바로 맞혔어요.
            </p>
            <div className="stats">
              {AREAS.map((a) => (
                <div key={a} className="stat">
                  <b>{result.byArea[a].asked === 0 ? '-' : `${result.byArea[a].right}/${result.byArea[a].asked}`}</b>
                  <span>{AREA_NAME[a]}</span>
                </div>
              ))}
            </div>
            <ul className="lrows">
              {Array.from({ length: TIER_COUNT }, (_, i) => (i + 1) as 1 | 2 | 3 | 4).map((tier) => {
                const here = answers.filter((a) => DIAG_ITEMS[a.index]?.tier === tier);
                const right = here.filter((a) => a.correct).length;
                const pass = right >= PASS_PER_TIER;
                const asked = here.length > 0;
                return (
                  <li key={tier} className="lrow">
                    <span className="emo" aria-hidden="true">
                      {!asked ? '⚪' : pass ? '✅' : '🟡'}
                    </span>
                    <div className="lmain">
                      <b>
                        {tier}구간 · {TIER_NAME[tier]}
                      </b>
                      <small>{asked ? `${here.length}문제 중 ${right}개 맞힘` : '풀지 않았어요'}</small>
                    </div>
                    {asked && <span className={`chip ${pass ? 'leaf' : 'sun'}`}>{pass ? '통과' : '더 연습'}</span>}
                  </li>
                );
              })}
            </ul>
            <p className="fine">구간마다 3문제 중 {PASS_PER_TIER}문제 이상 바로 맞히면 통과예요. 통과하지 못하면 거기서 멈춰요.</p>
          </section>

          <section className="sheet col">
            <h2>시작할 단계</h2>
            <p className="lead">
              추천: {result.suggested}단계{sugDef ? ` · ${sugDef.title}` : ''}
              <br />
              <small className="muted">Day {firstDayOf(result.suggested)}부터</small>
            </p>
            <label className="field">
              <span>시작할 단계</span>
              <select value={pick} onChange={(e) => setChosen(Number(e.target.value))}>
                {BLOCKS.filter((b) => b.ready).map((b) => (
                  <option key={b.n} value={b.n}>
                    {b.n}단계 · {b.title}
                    {b.n === result.suggested ? ' (추천)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <p className="muted">
              Day {firstDayOf(pick)}부터{pickDef ? ` · ${pickDef.title}` : ''}
            </p>
            {pick > 1 && (
              <p className="muted">
                앞의 {pick - 1}개 단계는 ‘건너뜀’으로 표시돼요. 별은 받지 않고, 스티커는 보통 색으로 채워져요. 나중에 ‘진도’에서 언제든 돌아갈 수 있어요.
              </p>
            )}
            {pick > result.suggested && <p className="status warn">추천보다 높은 단계예요. 어려워하면 ‘진도’에서 되돌릴 수 있어요.</p>}
            {pick >= 4 && (
              <p className="status warn">
                진단은 수·시계·달력의 핵심만 확인해요. 건너뛰는 단계의 모양·규칙·돈 같은 내용은 확인하지 못해요. 확신이 없으면 추천보다 한두 단계 낮게 시작해서 빠르게 지나가는 편이 안전해요.
              </p>
            )}
            {pick === 1 && result.suggested === 1 && <p className="muted">처음부터 차근차근 시작하는 것을 권해요. 하루 15분이면 충분해요.</p>}
            <button type="button" className="btn go" disabled={busy} onClick={apply}>
              {pick}단계부터 시작
            </button>
            <button type="button" className="btn ghost" disabled={busy} onClick={leave}>
              정하지 않고 나가기
            </button>
          </section>
        </div>
      </main>
    );
  }

  return (
    <Frame
      title="시작 진단"
      slots={DIAG_ITEMS.map((_, i) => ({ section: 'explore' as const, done: i < answers.length }))}
      cursor={answers.length}
      idle={phase !== 'q'}
      leave="지금까지 푼 것은 저장되지 않아요. 나가면 처음부터 다시 해야 해요."
      onExit={leave}
    >
      {phase === 'intro' && <IntroCards cards={INTRO} buddy="bear" last="시작!" onDone={() => setPhase('q')} />}
      {phase === 'q' && cur !== null && <QuestionView key={`diag-${cur}`} q={questionAt(cur)} buddy="bear" exam nextLabel="다음" onDone={onOutcome} />}
      {phase === 'handoff' && (
        <>
          <BreakCard
            buddy="bear"
            title="다 했어요!"
            text="정말 잘했어. 이제 보호자님께 화면을 보여 줘."
            button="보호자 확인"
            onGo={() => setGate(true)}
          />
          {gate && (
            <ParentGate
              onCancel={() => setGate(false)}
              onOk={() => {
                setGate(false);
                setChosen(result.suggested);
                setPhase('confirm');
              }}
            />
          )}
        </>
      )}
    </Frame>
  );
}
