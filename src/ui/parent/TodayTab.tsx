'use client';

import { useMemo } from 'react';
import { lessonFor } from '@/core/curriculum';
import { josa } from '@/core/ko';
import type { Profile } from '@/core/model';
import { dayReport, lowestSkills, rangeReport, weakRows } from '@/core/report';
import { useStore } from '../store';
import { RateBar, percent, useRecords, type Notify } from './shared';

/** 오늘: 리포트, 헷갈리는 것, 다음 수업 안내, 중간 점검 */
export function TodayTab({ notify }: { notify: Notify }) {
  const { profile, today, update } = useStore();
  const p = profile as Profile;
  const rec = useRecords(p.id, `${p.lastLessonDate}|${p.day}|${p.doneDays.length}|${p.stars}`);
  const rep = useMemo(() => (rec ? dayReport(today, rec.sessions, rec.attempts) : null), [rec, today]);
  const mid = useMemo(() => (rec && p.doneDays.includes(50) ? rangeReport(rec.attempts, rec.sessions, 1, 50) : null), [rec, p.doneDays]);

  const next = lessonFor(p.day);
  const weak = weakRows(p);
  const low = lowestSkills(p, 5).filter((r) => r.rate < 0.8);
  const rate = rep ? percent(rep.firstRight, rep.solved) : null;
  const lockedToday = p.settings.oneLessonPerDay && p.lastLessonDate === today && p.extraLessonDate !== today;

  const state = !rep ? null : rep.finished ? { cls: 'leaf', text: '오늘 수업을 마쳤어요' } : rep.sessions > 0 ? { cls: 'sun', text: '하다가 멈췄어요' } : { cls: '', text: '오늘은 아직 안 했어요' };

  const midRate = mid ? percent(mid.firstRight, mid.solved) : null;
  const midWeakest = mid ? [...mid.areas].filter((a) => a.solved >= 8).sort((a, b) => a.firstRight / a.solved - b.firstRight / b.solved).slice(0, 2) : [];
  const weakNames = midWeakest.map((a) => a.label).join(', ');

  return (
    <>
      <section className="sheet col">
        <div className="row">
          <h2 className="grow">
            {p.avatar} {p.nickname}
          </h2>
          {state && <span className={`chip ${state.cls}`}>{state.text}</span>}
        </div>
        <div className="stats two">
          <div className="stat">
            <b>{rep ? (rep.minutes < 1 && rep.solved > 0 ? '1분 미만' : `${rep.minutes}분`) : '…'}</b>
            <span>오늘 공부한 시간</span>
          </div>
          <div className="stat">
            <b>{rep ? `${rep.solved}개` : '…'}</b>
            <span>오늘 푼 문제</span>
          </div>
          <div className="stat">
            <b>{rate === null ? '-' : `${rate}%`}</b>
            <span>처음에 바로 맞힘</span>
          </div>
          <div className="stat">
            <b>{rep ? `${rep.hints}번` : '…'}</b>
            <span>힌트를 본 문제</span>
          </div>
        </div>
        {rep && rep.extraMinutes > 0 && <p className="muted">별 없이 논 시간 {rep.extraMinutes}분이 공부한 시간에 들어 있어요. 문제 수와 정답률에는 넣지 않았어요.</p>}
        {rep && rep.revealed > 0 && <p className="muted">두 번 틀려서 정답을 보여 준 문제가 {rep.revealed}개 있어요.</p>}
        {rep && rep.areas.length > 0 && (
          <>
            <h3 className="subtitle">영역별 정답률</h3>
            <ul className="ratebars">
              {rep.areas.map((a) => (
                <RateBar key={a.area} label={a.label} right={a.firstRight} total={a.solved} />
              ))}
            </ul>
          </>
        )}
        <p className="muted">
          별 {p.stars}개 · 마친 날 {p.doneDays.length}일 · 다음은 Day {p.day}
        </p>
      </section>

      {next && (
        <section className="sheet col">
          <h2>다음 수업 · Day {p.day}</h2>
          <p className="lessonline">{next.title}</p>
          <div className="tipbox">
            <span className="emo" aria-hidden="true">
              💡
            </span>
            <p>{next.tip}</p>
          </div>
          {lockedToday && (
            <>
              <p className="muted">오늘 수업은 끝났어요. 하루에 하나만 열어 두는 설정이라 내일 다시 열려요.</p>
              <button
                type="button"
                className="btn warm"
                onClick={() => {
                  update((x) => ({ ...x, extraLessonDate: today }));
                  notify('오늘 수업을 하나 더 열었어요. 별은 첫 수업에서만 받아요.');
                }}
              >
                오늘 한 번 더 열기
              </button>
            </>
          )}
        </section>
      )}

      <section className="sheet col">
        <h2>헷갈리는 것</h2>
        {weak.length === 0 ? (
          <p className="muted">같은 곳에서 세 번 이상 틀린 것은 아직 없어요.</p>
        ) : (
          <>
            <ul className="lrows">
              {weak.map((w) => (
                <li key={`${w.skill}-${w.label}`} className="lrow">
                  <span className="emo" aria-hidden="true">
                    🔎
                  </span>
                  <div className="lmain">
                    <b>{w.label}</b>
                    <small>{w.skillName}</small>
                  </div>
                  <span className="chip tomato">{w.count}번</span>
                </li>
              ))}
            </ul>
            <p className="fine">같은 헷갈림이 3번 쌓이면 다음 수업의 워밍업에 저절로 다시 나와요.</p>
          </>
        )}
        {low.length > 0 && (
          <>
            <h3 className="subtitle">정답률이 낮은 유형</h3>
            <ul className="ratebars">
              {low.map((r) => (
                <RateBar key={r.skill} label={r.name} right={r.right} total={r.seen} />
              ))}
            </ul>
          </>
        )}
      </section>

      {mid && (
        <section className="sheet col midcheck">
          <h2>중간 점검 · Day 1~50</h2>
          <div className="stats two">
            <div className="stat">
              <b>{mid.days}일</b>
              <span>마친 수업</span>
            </div>
            <div className="stat">
              <b>{mid.minutes}분</b>
              <span>공부한 시간</span>
            </div>
            <div className="stat">
              <b>{mid.solved}개</b>
              <span>푼 문제</span>
            </div>
            <div className="stat">
              <b>{midRate === null ? '-' : `${midRate}%`}</b>
              <span>처음에 바로 맞힘</span>
            </div>
          </div>
          <ul className="ratebars">
            {mid.areas.map((a) => (
              <RateBar key={a.area} label={a.label} right={a.firstRight} total={a.solved} />
            ))}
          </ul>
          <p>
            {midRate === null
              ? '기록이 아직 적어요.'
              : midRate >= 85
                ? '아주 잘 따라오고 있어요. 이대로 이어가면 돼요.'
                : midRate >= 70
                  ? '대체로 잘하고 있어요.'
                  : '어려워하는 부분이 많아요. 진도 탭에서 어려웠던 단계로 돌아가 다시 해 보는 것도 방법이에요.'}
            {weakNames && midRate !== null && midRate < 90 && (
              <>
                {' '}
                상대적으로 약한 영역은 {weakNames}
                {josa(weakNames, '이에요/예요')}. 생활 속에서 한 번씩 더 물어봐 주세요.
              </>
            )}
          </p>
        </section>
      )}
    </>
  );
}
