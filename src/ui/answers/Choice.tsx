'use client';

import { useState } from 'react';
import { sfx } from '@/audio/sfx';
import type { AnswerProps } from './types';
import { TextFace, fitLen } from './TextFace';

export function Choice({ spec, status, onSubmit, theme }: AnswerProps<'choice'>) {
  const [picked, setPicked] = useState<number | null>(null);
  const [wrongIdx, setWrongIdx] = useState<number[]>([]);
  const locked = status === 'right' || status === 'reveal';
  const hasVisual = spec.options.some((o) => o.visual);
  const cols = spec.cols ?? (hasVisual ? Math.min(3, spec.options.length) : spec.options.length <= 3 ? spec.options.length : 2);
  // 세 글자 이상인 글이 칸보다 넓어지지 않게 글자 크기를 칸에 맞춘다
  const tl = fitLen(spec.options);
  const fit = tl >= 3;

  const pick = (i: number) => {
    if (locked || wrongIdx.includes(i)) return;
    sfx.tap();
    setPicked(i);
    if (i !== spec.correct) setWrongIdx((w) => [...w, i]);
    onSubmit({ t: 'choice', index: i });
  };

  return (
    <div
      className={`opts${hasVisual ? ' vis' : ''}${fit ? ' fit' : ''}${theme ? ` t-${theme}` : ''}`}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, ...(fit ? { ['--cols' as string]: cols, ['--tl' as string]: tl } : {}) }}
    >
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
