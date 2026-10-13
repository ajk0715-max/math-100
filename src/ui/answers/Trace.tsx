'use client';

import { useRef, useState } from 'react';
import { sfx } from '@/audio/sfx';
import type { AnswerProps } from './types';

const SIZE = 600;
const PEN = 28;

type Pt = { x: number; y: number };

/** 숫자를 점선 위에 손가락으로 따라 쓴다. 맞고 틀림은 아이가 스스로 확인한다. */
export function Trace({ spec, status, onSubmit }: AnswerProps<'trace'>) {
  const cv = useRef<HTMLCanvasElement | null>(null);
  const last = useRef<Pt | null>(null);
  const [inked, setInked] = useState(false);
  const [checking, setChecking] = useState(false);
  const locked = status === 'right' || status === 'reveal';

  const ctx = (): CanvasRenderingContext2D | null => {
    const c = cv.current;
    const g = c?.getContext('2d') ?? null;
    if (g) {
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.lineWidth = PEN;
      g.strokeStyle = '#1d2742';
      g.fillStyle = '#1d2742';
    }
    return g;
  };

  const at = (e: React.PointerEvent<HTMLCanvasElement>): Pt => {
    const r = (cv.current as HTMLCanvasElement).getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * SIZE, y: ((e.clientY - r.top) / r.height) * SIZE };
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (locked || checking) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* 무시 */
    }
    const p = at(e);
    last.current = p;
    const g = ctx();
    if (g) {
      g.beginPath();
      g.arc(p.x, p.y, PEN / 2, 0, Math.PI * 2);
      g.fill();
    }
    if (!inked) setInked(true);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const from = last.current;
    if (!from) return;
    const p = at(e);
    const g = ctx();
    if (g) {
      g.beginPath();
      g.moveTo(from.x, from.y);
      g.lineTo(p.x, p.y);
      g.stroke();
    }
    last.current = p;
  };
  const up = () => {
    last.current = null;
  };

  const clear = () => {
    ctx()?.clearRect(0, 0, SIZE, SIZE);
    setInked(false);
    setChecking(false);
    sfx.tap();
  };

  const long = spec.glyph.length > 1;

  return (
    <div className="trace">
      <div className="paper">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <line x1="6" y1="50" x2="94" y2="50" stroke="#d7def0" strokeWidth="0.5" strokeDasharray="2 2" />
          <text
            x="50"
            y="53"
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="var(--font-display)"
            fontSize={long ? 62 : 84}
            fill="#eef3fd"
            stroke="#8da6d6"
            strokeWidth="0.9"
            strokeDasharray="2.4 2.4"
          >
            {spec.glyph}
          </text>
        </svg>
        <canvas
          ref={cv}
          width={SIZE}
          height={SIZE}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          aria-label={`숫자 ${spec.glyph}를 따라 쓰는 칸`}
        />
      </div>
      {!checking ? (
        <div className="row two">
          <button type="button" className="btn ghost" onClick={clear} disabled={locked || !inked}>
            지우기
          </button>
          <button
            type="button"
            className="btn go"
            disabled={locked || !inked}
            onClick={() => {
              sfx.place();
              setChecking(true);
            }}
          >
            다 썼어요
          </button>
        </div>
      ) : (
        <div className="selfcheck">
          <p className="display">점선과 비교해 보세요. 잘 썼나요?</p>
          <div className="row two">
            <button type="button" className="btn ghost" onClick={clear} disabled={locked}>
              다시 쓸래요
            </button>
            <button type="button" className="btn go" disabled={locked} onClick={() => onSubmit({ t: 'trace', ok: true })}>
              잘 썼어요
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
