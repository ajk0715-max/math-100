'use client';

import { useState } from 'react';
import { say } from '@/audio/speech';
import { sfx } from '@/audio/sfx';
import { nativeNum } from '@/core/ko';
import type { AnswerProps } from './types';

const HUES = ['sky', 'tangerine', 'leaf', 'grape', 'rose', 'sun'] as const;

/** 구슬을 눌러 왼쪽 병으로 옮기거나 다시 오른쪽 병으로 돌려놓는다 */
export function Split({ spec, status, onSubmit, theme }: AnswerProps<'split'>) {
  const [left, setLeft] = useState<number[]>([]);
  const locked = status === 'right' || status === 'reveal';
  const inLeft = status === 'reveal' ? Array.from({ length: spec.left }, (_, i) => i) : left;

  const toggle = (i: number) => {
    if (locked) return;
    sfx.place();
    const next = left.includes(i) ? left.filter((x) => x !== i) : [...left, i];
    setLeft(next);
    if (next.length > 0) void say(nativeNum(next.length));
  };

  const marble = (i: number) => (
    <button key={i} type="button" className={`marble ${HUES[i % HUES.length]}`} onClick={() => toggle(i)} disabled={locked} aria-label={`구슬 ${i + 1}`} />
  );
  const all = Array.from({ length: spec.total }, (_, i) => i);

  return (
    <div className={`split${theme ? ` t-${theme}` : ''}`}>
      <div className="jars">
        <div className={`jar left${status === 'right' || status === 'reveal' ? ' is-right' : ''}`}>
          <div className="glass" aria-label="왼쪽 병">
            {all.filter((i) => inLeft.includes(i)).map(marble)}
          </div>
          <div className="cap">왼쪽 병</div>
        </div>
        <div className="jar right">
          <div className="glass" aria-label="오른쪽 병">
            {all.filter((i) => !inLeft.includes(i)).map(marble)}
          </div>
          <div className="cap">오른쪽 병</div>
        </div>
      </div>
      <button type="button" className="btn go" disabled={locked} onClick={() => onSubmit({ t: 'split', left: left.length })}>
        다 담았어요
      </button>
    </div>
  );
}
