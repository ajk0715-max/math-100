'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { buzz, sfx } from '@/audio/sfx';
import { say, speechEnabled, stopSpeech } from '@/audio/speech';
import type { Buddy as BuddyId } from '@/core/curriculum/types';
import { grade, type Response } from '@/core/grade';
import { getSkill } from '@/core/skills';
import type { GameId, Question } from '@/core/types';
import { AnswerView } from './answers/AnswerView';
import type { Status } from './answers/types';
import { Buddy, type Mood } from './Buddy';
import { Scene } from './visual/Scene';

/** 문제 하나를 푼 결과. 난이도 조절·복습·부모 보고서가 모두 이 값을 쓴다. */
export interface QuestionOutcome {
  /** 첫 시도에 맞혔는가 */
  correctFirst: boolean;
  /** 결국 맞혔는가(정답을 보여 주고 넘어갔으면 false) */
  solved: boolean;
  /** 답을 낸 횟수 */
  tries: number;
  hinted: boolean;
  revealed: boolean;
  ms: number;
  expected: string;
  /** 마지막으로 낸 답 */
  given: string;
  /** 틀렸을 때의 혼동 문구. 예: "7시와 8시 혼동" */
  confusion: string | null;
}

export interface QuestionViewProps {
  q: Question;
  theme?: GameId;
  buddy?: BuddyId;
  /** 연속 오답으로 단계가 내려간 뒤에는 그림 도움을 처음부터 보여 준다 */
  autoHint?: boolean;
  /** 맞히면 잠시 뒤 저절로 넘어간다(게임) */
  autoNext?: boolean;
  /** 시험(보스전): 도움말 없이 한 번만 풀고, 틀리면 바로 정답을 보여 준다 */
  exam?: boolean;
  nextLabel?: string;
  onDone: (o: QuestionOutcome) => void;
}

const CHEERS = ['맞았어요!', '잘했어요!', '딩동댕!', '정확해요!', '멋져요!', '최고예요!'];

function cheerFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return CHEERS[h % CHEERS.length] as string;
}

function buddyFor(area: string): BuddyId {
  return area === 'clock' ? 'owl' : area === 'cal' ? 'mole' : 'bear';
}

/** 문제 하나를 처음부터 끝까지 진행한다. 새 문제마다 key를 바꿔 새로 시작해야 한다. */
export function QuestionView({ q, theme, buddy, autoHint, autoNext, exam, nextLabel = '다음', onDone }: QuestionViewProps) {
  const skill = getSkill(q.skill);
  const who = buddy ?? buddyFor(skill.area);

  const [status, setStatus] = useState<Status>('ask');
  const [attempt, setAttempt] = useState(0);
  const [hintOpen, setHintOpen] = useState(!!autoHint && !!q.hint && !exam);
  const hinted = useRef(!!autoHint && !!q.hint && !exam);
  const t0 = useRef(Date.now());
  const tries = useRef(0);
  const confusion = useRef<string | null>(null);
  const lastGiven = useRef('');
  const expected = useRef('');
  const outcome = useRef<QuestionOutcome | null>(null);
  const reported = useRef(false);

  const report = useCallback(() => {
    if (reported.current || !outcome.current) return;
    reported.current = true;
    stopSpeech();
    onDone(outcome.current);
  }, [onDone]);

  // 점검용: 화면 검사 스크립트가 지금 문제를 알 수 있게 한다(NEXT_PUBLIC_LAB=1 일 때만)
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_LAB) (window as unknown as { __q?: Question }).__q = q;
  }, [q]);

  // 문제가 나타나면 읽어 준다
  useEffect(() => {
    const id = setTimeout(() => void say(q.say), 250);
    return () => {
      clearTimeout(id);
      stopSpeech();
    };
  }, [q.say]);

  // 맞히면 게임에서는 저절로 넘어간다
  useEffect(() => {
    if (status !== 'right' || !autoNext) return;
    const id = setTimeout(report, 1150);
    return () => clearTimeout(id);
  }, [status, autoNext, report]);

  const finish = (kind: 'right' | 'reveal', correctFirst: boolean) => {
    outcome.current = {
      correctFirst,
      solved: kind === 'right',
      tries: tries.current,
      hinted: hinted.current,
      revealed: kind === 'reveal',
      ms: Math.min(Date.now() - t0.current, 180_000),
      expected: expected.current,
      given: lastGiven.current,
      confusion: confusion.current,
    };
    setStatus(kind);
    if (kind === 'right') {
      sfx.right();
      buzz(10);
    } else {
      sfx.wrong();
      void say(q.explain ?? '정답을 확인해 봐요.');
    }
  };

  const submit = (r: Response) => {
    if (status === 'right' || status === 'reveal') return;
    const g = grade(q, r);
    if (process.env.NEXT_PUBLIC_LAB) console.info('[submit]', JSON.stringify(r), JSON.stringify(g), q.id);
    tries.current += 1;
    expected.current = g.expected;
    lastGiven.current = g.given;

    // 짝 맞추기는 모두 이어야 끝나므로, 틀린 횟수만 따져 '첫 시도에 완벽했는가'를 정한다
    if (r.t === 'match') {
      tries.current = r.mistakes + 1;
      finish('right', r.mistakes === 0);
      return;
    }

    if (g.correct) {
      finish('right', attempt === 0);
      return;
    }

    confusion.current = confusion.current ?? skill.confuse?.(g.expected, g.given) ?? null;
    const wrongs = attempt + 1;
    setAttempt(wrongs);
    if (exam || wrongs >= 2) {
      finish('reveal', false);
      return;
    }
    // 첫 오답: 도움말을 보여 주고 한 번 더 풀게 한다
    setStatus('wrong');
    sfx.wrong();
    if (q.hint) {
      hinted.current = true;
      setHintOpen(true);
      void say(q.hint.say);
    }
  };

  const openHint = () => {
    if (!q.hint) return;
    hinted.current = true;
    setHintOpen(true);
    sfx.tap();
    void say(q.hint.say);
  };

  const mood: Mood = status === 'right' ? 'cheer' : status === 'ask' ? 'happy' : 'think';
  const done = status === 'right' || status === 'reveal';
  const canHint = !exam && !!q.hint && !hintOpen && !done;

  return (
    <div className={`qv s-${status}${theme ? ` t-${theme}` : ''}`} data-skill={q.skill} data-answer={q.answer.t}>
      <section className="qcard sheet stitch">
        <div className="qtools">
          {canHint && (
            <button type="button" className="tool hint" aria-label="도움말" onClick={openHint}>
              <span aria-hidden="true">💡</span>
            </button>
          )}
          {speechEnabled() && (
            <button type="button" className="tool listen" aria-label="다시 듣기" onClick={() => void say(q.say)}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
                <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
        <p className="qprompt">{q.prompt}</p>
        {q.visual && (
          <div className="qvisual viz">
            <Scene v={q.visual} />
          </div>
        )}
      </section>

      {hintOpen && q.hint && (
        <aside className="qhint" aria-live="polite">
          <Buddy who={who} mood="think" size={3.6} />
          <div className="speech">
            {status === 'wrong' && <strong className="retry">다시 한 번 생각해 볼까요?</strong>}
            <p>{q.hint.say}</p>
            {q.hint.visual && (
              <div className="viz hintviz">
                <Scene v={q.hint.visual} />
              </div>
            )}
          </div>
        </aside>
      )}

      {/* 첫 오답인데 도움말이 없으면, 답을 가리지 않도록 풀이 칸 위에 짧게 알려 준다 */}
      {status === 'wrong' && !(hintOpen && q.hint) && (
        <div className="fb wrong qfree" aria-live="polite">
          <Buddy who={who} mood="think" size={3.4} />
          <div className="msg">
            <strong>다시 한 번 생각해 볼까요?</strong>
          </div>
        </div>
      )}

      <section className="qanswer">
        <AnswerView q={q} status={status} attempt={attempt} onSubmit={submit} theme={theme} />
      </section>

      <footer className="qfoot">
        {(status === 'right' || status === 'reveal') && (
          <div className={`fb ${status}`} aria-live="polite">
            <Buddy who={who} mood={mood} size={3.4} className={status === 'right' ? 'hop' : ''} />
            <div className="msg">
              {status === 'right' && <strong>{attempt > 0 ? '이번엔 맞았어요!' : cheerFor(q.id)}</strong>}
              {status === 'reveal' && (
                <>
                  <strong>이렇게 하면 돼요</strong>
                  <span>{q.explain}</span>
                </>
              )}
            </div>
          </div>
        )}
        {done && (
          <button type="button" className={`btn block ${status === 'right' ? 'go' : 'sun'} nextbtn`} onClick={report} autoFocus>
            {nextLabel}
          </button>
        )}
      </footer>
    </div>
  );
}
