'use client';

import { useMemo, useRef, useState } from 'react';
import { sfx } from '@/audio/sfx';
import { makeRng, shuffle } from '@/core/rng';
import type { MatchPair } from '@/core/types';
import { TextFace } from './TextFace';
import type { AnswerProps } from './types';

const TONES = ['sky', 'tangerine', 'leaf', 'grape', 'rose', 'sun'] as const;

function Face({ side }: { side: MatchPair['a'] }) {
  return <TextFace visual={side.visual} text={side.text} />;
}

/** 왼쪽 하나, 오른쪽 하나를 차례로 눌러 짝을 맞춘다. 다 맞추면 끝나고, 틀린 횟수를 알려 준다. */
export function Match({ q, spec, status, onSubmit, theme }: AnswerProps<'match'>) {
  const [selA, setSelA] = useState<string | null>(null);
  const [selB, setSelB] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [bad, setBad] = useState<{ a: string; b: string } | null>(null);
  const mistakes = useRef(0);
  const locked = status === 'right' || status === 'reveal';

  const order = useMemo(() => {
    const keys = spec.pairs.map((p) => p.key);
    const mixed = shuffle(makeRng(q.id, 'match'), keys);
    if (mixed.join() === keys.join() && mixed.length > 1) mixed.push(mixed.shift() as string);
    return mixed;
  }, [q.id, spec.pairs]);

  const byKey = new Map(spec.pairs.map((p) => [p.key, p]));

  const choose = (side: 'a' | 'b', key: string) => {
    if (locked || bad || done.includes(key)) return;
    sfx.tap();
    const a = side === 'a' ? key : selA;
    const b = side === 'b' ? key : selB;
    if (side === 'a') setSelA(key);
    else setSelB(key);
    if (!a || !b) return;
    if (a === b) {
      const next = [...done, a];
      setDone(next);
      setSelA(null);
      setSelB(null);
      sfx.place();
      if (next.length === spec.pairs.length) {
        setTimeout(() => onSubmit({ t: 'match', mistakes: mistakes.current }), 650);
      }
    } else {
      mistakes.current += 1;
      setBad({ a, b });
      sfx.wrong();
      setTimeout(() => {
        setBad(null);
        setSelA(null);
        setSelB(null);
      }, 520);
    }
  };

  const cell = (side: 'a' | 'b', key: string) => {
    const pair = byKey.get(key);
    if (!pair) return null;
    const idx = done.indexOf(key);
    const matched = idx >= 0;
    const selected = (side === 'a' ? selA : selB) === key;
    const isBad = bad !== null && (side === 'a' ? bad.a : bad.b) === key;
    return (
      <button
        key={side + key}
        type="button"
        className={`mcell ${side}${matched ? ` matched pair-${TONES[idx % TONES.length]}` : ''}${selected ? ' on' : ''}${isBad ? ' is-wrong' : ''}`}
        onClick={() => choose(side, key)}
        disabled={matched}
      >
        <Face side={pair[side]} />
        {matched && <i className="badge">{idx + 1}</i>}
      </button>
    );
  };

  return (
    <div className={`match${theme ? ` t-${theme}` : ''}`}>
      <div className="col">{spec.pairs.map((p) => cell('a', p.key))}</div>
      <div className="col">{order.map((k) => cell('b', k))}</div>
    </div>
  );
}
