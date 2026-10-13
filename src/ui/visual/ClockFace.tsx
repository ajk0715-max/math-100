import type { CSSProperties } from 'react';

export interface ClockFaceProps {
  h: number;
  m: number;
  hands?: 'both' | 'hour' | 'none';
  numbers?: boolean;
  /** 'hour'/'minute'면 그 바늘을, 숫자면 그 숫자를 빨갛게 표시한다 */
  mark?: 'hour' | 'minute' | number;
  size?: 'sm' | 'md' | 'lg';
  /** 바늘을 눌러 움직일 때 쓰는 연결 */
  handlers?: {
    svgRef?: (el: SVGSVGElement | null) => void;
    onPointerDown?: (e: React.PointerEvent<SVGSVGElement>) => void;
    onPointerMove?: (e: React.PointerEvent<SVGSVGElement>) => void;
    onPointerUp?: (e: React.PointerEvent<SVGSVGElement>) => void;
  };
  /** 움직일 수 있는 바늘 표시(손잡이) */
  grab?: 'hour' | 'minute' | 'both' | null;
  className?: string;
  style?: CSSProperties;
}

const C = 100;
const polar = (deg: number, r: number): [number, number] => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
};

export function hourAngle(h: number, m: number): number {
  return ((h % 12) + m / 60) * 30;
}
export function minuteAngle(m: number): number {
  return m * 6;
}

export function ClockFace({ h, m, hands = 'both', numbers = true, mark, size = 'lg', handlers, grab, className, style }: ClockFaceProps) {
  const ha = hourAngle(h, m);
  const ma = minuteAngle(m);
  const hourEnd = polar(ha, 50);
  const minEnd = polar(ma, 74);
  const hourRed = mark === 'hour';
  const minRed = mark === 'minute';
  const markedNumber = typeof mark === 'number' ? mark : null;

  const ticks = Array.from({ length: 60 }, (_, i) => {
    const big = i % 5 === 0;
    const [x1, y1] = polar(i * 6, big ? 80 : 84);
    const [x2, y2] = polar(i * 6, 90);
    return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#1d2742" strokeWidth={big ? 3 : 1.2} strokeLinecap="round" opacity={big ? 1 : 0.55} />;
  });

  return (
    <div className={`clock ${size} ${className ?? ''}`} style={style}>
      <svg
        ref={handlers?.svgRef}
        viewBox="0 0 200 200"
        role="img"
        aria-label="시계"
        onPointerDown={handlers?.onPointerDown}
        onPointerMove={handlers?.onPointerMove}
        onPointerUp={handlers?.onPointerUp}
        onPointerCancel={handlers?.onPointerUp}
        style={{ touchAction: handlers ? 'none' : undefined }}
      >
        <circle cx={C} cy={C + 5} r="97" fill="#cfd9ee" />
        <circle cx={C} cy={C} r="97" fill="#4f9cf5" />
        <circle cx={C} cy={C} r="90" fill="#ffffff" />
        {ticks}
        {numbers &&
          Array.from({ length: 12 }, (_, i) => {
            const n = i + 1;
            const [x, y] = polar(n * 30, 66);
            const isMarked = markedNumber === n;
            return (
              <g key={n}>
                {isMarked && <circle cx={x} cy={y} r="14" fill="#e8453c" />}
                <text
                  x={x}
                  y={y + 1}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontFamily="var(--font-display)"
                  fontSize={n > 9 ? 22 : 24}
                  fill={isMarked ? '#fff' : '#1d2742'}
                >
                  {n}
                </text>
              </g>
            );
          })}
        {hands === 'both' && (
          <>
            <line x1={C} y1={C} x2={minEnd[0]} y2={minEnd[1]} stroke={minRed ? '#e8453c' : '#1d2742'} strokeWidth="6" strokeLinecap="round" />
            {(grab === 'minute' || grab === 'both') && <circle cx={minEnd[0]} cy={minEnd[1]} r="11" fill="#fff" stroke="#4f9cf5" strokeWidth="4" />}
          </>
        )}
        {hands !== 'none' && (
          <>
            <line x1={C} y1={C} x2={hourEnd[0]} y2={hourEnd[1]} stroke={hourRed ? '#e8453c' : '#1d2742'} strokeWidth="10" strokeLinecap="round" />
            {(grab === 'hour' || grab === 'both') && <circle cx={hourEnd[0]} cy={hourEnd[1]} r="12" fill="#fff" stroke="#ff8a3d" strokeWidth="4" />}
          </>
        )}
        <circle cx={C} cy={C} r="7" fill={hands === 'none' ? '#1d2742' : '#1d2742'} />
        <circle cx={C} cy={C} r="2.5" fill="#fff" />
      </svg>
    </div>
  );
}
