'use client';

import { useEffect, useState } from 'react';
import { say, stopSpeech } from '@/audio/speech';
import { sfx } from '@/audio/sfx';
import type { Buddy as BuddyId, IntroCard } from '@/core/curriculum/types';
import { Buddy } from '../Buddy';
import { Scene } from '../visual/Scene';

/** 오늘 배울 것을 길잡이 캐릭터가 말풍선으로 알려 준다 */
export function IntroCards({ cards, buddy, onDone, last = '시작!' }: { cards: IntroCard[]; buddy: BuddyId; onDone: () => void; last?: string }) {
  const [i, setI] = useState(0);
  const c = cards[i] as IntroCard | undefined;
  const isLast = i >= cards.length - 1;

  useEffect(() => {
    if (!c) return;
    const id = setTimeout(() => void say(c.say ?? c.text), 200);
    return () => {
      clearTimeout(id);
      stopSpeech();
    };
  }, [c]);

  if (!c) return null;
  return (
    <section className="intro col">
      <div className="introbody">
        <div className="introrow" key={i}>
          <Buddy who={buddy} mood={isLast ? 'cheer' : 'happy'} size={c.visual ? 5.6 : 7.4} />
          <div className="speech below">{c.text}</div>
        </div>
        {c.visual && (
          <div className="sheet viz introviz" key={`v${i}`}>
            <Scene v={c.visual} />
          </div>
        )}
      </div>
      <div className="row two">
        {i > 0 ? (
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              sfx.tap();
              setI(i - 1);
            }}
          >
            이전
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          className="btn go"
          onClick={() => {
            sfx.tap();
            if (isLast) onDone();
            else setI(i + 1);
          }}
        >
          {isLast ? last : '다음'}
        </button>
      </div>
    </section>
  );
}

/** 단계 사이에 잠깐 보여 주는 카드 */
export function BreakCard({ buddy, title, text, button, mood = 'cheer', emoji, onGo }: { buddy: BuddyId; title: string; text: string; button: string; mood?: 'happy' | 'cheer'; emoji?: string; onGo: () => void }) {
  useEffect(() => {
    const id = setTimeout(() => void say(`${title}. ${text}`), 200);
    return () => {
      clearTimeout(id);
      stopSpeech();
    };
  }, [title, text]);
  return (
    <section className="breakcard col center">
      <div className="breakbody">
        <Buddy who={buddy} mood={mood} size={6.6} className={mood === 'cheer' ? 'hop' : ''} />
        {emoji ? (
          <div className="gamecard sheet">
            <span className="emo" aria-hidden="true">
              {emoji}
            </span>
            <h2>{title}</h2>
          </div>
        ) : (
          <h2 className="title">{title}</h2>
        )}
        <p className="lead">{text}</p>
      </div>
      <button
        type="button"
        className="btn go block"
        onClick={() => {
          sfx.tap();
          onGo();
        }}
      >
        {button}
      </button>
    </section>
  );
}
