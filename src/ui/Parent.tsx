'use client';

import { useEffect, useState } from 'react';
import { sfx, unlockAudio } from '@/audio/sfx';
import { koVoices, say, speechSupported } from '@/audio/speech';
import { lastReadyDay, lessonFor } from '@/core/curriculum';
import { localYmd } from '@/core/dates';
import { attemptsOf, exportAll, sessionsOnDate } from '@/db/repo';
import { Switch } from './parts/Switch';
import { useStore } from './store';

interface TodayStats {
  minutes: number;
  solved: number;
  firstRight: number;
}

function useTodayStats(profileId: string, today: string, bump: unknown): TodayStats | null {
  const [s, setS] = useState<TodayStats | null>(null);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const [sessions, attempts] = await Promise.all([sessionsOnDate(profileId, today), attemptsOf(profileId)]);
      if (!alive) return;
      const mine = attempts.filter((a) => localYmd(new Date(a.ts)) === today);
      setS({
        minutes: Math.round(sessions.reduce((t, x) => t + x.activeMs, 0) / 60000),
        solved: mine.length,
        firstRight: mine.filter((a) => a.correctFirst).length,
      });
    })();
    return () => {
      alive = false;
    };
  }, [profileId, today, bump]);
  return s;
}

const CAPS = [10, 15, 20, 30] as const;

/** 보호자 화면. 1단계에서는 오늘 현황과 꼭 필요한 설정만 둔다. */
export function Parent() {
  const { profile, today, go, update } = useStore();
  const p = profile as NonNullable<typeof profile>;
  const stats = useTodayStats(p.id, today, p.lastLessonDate);
  const [pick, setPick] = useState<number>(p.day);
  const [ask, setAsk] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [voices, setVoices] = useState<{ name: string; local: boolean }[]>([]);

  useEffect(() => {
    const refresh = () => setVoices(koVoices());
    refresh();
    const id = setInterval(refresh, 800);
    const stop = setTimeout(() => clearInterval(id), 3000);
    return () => {
      clearInterval(id);
      clearTimeout(stop);
    };
  }, []);

  const next = lessonFor(p.day);
  const doneToday = p.lastLessonDate === today;
  const extraOpen = p.extraLessonDate === today;
  const lockedToday = p.settings.oneLessonPerDay && doneToday && !extraOpen;
  const days = Array.from({ length: lastReadyDay() }, (_, i) => i + 1);
  const rate = stats && stats.solved > 0 ? Math.round((stats.firstRight / stats.solved) * 100) : null;

  const setSettings = (patch: Partial<typeof p.settings>) => update((x) => ({ ...x, settings: { ...x.settings, ...patch } }));

  const download = async () => {
    const b = await exportAll();
    const blob = new Blob([JSON.stringify(b)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `100일수학-기록-${today}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 8000);
    setSaved('기록 파일을 내려받았어요. 안전한 곳에 보관해 주세요.');
  };

  const testSound = () => {
    unlockAudio();
    sfx.star();
    void say('안녕! 나는 수 곰이야. 소리가 잘 들리니?', { force: true });
  };

  return (
    <main className="app parent">
      <div className="page">
        <header className="phead row">
          <h1 className="grow">보호자 메뉴</h1>
          <button type="button" className="btn small" onClick={() => go({ name: 'home' }, { replace: true })}>
            나가기
          </button>
        </header>

        <section className="sheet col">
          <h2>
            {p.avatar} {p.nickname}
          </h2>
          <div className="stats">
            <div className="stat">
              <b>{stats ? `${stats.minutes}분` : '…'}</b>
              <span>오늘 공부한 시간</span>
            </div>
            <div className="stat">
              <b>{stats ? `${stats.solved}개` : '…'}</b>
              <span>오늘 푼 문제</span>
            </div>
            <div className="stat">
              <b>{rate === null ? '-' : `${rate}%`}</b>
              <span>처음에 바로 맞힘</span>
            </div>
          </div>
          <p className="muted">
            다음 수업: <b>Day {p.day}</b>
            {next ? ` · ${next.title}` : ''}
            <br />
            별 {p.stars}개 · 마친 날 {p.doneDays.length}일
          </p>
        </section>

        <section className="sheet col">
          <h2>수업 열기</h2>
          {lockedToday ? (
            <>
              <p className="muted">오늘 수업은 끝났어요. 하루에 하나만 열어 두는 설정이라 내일 다시 열려요.</p>
              <button
                type="button"
                className="btn warm"
                onClick={() => {
                  update((x) => ({ ...x, extraLessonDate: today }));
                  setSaved('오늘 수업을 하나 더 열었어요. 별은 첫 수업에서만 받아요.');
                }}
              >
                오늘 한 번 더 열기
              </button>
            </>
          ) : (
            <p className="muted">지금 수업을 할 수 있어요.</p>
          )}

          <label className="field">
            <span>수업 이동</span>
            <select
              value={pick}
              onChange={(e) => {
                setPick(Number(e.target.value));
                setAsk(false);
              }}
            >
              {days.map((d) => (
                <option key={d} value={d}>
                  {d === p.day ? '▶ ' : ''}Day {d} · {lessonFor(d)?.title ?? ''}
                </option>
              ))}
            </select>
          </label>
          {pick !== p.day &&
            (ask ? (
              <div className="col">
                <p className="status warn">Day {pick}(으)로 옮기면 건너뛴 날은 &lsquo;마친 날&rsquo;로 표시되지 않아요. 옮길까요?</p>
                <div className="row two">
                  <button type="button" className="btn ghost" onClick={() => setAsk(false)}>
                    취소
                  </button>
                  <button
                    type="button"
                    className="btn go"
                    onClick={() => {
                      update((x) => ({ ...x, day: pick, extraLessonDate: today }));
                      setAsk(false);
                      setSaved(`Day ${pick}(으)로 옮겼어요.`);
                    }}
                  >
                    옮기기
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="btn ghost" onClick={() => setAsk(true)}>
                이 날로 옮기기
              </button>
            ))}
        </section>

        <section className="sheet col">
          <h2>소리</h2>
          <div className="switches">
            <Switch on={p.settings.voice} onChange={(v) => setSettings({ voice: v })} label="문제 읽어 주기" sub="글자를 다 읽지 못해도 풀 수 있어요" />
            <Switch on={p.settings.sfx} onChange={(v) => setSettings({ sfx: v })} label="효과음" />
          </div>
          <button type="button" className="btn warm" onClick={testSound}>
            <span aria-hidden="true">🔊</span> 소리 점검
          </button>
          <p className={`status ${voices.length > 0 ? 'ok' : 'warn'}`}>
            {!speechSupported() ? '이 브라우저는 읽어 주기를 지원하지 않아요.' : voices.length > 0 ? `한국어 목소리: ${voices[0]?.name}` : '한국어 목소리를 찾지 못했어요. 기기 설정에서 한국어 음성을 내려받아 주세요.'}
          </p>
        </section>

        <section className="sheet col">
          <h2>공부 시간</h2>
          <div className="field">
            <span>하루 최대</span>
            <div className="seg" role="radiogroup" aria-label="하루 최대 공부 시간">
              {CAPS.map((m) => (
                <button key={m} type="button" role="radio" aria-checked={p.settings.dailyCapMin === m} className={p.settings.dailyCapMin === m ? 'on' : ''} onClick={() => setSettings({ dailyCapMin: m })}>
                  {m}분
                </button>
              ))}
            </div>
          </div>
          <Switch on={p.settings.oneLessonPerDay} onChange={(v) => setSettings({ oneLessonPerDay: v })} label="하루에 수업 하나만" sub="끝내면 &lsquo;내일 만나요&rsquo; 화면이 나와요" />
        </section>

        <section className="sheet col">
          <h2>기록 보관</h2>
          <p className="muted">기록은 이 기기 안에만 저장돼요. 기기를 바꾸거나 브라우저 데이터를 지우기 전에 파일로 내려받아 두세요.</p>
          <button type="button" className="btn grape" onClick={() => void download()}>
            기록 파일 내려받기
          </button>
        </section>

        {saved && (
          <div className="toast" role="status" onAnimationEnd={() => setSaved(null)}>
            {saved}
          </div>
        )}
      </div>
    </main>
  );
}
