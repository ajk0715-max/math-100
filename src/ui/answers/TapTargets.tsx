'use client';

import { useEffect, useState } from 'react';
import { say } from '@/audio/speech';
import { sfx } from '@/audio/sfx';
import type { TapItem } from '@/core/types';
import { TextFace } from './TextFace';
import type { AnswerProps } from './types';

export function TapTargets({ spec, status, attempt, onSubmit, theme }: AnswerProps<'tapTargets'>) {
  const need = spec.need ?? (spec.targets.length === 1 ? 'one' : 'all');
  const [sel, setSel] = useState<string[]>([]);
  const [bad, setBad] = useState<string[]>([]);
  const locked = status === 'right' || status === 'reveal';

  useEffect(() => {
    if (attempt > 0) setSel([]);
  }, [attempt]);

  const tap = (it: TapItem) => {
    if (locked || bad.includes(it.key)) return;
    sfx.tap();
    if (it.say) void say(it.say);
    if (need === 'one') {
      if (!spec.targets.includes(it.key)) setBad((b) => [...b, it.key]);
      setSel([it.key]);
      onSubmit({ t: 'tapTargets', keys: [it.key] });
      return;
    }
    setSel((s) => (s.includes(it.key) ? s.filter((k) => k !== it.key) : [...s, it.key]));
  };

  const cols = spec.cols ?? 3;
  const hasVisual = spec.items.some((i) => i.visual);

  return (
    <div className={`taps${theme ? ` t-${theme}` : ''}`}>
      <div className={`grid${hasVisual ? ' vis' : ''}`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {spec.items.map((it, i) => {
          const isTarget = spec.targets.includes(it.key);
          const chosen = sel.includes(it.key);
          const right = (status === 'reveal' && isTarget) || (status === 'right' && chosen && isTarget);
          const wrong = bad.includes(it.key) && !right;
          const dim = status === 'reveal' && !isTarget;
          return (
            <button
              key={it.key}
              type="button"
              className={`tap${chosen && !right && !wrong ? ' on' : ''}${right ? ' is-right' : ''}${wrong ? ' is-wrong' : ''}${dim ? ' is-dim' : ''}`}
              onClick={() => tap(it)}
              disabled={wrong}
              style={{ ['--i' as string]: i }}
            >
              <TextFace visual={it.visual} text={it.text} />
            </button>
          );
        })}
      </div>
      {need === 'all' && (
        <button type="button" className="btn go" disabled={locked || sel.length === 0} onClick={() => onSubmit({ t: 'tapTargets', keys: sel })}>
          다 골랐어요
        </button>
      )}
    </div>
  );
}
