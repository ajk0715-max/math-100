'use client';

import { useEffect, useState } from 'react';
import { say } from '@/audio/speech';
import { sfx } from '@/audio/sfx';
import { Calendar } from '../visual/Calendar';
import type { AnswerProps } from './types';

export function CalTap({ spec, status, attempt, onSubmit, theme }: AnswerProps<'calTap'>) {
  const need = spec.need ?? (spec.targets.length === 1 ? 'one' : 'all');
  const [picked, setPicked] = useState<number[]>([]);
  const [wrongDays, setWrongDays] = useState<number[]>([]);
  const locked = status === 'right' || status === 'reveal';

  useEffect(() => {
    if (attempt > 0 && need === 'all') setPicked([]);
  }, [attempt, need]);

  const pick = (d: number) => {
    if (locked || wrongDays.includes(d)) return;
    sfx.tap();
    void say(`${d}일`);
    if (need === 'one') {
      setPicked([d]);
      if (!spec.targets.includes(d)) setWrongDays((w) => [...w, d]);
      onSubmit({ t: 'calTap', days: [d] });
      return;
    }
    setPicked((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]));
  };

  const right = status === 'reveal' ? spec.targets : status === 'right' ? (need === 'one' ? picked : spec.targets) : [];

  return (
    <div className={`caltap${theme ? ` t-${theme}` : ''}`}>
      <Calendar
        year={spec.year}
        month={spec.month}
        marks={spec.marks}
        onPick={pick}
        picked={need === 'all' && !locked ? picked : []}
        right={right}
        wrong={wrongDays.filter((d) => !right.includes(d))}
      />
      {need === 'all' && (
        <button type="button" className="btn go" disabled={locked || picked.length === 0} onClick={() => onSubmit({ t: 'calTap', days: picked })}>
          다 골랐어요
        </button>
      )}
    </div>
  );
}
