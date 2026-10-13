'use client';

import { useEffect, useRef, useState } from 'react';
import { sfx } from '@/audio/sfx';
import { BLOCKS, BLOCK_COUNT, TOTAL_DAYS, firstDayOf, isBossDay, isReadyDay, lessonFor } from '@/core/curriculum';
import type { Profile } from '@/core/model';
import { findOpenSession } from '@/db/repo';
import { Buddy } from './Buddy';
import { ParentCorner } from './parts/ParentCorner';
import { ParentGate } from './ParentGate';
import { useStore } from './store';

const rot = (d: number): number => ((d * 37) % 13) - 6;

function DayCell({ day, profile, boss }: { day: number; profile: Profile; boss: boolean }) {
  const done = profile.doneDays.includes(day);
  const now = day === profile.day;
  const block = Math.ceil(day / 5);
  const sticker = boss ? profile.stickers[block] : undefined;
  const cls = `cell${done ? ' done' : now ? ' now' : ' todo'}${boss ? ' boss' : ''}${sticker === 'gold' ? ' gold' : ''}`;
  return (
    <div className={cls} style={{ ['--r' as string]: `${rot(day)}deg` }} aria-label={`${day}일째${done ? ' 완료' : now ? ' 오늘' : ''}`}>
      {boss && done ? <span className="emo">{BLOCKS[block - 1]?.sticker.emoji}</span> : boss ? <span className="emo dim">★</span> : <span>{day}</span>}
    </div>
  );
}

function Board({ profile, curRef }: { profile: Profile; curRef: React.RefObject<HTMLDivElement | null> }) {
  const curBlock = Math.min(BLOCK_COUNT, Math.ceil(profile.day / 5));
  return (
    <section className="board" aria-label="100일 도장판">
      <h2 className="boardtitle">100일 도장판</h2>
      {BLOCKS.map((b) => {
        const locked = !b.ready;
        const cur = b.n === curBlock;
        const first = firstDayOf(b.n);
        const sticker = profile.stickers[b.n];
        return (
          <div key={b.n} ref={cur ? curRef : undefined} className={`bblock${cur ? ' cur' : ''}${locked ? ' locked' : ''}`}>
            <div className="bhead">
              <span className="bnum">{b.n}</span>
              <span className="btitle grow">{b.title}</span>
              <span className={`sticker${sticker ? ` got ${sticker}` : ''}`} aria-label={sticker ? `${b.sticker.name} 스티커` : '스티커 자리'}>
                {sticker ? <span className="emo">{b.sticker.emoji}</span> : locked ? <span className="lock">🔒</span> : null}
              </span>
            </div>
            <div className="cells">
              {Array.from({ length: 5 }, (_, k) => (
                <DayCell key={k} day={first + k} profile={profile} boss={k === 4} />
              ))}
            </div>
            {locked && <p className="soon">준비 중이에요</p>}
          </div>
        );
      })}
    </section>
  );
}

export function Home() {
  const { profile, today, go } = useStore();
  const [gate, setGate] = useState(false);
  const [open, setOpen] = useState<{ day: number; pct: number } | null>(null);
  const curRef = useRef<HTMLDivElement | null>(null);

  const p = profile as Profile;

  useEffect(() => {
    let alive = true;
    void findOpenSession(p.id).then((s) => {
      if (!alive) return;
      if (s && s.kind === 'lesson') setOpen({ day: s.day, pct: Math.round((s.cursor / Math.max(1, s.plan.slots.length)) * 100) });
      else setOpen(null);
    });
    return () => {
      alive = false;
    };
  }, [p.id, p.day, p.lastLessonDate]);

  useEffect(() => {
    const t = setTimeout(() => curRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 450);
    return () => clearTimeout(t);
  }, []);

  const day = p.day;
  const finished = p.doneDays.length >= TOTAL_DAYS || (p.doneDays.includes(TOTAL_DAYS) && day >= TOTAL_DAYS);
  const lesson = isReadyDay(day) ? lessonFor(day) : null;
  const boss = isBossDay(day);
  const doneToday = p.settings.oneLessonPerDay && p.lastLessonDate === today && p.extraLessonDate !== today;
  const resume = open && open.day === day;

  const start = () => {
    sfx.tap();
    if (boss) go({ name: 'boss', block: Math.ceil(day / 5) });
    else go({ name: 'lesson', day });
  };

  const hero = (() => {
    if (finished) {
      return { buddy: 'bear' as const, mood: 'cheer' as const, kicker: '100일 완주!', title: '모든 수업을 마쳤어요', sub: '정말 멋져요. 도장판을 다시 봐요.', action: null };
    }
    if (doneToday) {
      return { buddy: 'bear' as const, mood: 'happy' as const, kicker: '오늘 수업 끝!', title: '내일 또 만나요', sub: '오늘 도장은 이미 찍었어요.', action: null };
    }
    if (!lesson) {
      return { buddy: 'mole' as const, mood: 'happy' as const, kicker: `Day ${day}`, title: '다음 수업을 준비하고 있어요', sub: '조금만 기다려 주세요.', action: null };
    }
    return {
      buddy: lesson.buddy,
      mood: 'happy' as const,
      kicker: boss ? '보스 도전' : `Day ${day} · 오늘의 수업`,
      title: lesson.title,
      sub: boss ? '배운 것을 모아 열다섯 문제!' : '약 15분이면 끝나요.',
      action: resume ? '이어서 하기' : boss ? '도전하기' : '시작하기',
    };
  })();

  return (
    <main className="app home">
      <ParentCorner onOpen={() => setGate(true)} />
      <div className="page">
        <header className="hhead">
          <div className="who">
            <span className="avatar-s emo">{p.avatar}</span>
            <span className="nick">{p.nickname}</span>
          </div>
          <span className="stars" aria-label={`별 ${p.stars}개`}>
            <span className="emo">⭐</span> {p.stars}
          </span>
        </header>

        <section className="hero sheet stitch">
          <Buddy who={hero.buddy} mood={hero.mood} size={6} />
          <div className="herotext">
            <p className="kicker">{hero.kicker}</p>
            <h1 className="heroname">{hero.title}</h1>
            <p className="muted">{hero.sub}</p>
          </div>
          {hero.action && (
            <button type="button" className="btn go block herobtn" onClick={start}>
              {hero.action}
            </button>
          )}
        </section>

        <Board profile={p} curRef={curRef} />
        <p className="fine center bottomnote">보호자 메뉴는 오른쪽 위 톱니를 2초 동안 눌러요.</p>
      </div>

      {gate && (
        <ParentGate
          onCancel={() => setGate(false)}
          onOk={() => {
            setGate(false);
            go({ name: 'parent' });
          }}
        />
      )}
    </main>
  );
}
