'use client';

import { useEffect, useRef, useState } from 'react';
import { sfx } from '@/audio/sfx';
import { BLOCKS, BLOCK_COUNT, TOTAL_DAYS, firstDayOf, isBossDay, isReadyDay, lessonFor } from '@/core/curriculum';
import { unlockedGames } from '@/core/extra';
import { extraAvailable, extraBudgetMs, gate as lessonGate, type Gate } from '@/core/limits';
import type { Profile } from '@/core/model';
import { backupDue } from '@/core/progress';
import { pendingWishes } from '@/core/wishes';
import { findOpenSession, sessionsOnDate } from '@/db/repo';
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
  // 진단이나 ‘보스로 건너뛰기’로 넘어간 단계의 날: 하지 않았지만 할 일로 남겨 두지 않는다
  const skipped = !done && !now && !!profile.blocks[block]?.skipped;
  const cls = `cell${done ? ' done' : now ? ' now' : skipped ? ' skip' : ' todo'}${boss ? ' boss' : ''}${sticker === 'gold' ? ' gold' : ''}`;
  const label = done ? ' 완료' : now ? ' 오늘' : skipped ? ' 건너뜀' : '';
  return (
    <div className={cls} style={{ ['--r' as string]: `${rot(day)}deg` }} aria-label={`${day}일째${label}`}>
      {boss && (done || sticker) ? <span className="emo">{BLOCKS[block - 1]?.sticker.emoji}</span> : boss ? <span className="emo dim">★</span> : <span>{day}</span>}
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

const CLOSED_KICKER: Record<NonNullable<Gate['reason']>, string> = {
  restday: '쉬는 날',
  before: '공부 시간 전',
  after: '공부 시간 끝',
  cap: '오늘은 여기까지',
  done: '오늘 수업 끝!',
};

/** 오늘 이미 쓴 공부 시간(ms): 전체, 그중 별 없이 논 시간 */
function useUsedMs(profileId: string, today: string, dep: unknown): { all: number; extra: number } {
  const [ms, setMs] = useState({ all: 0, extra: 0 });
  useEffect(() => {
    let alive = true;
    void sessionsOnDate(profileId, today).then((list) => {
      if (!alive) return;
      setMs({
        all: list.reduce((t, s) => t + s.activeMs, 0),
        extra: list.filter((s) => s.kind === 'extra').reduce((t, s) => t + s.activeMs, 0),
      });
    });
    return () => {
      alive = false;
    };
  }, [profileId, today, dep]);
  return ms;
}

export function Home() {
  const { profile, today, go, lastBackupAt } = useStore();
  const [parentGate, setParentGate] = useState(false);
  const [open, setOpen] = useState<{ day: number; pct: number } | null>(null);
  const [now, setNow] = useState(() => new Date());
  const curRef = useRef<HTMLDivElement | null>(null);

  const p = profile as Profile;
  const used = useUsedMs(p.id, today, p.lastLessonDate);
  const usedMs = used.all;

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

  // 허용 시간대가 지나가는 것을 홈에서도 알아차린다
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const day = p.day;
  const finished = p.doneDays.length >= TOTAL_DAYS || (p.doneDays.includes(TOTAL_DAYS) && day >= TOTAL_DAYS);
  const lesson = isReadyDay(day) ? lessonFor(day, p.settings.optional) : null;
  const boss = isBossDay(day);
  const g = lessonGate(p, now, today, usedMs);
  const resume = open && open.day === day;
  // 이미 해 본 게임이 있어야 추가 놀이를 열 수 있다
  const extraOk = unlockedGames(p.doneDays, p.settings.optional).length > 0 && extraAvailable(p, now, today, usedMs, used.extra);
  const extraMin = Math.max(1, Math.round(extraBudgetMs(p, usedMs, used.extra) / 60_000));
  const pend = pendingWishes(p).length;
  const stickerCount = BLOCKS.filter((b) => p.stickers[b.n]).length;

  const start = () => {
    sfx.tap();
    if (boss) go({ name: 'boss', block: Math.ceil(day / 5) });
    else go({ name: 'lesson', day });
  };

  const hero = (() => {
    if (finished) {
      return { buddy: 'bear' as const, mood: 'cheer' as const, kicker: '100일 완주!', title: '모든 수업을 마쳤어요', sub: '정말 멋져요. 도장판을 다시 봐요.', action: null };
    }
    if (!lesson) {
      return { buddy: 'mole' as const, mood: 'happy' as const, kicker: `Day ${day}`, title: '다음 수업을 준비하고 있어요', sub: '조금만 기다려 주세요.', action: null };
    }
    if (!g.open && g.reason) {
      const done = g.reason === 'done';
      return {
        buddy: 'bear' as const,
        mood: 'happy' as const,
        kicker: CLOSED_KICKER[g.reason],
        title: done ? '내일 또 만나요' : g.title,
        sub: done ? '오늘 도장은 이미 찍었어요.' : g.sub,
        action: null,
      };
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
      <ParentCorner onOpen={() => setParentGate(true)} badge={pend > 0 || backupDue(p, lastBackupAt, now.getTime())} />
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
          {!hero.action && extraOk && (
            <button
              type="button"
              className="btn sun block herobtn extrabtn"
              onClick={() => {
                sfx.tap();
                go({ name: 'extra' });
              }}
            >
              더 놀기 · 별 없이 {extraMin}분
            </button>
          )}
        </section>

        <nav className="tiles" aria-label="바로가기">
          <button
            type="button"
            className="tile sticker-t"
            onClick={() => {
              sfx.tap();
              go({ name: 'stickers' });
            }}
          >
            <span className="emo">📒</span>
            <b>스티커</b>
            <small>
              {stickerCount}/{BLOCKS.length}
            </small>
          </button>
          <button
            type="button"
            className="tile town-t"
            onClick={() => {
              sfx.tap();
              go({ name: 'village' });
            }}
          >
            <span className="emo">🏘️</span>
            <b>내 마을</b>
            <small>{p.village.length}개</small>
          </button>
          <button
            type="button"
            className="tile wish-t"
            onClick={() => {
              sfx.tap();
              go({ name: 'village', tab: 'wish' });
            }}
          >
            <span className="emo">🎁</span>
            <b>소원 상자</b>
            <small>{pend > 0 ? `기다리는 중 ${pend}` : '별로 부탁해요'}</small>
          </button>
        </nav>

        <Board profile={p} curRef={curRef} />
        <p className="fine center bottomnote">보호자 메뉴는 오른쪽 위 톱니를 2초 동안 눌러요.</p>
      </div>

      {parentGate && (
        <ParentGate
          onCancel={() => setParentGate(false)}
          onOk={() => {
            setParentGate(false);
            go({ name: 'parent' });
          }}
        />
      )}
    </main>
  );
}
