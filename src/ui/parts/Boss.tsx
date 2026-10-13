import type { CSSProperties } from 'react';

export type BossMood = 'smug' | 'worried' | 'down';

const INK = '#1d2742';

/** 먹물 도깨비: 문제를 맞힐 때마다 작아진다. 풀이가 모두 끝나면 사라진다. */
export function Boss({ mood = 'smug', size = 6, hit = 0, className }: { mood?: BossMood; size?: number; hit?: number; className?: string }) {
  const style: CSSProperties = { width: `${size}rem`, height: `${size}rem` };
  return (
    <svg key={hit} className={`bossfig ${mood}${hit ? ' hit' : ''}${className ? ` ${className}` : ''}`} viewBox="0 0 120 120" style={style} role="img" aria-label="먹물 도깨비">
      {/* 뿔 */}
      <path d="M34 34 L28 12 L48 28 Z" fill="#fff0bd" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M86 34 L92 12 L72 28 Z" fill="#fff0bd" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      {/* 몸: 먹물 방울 */}
      <path
        d="M60 22 C88 22 104 42 104 66 C104 90 88 104 60 104 C32 104 16 90 16 66 C16 42 32 22 60 22 Z"
        fill="#5b4fc9"
        stroke={INK}
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <path d="M26 70 C26 98 34 112 38 112 C42 112 42 100 40 94" fill="#5b4fc9" stroke={INK} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M92 74 C94 96 90 110 86 110 C82 110 82 98 84 90" fill="#5b4fc9" stroke={INK} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      <ellipse cx="38" cy="44" rx="10" ry="6" fill="#fff" opacity="0.25" transform="rotate(-25 38 44)" />
      {/* 눈 */}
      {mood === 'down' ? (
        <g stroke={INK} strokeWidth="4" strokeLinecap="round">
          <path d="M36 54 l14 14 M50 54 l-14 14" />
          <path d="M70 54 l14 14 M84 54 l-14 14" />
        </g>
      ) : (
        <g>
          <circle cx="43" cy="60" r="11" fill="#fff" stroke={INK} strokeWidth="3" />
          <circle cx="77" cy="60" r="11" fill="#fff" stroke={INK} strokeWidth="3" />
          <circle cx={mood === 'worried' ? 45 : 46} cy={mood === 'worried' ? 63 : 61} r="5" fill={INK} />
          <circle cx={mood === 'worried' ? 75 : 74} cy={mood === 'worried' ? 63 : 61} r="5" fill={INK} />
          <path d={mood === 'worried' ? 'M30 44 L52 50 M90 44 L68 50' : 'M30 50 L52 46 M90 50 L68 46'} stroke={INK} strokeWidth="4" strokeLinecap="round" />
        </g>
      )}
      {/* 입 */}
      {mood === 'smug' && (
        <path d="M42 84 Q60 98 78 84 L74 90 L68 84 L62 91 L56 84 L50 91 Z" fill="#fff" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      )}
      {mood === 'worried' && <path d="M46 90 Q60 82 74 90" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />}
      {mood === 'down' && <ellipse cx="60" cy="88" rx="7" ry="5" fill="#fff" stroke={INK} strokeWidth="3" />}
    </svg>
  );
}
