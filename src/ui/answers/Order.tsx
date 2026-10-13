'use client';

import { useEffect, useState } from 'react';
import { say } from '@/audio/speech';
import { sfx } from '@/audio/sfx';
import { TextFace } from './TextFace';
import type { AnswerProps } from './types';

export function Order({ spec, status, attempt, onSubmit }: AnswerProps<'order'>) {
  const [placed, setPlaced] = useState<string[]>([]);
  const locked = status === 'right' || status === 'reveal';
  const style = spec.style ?? 'cards';

  useEffect(() => {
    if (attempt > 0) setPlaced([]);
  }, [attempt]);

  const line = status === 'reveal' ? spec.correct : placed;
  const byKey = new Map(spec.items.map((i) => [i.key, i]));

  const add = (key: string) => {
    if (locked || placed.includes(key)) return;
    sfx.place();
    const item = byKey.get(key);
    void say(item?.say ?? item?.text ?? '');
    const next = [...placed, key];
    setPlaced(next);
    if (next.length === spec.items.length) setTimeout(() => onSubmit({ t: 'order', keys: next }), 380);
  };
  const remove = (key: string) => {
    if (locked) return;
    sfx.tap();
    setPlaced(placed.filter((k) => k !== key));
  };

  const face = (key: string) => {
    const it = byKey.get(key);
    if (!it) return null;
    return <TextFace visual={it.visual} text={it.text} />;
  };

  const n = spec.items.length;
  const cols = style === 'train' || style === 'oneline' ? n : n <= 3 ? n : n === 4 ? 2 : 3;

  return (
    <div className={`order ${style}`} style={{ ['--cols' as string]: cols }}>
      <div className="line">
        {spec.items.map((_, i) => {
          const k = line[i];
          return (
            <button
              key={i}
              type="button"
              className={`slot${k ? ' has' : ''}${status === 'reveal' ? ' is-right' : ''}`}
              onClick={() => k && remove(k)}
              disabled={locked || !k}
              aria-label={`${i + 1}번째 자리`}
            >
              {k ? face(k) : <span className="n">{i + 1}</span>}
            </button>
          );
        })}
      </div>
      <div className="pool">
        {spec.items.map((it) => (
          <button key={it.key} type="button" className={`card${placed.includes(it.key) || status === 'reveal' ? ' gone' : ''}`} onClick={() => add(it.key)} disabled={locked || placed.includes(it.key)}>
            {face(it.key)}
          </button>
        ))}
      </div>
    </div>
  );
}
