'use client';

import { useEffect, useState } from 'react';
import { say } from '@/audio/speech';
import { sfx } from '@/audio/sfx';
import { Buddy } from '../Buddy';
import { Stamp } from '../parts/Stamp';
import type { Buddy as BuddyId } from '@/core/curriculum/types';

export interface SummaryProps {
  heading: string;
  buddy: BuddyId;
  stars: number;
  starsTotal: number;
  /** 첫 시도에 맞힌 문제 수 / 전체 */
  correct?: number;
  total?: number;
  teaser?: string | null;
  button: string;
  onDone: () => void;
  /** 두 번째 단추(예: 100일을 마쳤을 때 ‘홈으로’) */
  secondary?: { label: string; onClick: () => void };
  /** 보스 통과 때처럼 아래에 더 보여 줄 것 */
  children?: React.ReactNode;
  stampLines?: [string, string?];
}

/** 수업을 마치면 빨간 도장이 쾅 찍힌다 */
export function Summary({ heading, buddy, stars, starsTotal, correct, total, teaser, button, onDone, secondary, children, stampLines }: SummaryProps) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => sfx.stamp(), 330));
    timers.push(setTimeout(() => void say('참 잘했어요!'), 700));
    for (let i = 0; i < stars; i++) {
      timers.push(
        setTimeout(() => {
          sfx.star();
          setShown(i + 1);
        }, 1150 + i * 260),
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [stars]);

  return (
    <main className="app summary">
      <div className="page center-all">
        <section className="col center sumcol">
          <div className="stamp-hit">
            <Stamp lines={stampLines} />
          </div>
          <h1 className="title">{heading}</h1>
          {stars > 0 && (
            <div className="starburst" style={{ ['--n' as string]: Math.min(stars, 5) }} aria-label={`별 ${stars}개`}>
              {Array.from({ length: stars }, (_, i) => (
                <span key={i} className={`bigstar${i < shown ? ' on' : ''}`} aria-hidden="true">
                  ⭐
                </span>
              ))}
            </div>
          )}
          <p className="lead">
            별 {starsTotal}개 모았어요
            {stars > 0 && <span className="plus"> (+{stars})</span>}
          </p>
          {correct !== undefined && total !== undefined && total > 0 && <p className="muted">처음에 바로 맞힌 문제 {correct}개</p>}
          {children}
          {teaser && (
            <div className="row teaser">
              <Buddy who={buddy} size={3.6} />
              <div className="speech">{teaser}</div>
            </div>
          )}
          <button type="button" className="btn go block" onClick={onDone}>
            {button}
          </button>
          {secondary && (
            <button type="button" className="btn ghost block" onClick={secondary.onClick}>
              {secondary.label}
            </button>
          )}
        </section>
      </div>
    </main>
  );
}
