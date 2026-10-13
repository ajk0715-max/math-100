'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { AttemptRec, SessionRec } from '@/db/db';
import { allSessions, attemptsOf } from '@/db/repo';

/** 화면 아래에 잠깐 뜨는 알림 */
export type Notify = (msg: string) => void;

/** 한 아이의 수업·문제 기록 전체. dep가 바뀌면 다시 읽는다. */
export function useRecords(profileId: string, dep: unknown): { sessions: SessionRec[]; attempts: AttemptRec[] } | null {
  const [rec, setRec] = useState<{ sessions: SessionRec[]; attempts: AttemptRec[] } | null>(null);
  useEffect(() => {
    let alive = true;
    void Promise.all([allSessions(profileId), attemptsOf(profileId)]).then(([sessions, attempts]) => {
      if (alive) setRec({ sessions, attempts });
    });
    return () => {
      alive = false;
    };
  }, [profileId, dep]);
  return rec;
}

export const percent = (n: number, d: number): number | null => (d > 0 ? Math.round((n / d) * 100) : null);

/** 이름, 정답률, 막대 하나 */
export function RateBar({ label, right, total }: { label: string; right: number; total: number }) {
  const r = percent(right, total);
  const tone = r === null ? '' : r >= 80 ? ' good' : r >= 60 ? ' mid' : ' low';
  return (
    <li className="ratebar">
      <span className="rb-label">{label}</span>
      <span className="rb-num">
        {r === null ? '-' : `${r}%`}{' '}
        <small>
          ({right}/{total})
        </small>
      </span>
      <span className={`rb-track${tone}`} aria-hidden="true">
        <i style={{ width: `${r ?? 0}%` }} />
      </span>
    </li>
  );
}

/** 확인이 필요한 일 앞에 띄우는 창 */
export function Confirm({
  title,
  children,
  ok,
  tone = 'go',
  onOk,
  onCancel,
}: {
  title: string;
  children: ReactNode;
  ok: string;
  tone?: 'go' | 'warm' | 'rose' | 'grape';
  onOk: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-label={title}>
      <div className="sheet dialog col">
        <h2>{title}</h2>
        {children}
        <div className="row two">
          <button type="button" className="btn ghost" onClick={onCancel}>
            취소
          </button>
          <button type="button" className={`btn ${tone}`} onClick={onOk}>
            {ok}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 파일로 내려받는다 */
export function saveFile(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 8000);
}

export const rid = (): string => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);

/** "3일 전"처럼 읽기 쉽게 */
export function agoText(ts: number, now: number): string {
  const days = Math.floor((now - ts) / 86_400_000);
  if (days <= 0) return '오늘';
  if (days === 1) return '어제';
  return `${days}일 전`;
}
