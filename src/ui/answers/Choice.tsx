'use client';

import { useState } from 'react';
import { sfx } from '@/audio/sfx';
import type { AnswerProps } from './types';
import { TextFace } from './TextFace';

export function Choice({ spec, status, onSubmit, theme }: AnswerProps<'choice'>) {
  const [picked, setPicked] = useState<number | null>(null);
  const [wrongIdx, setWrongIdx] = useState<number[]>([]);
  const locked = status === 'right' || status === 'reveal';
  const hasVisual = spec.options.some((o) => o.visual);
  const cols = spec.cols ?? (hasVisual ? Math.min(3, spec.options.length) : spec.options.length <= 3 ? spec.options.length : 2);

  const pick = (i: number) => {
    if (locked || wrongIdx.includes(i)) return;
    sfx.tap();
    setPicked(i);
    if (i !== spec.correct) setWrongIdx((w) => [...w, i]);
    onSubmit({ t: 'choice', index: i });
  };

  return (
    <div className={`opts${hasVisual ? ' vis' : ''}${theme ? ` t-${theme}` : ''}`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {spec.options.map((o, i) => {
        const isRight = (status === 'right' && picked === i) || (status === 'reveal' && i === spec.correct);
        const isWrong = wrongIdx.includes(i) && !isRight;
        const dim = status === 'reveal' && i !== spec.correct;
        return (
          <button
            key={o.key}
            type="button"
            className={`opt${isRight ? ' is-right' : ''}${isWrong ? ' is-wrong' : ''}${dim ? ' is-dim' : ''}`}
            onClick={() => pick(i)}
            disabled={isWrong}
            style={{ ['--i' as string]: i }}
          >
            <TextFace visual={o.visual} text={o.text} />
          </button>
        );
      })}
    </div>
  );
}
