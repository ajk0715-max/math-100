'use client';

import { useEffect, useRef, useState } from 'react';

/** 오른쪽 위 모서리를 2초 동안 꾹 누르면 보호자 화면으로 가는 입구. 아이가 실수로 열지 않게 한다. */
export function ParentCorner({ onOpen, holdMs = 2000 }: { onOpen: () => void; holdMs?: number }) {
  const [p, setP] = useState(0);
  const raf = useRef<number | null>(null);
  const t0 = useRef(0);
  const fired = useRef(false);

  const stop = () => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
    setP(0);
  };
  useEffect(() => () => stop(), []);

  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    fired.current = false;
    t0.current = performance.now();
    const loop = () => {
      const k = Math.min(1, (performance.now() - t0.current) / holdMs);
      setP(k);
      if (k >= 1) {
        if (!fired.current) {
          fired.current = true;
          stop();
          onOpen();
        }
        return;
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  };

  const C = 2 * Math.PI * 18;
  return (
    <button type="button" className="pcorner" onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onContextMenu={(e) => e.preventDefault()} aria-label="보호자 메뉴 (2초 동안 길게 누르기)">
      <svg viewBox="0 0 44 44" aria-hidden="true">
        <circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" strokeOpacity="0.16" strokeWidth="3" />
        {p > 0 && <circle cx="22" cy="22" r="18" fill="none" stroke="#4f9cf5" strokeWidth="4" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - p)} transform="rotate(-90 22 22)" />}
        <g fill="currentColor" opacity="0.5">
          <circle cx="22" cy="22" r="3.4" />
          <path d="M22 11.5v4M22 28.5v4M11.5 22h4M28.5 22h4M14.6 14.6l2.8 2.8M26.6 26.6l2.8 2.8M14.6 29.4l2.8-2.8M26.6 17.4l2.8-2.8" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        </g>
      </svg>
    </button>
  );
}
