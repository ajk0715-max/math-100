'use client';

import { useEffect, useMemo, useState } from 'react';
import { sfx } from '@/audio/sfx';
import type { AnswerProps } from './types';

export function Gaps({ spec, status, attempt, onSubmit }: AnswerProps<'gaps'>) {
  const blanks = spec.seq.reduce<number[]>((acc, v, i) => (v === null ? [...acc, i] : acc), []);
  const [filled, setFilled] = useState<(number | null)[]>(() => blanks.map(() => null));
  const locked = status === 'right' || status === 'reveal';

  // 틀린 칸은 비우고 맞은 칸은 남긴다
  useEffect(() => {
    if (attempt > 0) setFilled((f) => f.map((v, k) => (v === spec.answers[k] ? v : null)));
  }, [attempt, spec.answers]);

  const view = useMemo(() => (status === 'reveal' ? spec.answers : filled), [status, spec.answers, filled]);
  const used = new Set(view.filter((v): v is number => v !== null));

  const place = (n: number) => {
    if (locked) return;
    const k = filled.findIndex((v) => v === null);
    if (k < 0) return;
    sfx.place();
    const next = filled.map((v, i) => (i === k ? n : v));
    setFilled(next);
    if (next.every((v) => v !== null)) setTimeout(() => onSubmit({ t: 'gaps', values: next }), 220);
  };
  const unplace = (k: number) => {
    if (locked || filled[k] === null) return;
    if (filled[k] === spec.answers[k] && attempt > 0) return;
    sfx.tap();
    setFilled(filled.map((v, i) => (i === k ? null : v)));
  };

  let bi = -1;
  return (
    <div className="gaps">
      <div className="stones">
        {spec.seq.map((v, i) => {
          if (v !== null) return <div key={i} className="stone">{v}</div>;
          bi++;
          const k = bi;
          const val = view[k] ?? null;
          const ok = status === 'reveal' || (val !== null && attempt > 0 && val === spec.answers[k]);
          return (
            <button key={i} type="button" className={`stone ${val === null ? 'empty' : 'fill'}${ok ? ' ok' : ''}`} onClick={() => unplace(k)} disabled={locked}>
              {val === null ? '?' : val}
            </button>
          );
        })}
      </div>
      <div className="tray">
        {spec.tokens.map((t) => (
          <button key={t} type="button" className={`token${used.has(t) ? ' used' : ''}`} disabled={locked || used.has(t)} onClick={() => place(t)}>
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}
