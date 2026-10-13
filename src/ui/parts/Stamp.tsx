import { useId } from 'react';

export interface StampProps {
  /** 두 줄까지. 기본은 "참 잘했어요" */
  lines?: [string, string?];
  /** 도장이 찍히는 움직임을 보여 줄지 */
  play?: boolean;
  className?: string;
}

/** 빨간 고무도장. 이 앱에서 가장 크게 움직이는 장면은 이것 하나뿐이다. */
export function Stamp({ lines = ['참 잘', '했어요'], play = true, className }: StampProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const ink = '#e8453c';
  const two = lines[1] !== undefined;
  return (
    <svg className={`stamp${play ? ' play' : ''}${className ? ` ${className}` : ''}`} viewBox="0 0 200 200" role="img" aria-label={lines.join('')}>
      <defs>
        <filter id={`rough${uid}`} x="-8%" y="-8%" width="116%" height="116%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" result="warp" />
          <feDisplacementMap in="SourceGraphic" in2="warp" scale="3.4" xChannelSelector="R" yChannelSelector="G" result="bent" />
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="1" seed="11" result="grain" />
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -13 8.4" result="holes" />
          <feComposite in="bent" in2="holes" operator="in" />
        </filter>
      </defs>
      <g filter={`url(#rough${uid})`} transform="rotate(-9 100 100)" fill={ink} stroke={ink}>
        <circle cx="100" cy="100" r="91" fill="none" strokeWidth="7" />
        <circle cx="100" cy="100" r="79" fill="none" strokeWidth="2.6" />
        <path d="M100 28 l4.2 8.6 9.4 1.3 -6.8 6.6 1.6 9.4 -8.4 -4.4 -8.4 4.4 1.6 -9.4 -6.8 -6.6 9.4 -1.3z" strokeWidth="0" />
        <text x="100" y={two ? 96 : 112} textAnchor="middle" dominantBaseline="central" fontFamily="var(--font-display)" fontSize={two ? 46 : 52} strokeWidth="0.6">
          {lines[0]}
        </text>
        {two && (
          <text x="100" y="144" textAnchor="middle" dominantBaseline="central" fontFamily="var(--font-display)" fontSize="46" strokeWidth="0.6">
            {lines[1]}
          </text>
        )}
        <text x="100" y="178" textAnchor="middle" fontFamily="var(--font-display)" fontSize="12" letterSpacing="3" strokeWidth="0">
          100일 수학
        </text>
      </g>
    </svg>
  );
}
