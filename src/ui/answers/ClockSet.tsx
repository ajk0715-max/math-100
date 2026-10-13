'use client';

import { useRef, useState } from 'react';
import { say } from '@/audio/speech';
import { sfx } from '@/audio/sfx';
import { timeKo } from '@/core/ko';
import { ClockFace, hourAngle, minuteAngle } from '../visual/ClockFace';
import type { AnswerProps } from './types';

type Hand = 'hour' | 'minute';

const angDiff = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/** 처음 보이는 시각은 정답과 달라야 한다 */
function startAt(h: number, m: number): { h: number; m: number } {
  return h === 12 && m === 0 ? { h: 6, m: 0 } : { h: 12, m: 0 };
}

export function ClockSet({ spec, status, onSubmit }: AnswerProps<'clockSet'>) {
  const locked = status === 'right' || status === 'reveal';
  const [t, setT] = useState(() => startAt(spec.h, spec.m));
  const [moved, setMoved] = useState(false);
  const svgEl = useRef<SVGSVGElement | null>(null);
  const active = useRef<Hand | null>(null);
  const cur = useRef(t);
  cur.current = t;

  const minuteMovable = spec.mode !== 'hour';
  const step = spec.mode === 'five' ? 5 : 30;

  const read = (e: React.PointerEvent<SVGSVGElement>): { deg: number; dist: number } | null => {
    const el = svgEl.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    return { deg: ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360, dist: Math.hypot(dx, dy) / (r.width / 2) };
  };

  const apply = (hand: Hand, deg: number) => {
    const now = cur.current;
    if (hand === 'hour') {
      // 시침은 분침이 가리키는 만큼 숫자 사이로 밀려 있으므로 그만큼 빼고 가장 가까운 시로 맞춘다
      let h = Math.round((deg - now.m * 0.5) / 30);
      h = ((h % 12) + 12) % 12;
      if (h === 0) h = 12;
      if (h !== now.h) {
        cur.current = { ...now, h };
        setT(cur.current);
        sfx.tap();
      }
    } else {
      let m = Math.round(deg / 6 / step) * step;
      if (m >= 60) m = 0;
      if (m !== now.m) {
        cur.current = { ...now, m };
        setT(cur.current);
        sfx.tap();
      }
    }
    setMoved(true);
  };

  const down = (e: React.PointerEvent<SVGSVGElement>) => {
    if (locked) return;
    const p = read(e);
    if (!p) return;
    let hand: Hand = 'hour';
    if (minuteMovable) {
      // 바늘 가까이를 누르면 그 바늘, 그렇지 않으면 안쪽은 시침·바깥쪽은 분침
      const now = cur.current;
      const nearMin = angDiff(p.deg, minuteAngle(now.m)) < 22 && p.dist > 0.28;
      const nearHour = angDiff(p.deg, hourAngle(now.h, now.m)) < 22 && p.dist < 0.62;
      if (nearMin && !nearHour) hand = 'minute';
      else if (nearHour && !nearMin) hand = 'hour';
      else hand = p.dist > 0.6 ? 'minute' : 'hour';
    }
    active.current = hand;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* 일부 브라우저는 캡처를 지원하지 않는다 */
    }
    apply(hand, p.deg);
  };
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!active.current) return;
    const p = read(e);
    if (p) apply(active.current, p.deg);
  };
  const up = () => {
    if (!active.current) return;
    active.current = null;
    sfx.place();
    void say(timeKo(cur.current.h, cur.current.m));
  };

  const shown = status === 'reveal' ? { h: spec.h, m: spec.m } : t;

  return (
    <div className="clockset">
      <ClockFace
        h={shown.h}
        m={shown.m}
        hands="both"
        size="lg"
        grab={locked ? null : minuteMovable ? 'both' : 'hour'}
        handlers={
          locked
            ? undefined
            : {
                svgRef: (el) => {
                  svgEl.current = el;
                },
                onPointerDown: down,
                onPointerMove: move,
                onPointerUp: up,
              }
        }
      />
      <button type="button" className="btn go" disabled={locked || !moved} onClick={() => onSubmit({ t: 'clockSet', h: t.h, m: t.m })}>
        다 맞췄어요
      </button>
    </div>
  );
}
