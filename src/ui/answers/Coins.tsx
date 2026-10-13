'use client';

import { useEffect, useState } from 'react';
import { say } from '@/audio/speech';
import { sfx } from '@/audio/sfx';
import { wonKo } from '@/core/ko';
import type { AnswerProps } from './types';

function Coin({ won, onClick, disabled, small }: { won: number; onClick?: () => void; disabled?: boolean; small?: boolean }) {
  return (
    <button type="button" className={`coin w${won}${small ? ' small' : ''}`} onClick={onClick} disabled={disabled} aria-label={`${won}원`}>
      <span>{won}</span>
    </button>
  );
}

/** 동전을 눌러 지갑에 담는다. 담은 동전을 누르면 다시 꺼낸다. */
export function Coins({ spec, status, attempt, onSubmit }: AnswerProps<'coins'>) {
  const [purse, setPurse] = useState<number[]>([]);
  const locked = status === 'right' || status === 'reveal';
  const total = purse.reduce((a, b) => a + b, 0);

  useEffect(() => {
    if (attempt > 0) setPurse([]);
  }, [attempt]);

  const add = (won: number) => {
    if (locked) return;
    sfx.place();
    const next = [...purse, won];
    setPurse(next);
    void say(wonKo(next.reduce((a, b) => a + b, 0)));
  };
  const remove = (i: number) => {
    if (locked) return;
    sfx.tap();
    setPurse(purse.filter((_, k) => k !== i));
  };

  return (
    <div className="coins">
      <div className="purse" aria-label="지갑">
        <div className="pile">
          {purse.length === 0 && <span className="muted">동전을 눌러 담아요</span>}
          {purse.map((w, i) => (
            <Coin key={i} won={w} small onClick={() => remove(i)} disabled={locked} />
          ))}
        </div>
        {spec.showSum && <div className="sum">{total}원</div>}
      </div>
      <div className="tray">
        {spec.denoms.map((w) => (
          <Coin key={w} won={w} onClick={() => add(w)} disabled={locked} />
        ))}
      </div>
      <button type="button" className="btn go" disabled={locked || purse.length === 0} onClick={() => onSubmit({ t: 'coins', total })}>
        다 냈어요
      </button>
    </div>
  );
}
