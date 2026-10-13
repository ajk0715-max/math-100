'use client';

import { useEffect, useState } from 'react';
import { sfx } from '@/audio/sfx';

export interface PinPadProps {
  length?: number;
  /** 입력이 다 차면 부른다 */
  onComplete: (pin: string) => void;
  /** 이 값이 바뀔 때마다 입력칸을 비운다(틀렸을 때 흔들림도 함께) */
  resetKey?: number | string;
  shake?: boolean;
  disabled?: boolean;
}

/** 보호자용 숫자 키패드(자릿수만큼 점으로 보여 준다) */
export function PinPad({ length = 4, onComplete, resetKey, shake, disabled }: PinPadProps) {
  const [pin, setPin] = useState('');

  useEffect(() => setPin(''), [resetKey]);

  const press = (d: string) => {
    if (disabled) return;
    sfx.tap();
    if (d === 'del') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (pin.length >= length) return;
    const next = pin + d;
    setPin(next);
    if (next.length === length) setTimeout(() => onComplete(next), 90);
  };

  return (
    <div className="pinpad">
      <div className={`dots${shake ? ' shake' : ''}`} aria-label={`${pin.length}자리 입력됨`}>
        {Array.from({ length }, (_, i) => (
          <i key={i} className={i < pin.length ? 'on' : ''} />
        ))}
      </div>
      <div className="keys">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" className="key" onClick={() => press(d)} disabled={disabled}>
            {d}
          </button>
        ))}
        <span />
        <button type="button" className="key" onClick={() => press('0')} disabled={disabled}>
          0
        </button>
        <button type="button" className="key alt" onClick={() => press('del')} disabled={disabled} aria-label="지우기">
          ⌫
        </button>
      </div>
    </div>
  );
}
