'use client';

import { useEffect, useState } from 'react';
import { sfx } from '@/audio/sfx';
import type { AnswerProps } from './types';

export function NumberPad({ spec, status, attempt, onSubmit }: AnswerProps<'number'>) {
  const [txt, setTxt] = useState('');
  const locked = status === 'right' || status === 'reveal';

  useEffect(() => {
    if (attempt > 0) setTxt('');
  }, [attempt]);

  const shown = status === 'reveal' ? String(spec.correct) : txt;
  const press = (d: string) => {
    if (locked) return;
    sfx.tap();
    if (d === 'del') setTxt((t) => t.slice(0, -1));
    else if (txt.length < spec.maxDigits) setTxt((t) => (t === '0' ? d : t + d));
  };
  const ok = () => {
    if (locked || txt === '') return;
    onSubmit({ t: 'number', value: Number(txt) });
  };

  return (
    <div className="numpad">
      <div className={`readout${status === 'reveal' ? ' is-right' : ''}${status === 'right' ? ' is-right' : ''}`} aria-live="polite">
        {shown === '' ? <span className="ph">?</span> : shown}
      </div>
      <div className="keys">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" className="key" onClick={() => press(d)} disabled={locked}>
            {d}
          </button>
        ))}
        <button type="button" className="key alt" onClick={() => press('del')} disabled={locked} aria-label="지우기">
          ⌫
        </button>
        <button type="button" className="key" onClick={() => press('0')} disabled={locked}>
          0
        </button>
        <button type="button" className="key go" onClick={ok} disabled={locked || txt === ''}>
          확인
        </button>
      </div>
    </div>
  );
}
