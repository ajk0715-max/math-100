'use client';

import { useEffect, useMemo, useState } from 'react';
import { toParts } from '@/core/dates';
import { answerSummary } from '@/core/grade';
import { generate } from '@/core/question';
import { allSkills, getSkill } from '@/core/skills';
import type { GameId, Level, Question } from '@/core/types';
import { GAME_EMOJI, GAME_TITLE } from './lesson/labels';
import { QuestionView, type QuestionOutcome } from './QuestionView';

/** 아직 만든 스킬에서는 나오지 않는 입력 화면을 확인하기 위한 모형 문제 */
const DEMOS: Record<string, Question> = {
  half: {
    id: 'demo-half',
    skill: 'clk.hour.c',
    level: 3,
    prompt: '3시 30분이 되도록 시계를 맞춰 보세요.',
    say: '세 시 삼십 분이 되도록 시계를 맞춰 보세요.',
    answer: { t: 'clockSet', h: 3, m: 30, mode: 'half' },
    hint: { say: '긴바늘은 6에, 짧은바늘은 3과 4의 가운데에 놓아요.' },
    explain: '긴바늘이 6을 가리키고, 짧은바늘은 3과 4 사이에 있어요.',
  },
  five: {
    id: 'demo-five',
    skill: 'clk.hour.c',
    level: 3,
    prompt: '4시 25분이 되도록 시계를 맞춰 보세요.',
    say: '네 시 이십오 분이 되도록 시계를 맞춰 보세요.',
    answer: { t: 'clockSet', h: 4, m: 25, mode: 'five' },
    hint: { say: '긴바늘이 5를 가리키면 25분이에요.' },
    explain: '긴바늘이 5를 가리키면 25분이에요.',
  },
  coins: {
    id: 'demo-coins',
    skill: 'clk.hour.c',
    level: 1,
    prompt: '130원을 만들어 보세요.',
    say: '백삼십 원을 만들어 보세요.',
    answer: { t: 'coins', target: 130, denoms: [10, 50, 100, 500], showSum: true },
    hint: { say: '100원 하나와 10원 세 개로 만들 수 있어요.' },
    explain: '100원 하나와 10원 세 개를 합치면 130원이에요.',
  },
};

/** 개발용: 스킬·단계·시드를 골라 문제 화면을 눈으로 확인한다 */
export interface LabShow {
  skill: string;
  level: Level;
  seed: number;
  exam?: boolean;
  hint?: boolean;
}

export function Lab() {
  const [params, setParams] = useState<URLSearchParams | null>(null);
  const [out, setOut] = useState<QuestionOutcome | null>(null);
  // 점검 스크립트가 페이지를 다시 불러오지 않고 문제를 바꿔 가며 볼 수 있게 한다
  const [ov, setOv] = useState<LabShow | null>(null);
  useEffect(() => setParams(new URLSearchParams(window.location.search)), []);

  const skill = ov?.skill ?? params?.get('skill') ?? '';
  const level = (ov?.level ?? (Number(params?.get('level') ?? 1) || 1)) as Level;
  const seed = ov?.seed ?? (Number(params?.get('seed') ?? 1) || 1);
  const exam = ov ? !!ov.exam : params?.get('exam') === '1';
  const auto = ov ? !!ov.hint : params?.get('hint') === '1';
  const theme = (getSkillGame(skill) ?? undefined) as GameId | undefined;

  const demo = params?.get('demo') ?? '';
  const q = useMemo(() => {
    if (demo && DEMOS[demo]) return DEMOS[demo] as Question;
    if (!skill) return null;
    try {
      return generate({ skill, level, seed }, { today: toParts(new Date(2026, 9, 13)), events: [] });
    } catch {
      return null;
    }
  }, [skill, level, seed, demo]);

  useEffect(() => {
    (window as unknown as { __lab?: unknown }).__lab = {
      q,
      show: setOv,
      gen: (sk: string, lv: Level, sd: number) => generate({ skill: sk, level: lv, seed: sd }, { today: toParts(new Date(2026, 9, 13)), events: [] }),
    };
  }, [q]);

  if (!params) return null;

  if ((!skill && !demo) || !q) {
    return (
      <main className="app">
        <div className="page">
          <h1>문제 점검</h1>
          <div className="col">
            {allSkills().map((s) => (
              <div key={s.id} className="row" style={{ flexWrap: 'wrap' }}>
                <span style={{ minWidth: '12rem' }}>
                  {s.id} <span className="muted">{s.name}</span>
                </span>
                {[1, 2, 3].map((l) => (
                  <a key={l} className="chip" href={`?skill=${s.id}&level=${l}&seed=1`}>
                    L{l}
                  </a>
                ))}
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  const view = <QuestionView key={`${demo}${skill}-${level}-${seed}-${exam}-${auto}`} q={q} theme={theme} exam={exam} autoHint={auto} autoNext={false} onDone={setOut} />;
  return (
    <main className="app runner">
      <div className="page">
        <div className="row muted" style={{ fontSize: '0.8rem' }} data-lab-info>
          {skill} · L{level} · seed {seed} · 정답 {answerSummary(q)}
        </div>
        {theme ? (
          // 게임 문제는 실제 수업과 같은 게임 무대 안에 넣어 폭이 같게 본다
          <div className={`gamestage t-${theme}`}>
            <div className="gamebar">
              <span className="emo">{GAME_EMOJI[theme]}</span>
              <strong>{GAME_TITLE[theme]}</strong>
            </div>
            {view}
          </div>
        ) : (
          view
        )}
        {out && (
          <div className="col" style={{ fontSize: '0.8rem' }}>
            <pre data-outcome>{JSON.stringify(out)}</pre>
            <a className="chip" href={`?skill=${skill}&level=${level}&seed=${seed + 1}`}>
              다음 시드
            </a>
          </div>
        )}
      </div>
    </main>
  );
}

function getSkillGame(id: string) {
  try {
    return id ? getSkill(id).game : undefined;
  } catch {
    return undefined;
  }
}
