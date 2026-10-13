'use client';

import { useEffect, useRef } from 'react';

/**
 * 아이가 실제로 화면을 보며 움직인 시간을 센다.
 * 화면이 가려져 있거나 45초 넘게 아무것도 누르지 않은 시간은 세지 않는다.
 */
export function useActiveClock(onTick: (ms: number) => void, enabled = true): void {
  const last = useRef(Date.now());
  const cb = useRef(onTick);
  cb.current = onTick;

  useEffect(() => {
    if (!enabled) return;
    const touch = () => {
      last.current = Date.now();
    };
    touch();
    const events = ['pointerdown', 'keydown', 'touchstart'] as const;
    for (const e of events) window.addEventListener(e, touch, { passive: true });
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - last.current > 45_000) return;
      cb.current(1000);
    }, 1000);
    return () => {
      clearInterval(id);
      for (const e of events) window.removeEventListener(e, touch);
    };
  }, [enabled]);
}
