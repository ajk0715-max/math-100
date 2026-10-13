'use client';

import { useEffect, useState } from 'react';
import { say } from '@/audio/speech';
import { sfx } from '@/audio/sfx';
import { nativeNum } from '@/core/ko';
import type { AnswerProps } from './types';

export function PickN({ spec, status, attempt, onSubmit }: AnswerProps<'pickN'>) {
  const [picked, setPicked] = useState<number[]>([]);
  const locked = status === 'right' || status === 'reveal';

  useEffect(() => {
    if (attempt > 0) setPicked([]);
  }, [attempt]);

  const shownPicked = status === 'reveal' ? Array.from({ length: spec.n }, (_, i) => i) : picked;

  const toggle = (i: number) => {
    if (locked) return;
    sfx.tap();
    if (picked.includes(i)) {
      setPicked(picked.filter((x) => x !== i));
      return;
    }
    const next = [...picked, i];
    setPicked(next);
    void say(nativeNum(next.length));
  };

  return (
    <div className="pickn">
      <div className="pool">
        {Array.from({ length: spec.total }, (_, i) => {
          const order = shownPicked.indexOf(i);
          return (
            <button key={i} type="button" className={`obj${order >= 0 ? ' marked' : ''}`} onClick={() => toggle(i)} disabled={locked} aria-label={`${i + 1}번째`}>
              <span className="emo">{spec.emoji}</span>
              {order >= 0 && <i className="num">{order + 1}</i>}
            </button>
          );
        })}
      </div>
      <button type="button" className="btn go" disabled={locked || picked.length === 0} onClick={() => onSubmit({ t: 'pickN', count: picked.length })}>
        다 골랐어요
      </button>
    </div>
  );
}
