'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { sfx } from '@/audio/sfx';
import { stopSpeech } from '@/audio/speech';
import type { Section } from '@/core/session';
import { Buddy } from '../Buddy';
import { useStore } from '../store';
import { SECTION_LABEL } from './labels';

export interface FrameProps {
  title: string;
  /** 지금 보이는 부분의 이름(칩) */
  section?: Section;
  slots: { section: Section; done?: boolean }[];
  cursor: number;
  /** 소개·사이 화면처럼 문제를 풀고 있지 않을 때 */
  idle?: boolean;
  boss?: boolean;
  /** 진행 막대 대신 보여 줄 것(남은 시간 막대 등) */
  meter?: ReactNode;
  /** 나가기 확인창의 안내 문장. 기본은 ‘푼 건 저장돼요’ */
  leave?: string;
  onExit: () => void;
  children: ReactNode;
}

/** 수업 화면의 위쪽 막대(나가기·제목·진행 막대)와 나가기 확인창 */
export function Frame({ title, section, slots, cursor, idle, boss, meter, leave = '지금까지 푼 건 저장돼요. 다음에 이어서 할 수 있어요.', onExit, children }: FrameProps) {
  const { guardBack } = useStore();
  const [ask, setAsk] = useState(false);

  useEffect(() => guardBack(() => setAsk(true)), [guardBack]);

  const open = () => {
    sfx.tap();
    stopSpeech();
    setAsk(true);
  };

  return (
    <main className={`app runner${boss ? ' boss' : ''}`}>
      <div className="page">
        <header className="rbar">
          <div className="row">
            <button type="button" className="btn round ghost small" onClick={open} aria-label="나가기">
              ✕
            </button>
            <h1 className="rtitle grow">{title}</h1>
            {section && <span className={`chip ${section === 'game' ? 'warm' : section === 'warmup' ? 'leaf' : section === 'boss' ? 'tomato' : ''}`}>{SECTION_LABEL[section]}</span>}
          </div>
          {meter ?? (
            <div className="pips" role="progressbar" aria-valuemin={0} aria-valuemax={slots.length} aria-valuenow={Math.min(cursor, slots.length)}>
              {slots.map((s, i) => (
                <i key={i} className={`pip${s.done ? ' on' : i === cursor && !idle ? ' now' : ''}${i > 0 && slots[i - 1]?.section !== s.section ? ' gap' : ''}`} />
              ))}
            </div>
          )}
        </header>
        {children}
      </div>

      {ask && (
        <div className="scrim" role="dialog" aria-modal="true" aria-label="나가기 확인">
          <div className="sheet dialog col center">
            <Buddy who="bear" size={5} />
            <h2>잠깐 쉴까요?</h2>
            <p className="muted">{leave}</p>
            <button type="button" className="btn go block" onClick={() => setAsk(false)}>
              계속하기
            </button>
            <button type="button" className="btn ghost block" onClick={onExit}>
              나가기
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
