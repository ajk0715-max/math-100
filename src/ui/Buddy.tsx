import type { CSSProperties, ReactNode } from 'react';
import type { Buddy as BuddyId } from '@/core/curriculum/types';

export type Mood = 'happy' | 'cheer' | 'think';

const INK = '#1d2742';

function Eyes({ mood, lx, rx, y, r = 4 }: { mood: Mood; lx: number; rx: number; y: number; r?: number }) {
  if (mood === 'cheer') {
    return (
      <g fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round">
        <path d={`M${lx - 5} ${y + 2} Q${lx} ${y - 6} ${lx + 5} ${y + 2}`} />
        <path d={`M${rx - 5} ${y + 2} Q${rx} ${y - 6} ${rx + 5} ${y + 2}`} />
      </g>
    );
  }
  const dx = mood === 'think' ? 1.6 : 0;
  const dy = mood === 'think' ? -1.8 : 0;
  return (
    <g>
      {[lx, rx].map((x) => (
        <g key={x}>
          <circle cx={x + dx} cy={y + dy} r={r} fill={INK} />
          <circle cx={x + dx + r * 0.35} cy={y + dy - r * 0.35} r={r * 0.32} fill="#fff" />
        </g>
      ))}
      {mood === 'think' && (
        <g stroke={INK} strokeWidth="2.6" strokeLinecap="round">
          <line x1={lx - 6} y1={y - 8} x2={lx + 5} y2={y - 11} />
          <line x1={rx - 5} y1={y - 11} x2={rx + 6} y2={y - 8} />
        </g>
      )}
    </g>
  );
}

function Mouth({ mood, cx, y }: { mood: Mood; cx: number; y: number }) {
  if (mood === 'cheer') {
    return (
      <g>
        <path d={`M${cx - 8} ${y - 2} Q${cx} ${y + 14} ${cx + 8} ${y - 2} Z`} fill="#7a1f2a" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
        <ellipse cx={cx} cy={y + 6} rx="4" ry="2.6" fill="#ff8fa3" />
      </g>
    );
  }
  if (mood === 'think') {
    return <ellipse cx={cx + 2} cy={y + 2} rx="3" ry="3.6" fill="none" stroke={INK} strokeWidth="2.6" />;
  }
  return <path d={`M${cx - 6} ${y} Q${cx} ${y + 8} ${cx + 6} ${y}`} fill="none" stroke={INK} strokeWidth="2.8" strokeLinecap="round" />;
}

function Sparkles() {
  const star = (x: number, y: number, s: number, k: number) => (
    <path
      key={k}
      className="spark"
      style={{ animationDelay: `${k * 0.15}s` }}
      d={`M${x} ${y - s} L${x + s * 0.28} ${y - s * 0.28} L${x + s} ${y} L${x + s * 0.28} ${y + s * 0.28} L${x} ${y + s} L${x - s * 0.28} ${y + s * 0.28} L${x - s} ${y} L${x - s * 0.28} ${y - s * 0.28} Z`}
      fill="#ffc83d"
      stroke={INK}
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  );
  return (
    <g>
      {star(14, 22, 8, 0)}
      {star(108, 18, 10, 1)}
      {star(104, 62, 6, 2)}
    </g>
  );
}

function Question() {
  return (
    <g>
      <circle cx="100" cy="20" r="13" fill="#fff" stroke={INK} strokeWidth="2.6" />
      <text x="100" y="21" textAnchor="middle" dominantBaseline="central" fontFamily="var(--font-display)" fontSize="19" fill="#ff8a3d">
        ?
      </text>
    </g>
  );
}

function Bear({ mood }: { mood: Mood }) {
  const fur = '#c98b52';
  const lite = '#f5dcb3';
  return (
    <>
      {/* 팔 */}
      {mood === 'cheer' ? (
        <g fill={fur} stroke={INK} strokeWidth="3">
          <ellipse cx="22" cy="74" rx="8" ry="13" transform="rotate(-25 22 74)" />
          <ellipse cx="98" cy="74" rx="8" ry="13" transform="rotate(25 98 74)" />
        </g>
      ) : (
        <g fill={fur} stroke={INK} strokeWidth="3">
          <ellipse cx="27" cy="98" rx="8" ry="13" transform="rotate(14 27 98)" />
          <ellipse cx="93" cy="98" rx="8" ry="13" transform="rotate(-14 93 98)" />
        </g>
      )}
      {/* 몸 */}
      <ellipse cx="60" cy="101" rx="30" ry="19" fill={fur} stroke={INK} strokeWidth="3" />
      <ellipse cx="60" cy="104" rx="18" ry="11" fill={lite} />
      <path d="M45 88 Q60 96 75 88 L72 98 Q60 104 48 98 Z" fill="#4f9cf5" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
      <text x="60" y="97" textAnchor="middle" fontFamily="var(--font-display)" fontSize="11" fill="#fff">
        1
      </text>
      {/* 귀 */}
      <circle cx="31" cy="27" r="13" fill={fur} stroke={INK} strokeWidth="3" />
      <circle cx="31" cy="27" r="6" fill="#f0b98a" />
      <circle cx="89" cy="27" r="13" fill={fur} stroke={INK} strokeWidth="3" />
      <circle cx="89" cy="27" r="6" fill="#f0b98a" />
      {/* 얼굴 */}
      <circle cx="60" cy="54" r="35" fill={fur} stroke={INK} strokeWidth="3" />
      <ellipse cx="60" cy="67" rx="18" ry="14" fill={lite} />
      <ellipse cx="60" cy="60" rx="6" ry="4.4" fill={INK} />
      <circle cx="41" cy="64" r="5" fill="#ff8fa3" opacity="0.55" />
      <circle cx="79" cy="64" r="5" fill="#ff8fa3" opacity="0.55" />
      <Eyes mood={mood} lx={46} rx={74} y={48} />
      <Mouth mood={mood} cx={60} y={69} />
    </>
  );
}

function Owl({ mood }: { mood: Mood }) {
  const body = '#8a6be8';
  return (
    <>
      {/* 날개 */}
      <ellipse cx="22" cy="74" rx="11" ry="24" fill="#6f52cf" stroke={INK} strokeWidth="3" transform={mood === 'cheer' ? 'rotate(24 22 74)' : 'rotate(8 22 74)'} />
      <ellipse cx="98" cy="74" rx="11" ry="24" fill="#6f52cf" stroke={INK} strokeWidth="3" transform={mood === 'cheer' ? 'rotate(-24 98 74)' : 'rotate(-8 98 74)'} />
      {/* 몸 */}
      <path d="M60 14 L44 24 Q22 34 24 68 Q26 108 60 108 Q94 108 96 68 Q98 34 76 24 Z" fill={body} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M44 24 L38 10 L54 18 Z M76 24 L82 10 L66 18 Z" fill={body} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      {/* 배: 작은 시계 */}
      <circle cx="60" cy="82" r="19" fill="#fff" stroke={INK} strokeWidth="3" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * 30 * Math.PI) / 180;
        return <line key={i} x1={60 + Math.sin(a) * 14.5} y1={82 - Math.cos(a) * 14.5} x2={60 + Math.sin(a) * 16.5} y2={82 - Math.cos(a) * 16.5} stroke={INK} strokeWidth={i % 3 === 0 ? 2 : 1} />;
      })}
      <line x1="60" y1="82" x2="60" y2="70" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
      <line x1="60" y1="82" x2="70" y2="82" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="60" cy="82" r="2" fill={INK} />
      {/* 눈 */}
      <circle cx="45" cy="48" r="14" fill="#fff" stroke={INK} strokeWidth="3" />
      <circle cx="75" cy="48" r="14" fill="#fff" stroke={INK} strokeWidth="3" />
      <Eyes mood={mood} lx={45} rx={75} y={48} r={6} />
      {/* 부리 */}
      <path d="M54 58 L66 58 L60 69 Z" fill="#ff8a3d" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
      {mood === 'cheer' && <path d="M53 58 L67 58 L60 72 Z" fill="#ff8a3d" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />}
      {/* 발 */}
      <g fill="#ff8a3d" stroke={INK} strokeWidth="2.4" strokeLinejoin="round">
        <path d="M44 106 l-5 8 h16 z" />
        <path d="M76 106 l5 8 h-16 z" />
      </g>
    </>
  );
}

function Mole({ mood }: { mood: Mood }) {
  const fur = '#8f7f9a';
  return (
    <>
      {/* 흙더미 */}
      <path d="M8 116 Q10 96 34 94 L86 94 Q110 96 112 116 Z" fill="#b88a5a" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <circle cx="22" cy="106" r="3" fill="#9a6f43" />
      <circle cx="100" cy="104" r="2.6" fill="#9a6f43" />
      <circle cx="90" cy="110" r="2.2" fill="#9a6f43" />
      {/* 귀 */}
      <circle cx="33" cy="32" r="8" fill={fur} stroke={INK} strokeWidth="3" />
      <circle cx="87" cy="32" r="8" fill={fur} stroke={INK} strokeWidth="3" />
      {/* 얼굴 */}
      <ellipse cx="60" cy="60" rx="33" ry="34" fill={fur} stroke={INK} strokeWidth="3" />
      <ellipse cx="60" cy="72" rx="15" ry="11" fill="#ff8fa3" stroke={INK} strokeWidth="2.6" />
      <ellipse cx="54" cy="70" rx="2.4" ry="3" fill={INK} opacity="0.55" />
      <ellipse cx="66" cy="70" rx="2.4" ry="3" fill={INK} opacity="0.55" />
      {/* 안경 */}
      <g fill="#fff" fillOpacity="0.55" stroke={INK} strokeWidth="2.6">
        <circle cx="45" cy="50" r="10" />
        <circle cx="75" cy="50" r="10" />
      </g>
      <line x1="55" y1="50" x2="65" y2="50" stroke={INK} strokeWidth="2.6" />
      <Eyes mood={mood} lx={45} rx={75} y={50} r={3.4} />
      <Mouth mood={mood} cx={60} y={84} />
      {/* 달력 쪽지 */}
      <g transform={mood === 'cheer' ? 'rotate(-8 60 100)' : ''}>
        <rect x="38" y="90" width="44" height="28" rx="5" fill="#fff" stroke={INK} strokeWidth="3" />
        <rect x="38" y="90" width="44" height="10" rx="5" fill="#e8453c" stroke={INK} strokeWidth="3" />
        <text x="60" y="113" textAnchor="middle" fontFamily="var(--font-display)" fontSize="14" fill={INK}>
          7
        </text>
      </g>
      {/* 손 */}
      <g fill={fur} stroke={INK} strokeWidth="2.8">
        <ellipse cx="36" cy="106" rx="7" ry="6" />
        <ellipse cx="84" cy="106" rx="7" ry="6" />
      </g>
    </>
  );
}

export interface BuddyProps {
  who: BuddyId;
  mood?: Mood;
  /** 가로 길이(rem) */
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export const BUDDY_NAME: Record<BuddyId, string> = { bear: '수 곰', owl: '시계 부엉이', mole: '달력 두더지' };

export function Buddy({ who, mood = 'happy', size = 5, className, style }: BuddyProps): ReactNode {
  return (
    <svg
      className={`buddy ${who} ${mood}${className ? ` ${className}` : ''}`}
      viewBox="0 0 120 120"
      role="img"
      aria-label={BUDDY_NAME[who]}
      style={{ width: `${size}rem`, height: `${size}rem`, ...style }}
    >
      {who === 'bear' && <Bear mood={mood} />}
      {who === 'owl' && <Owl mood={mood} />}
      {who === 'mole' && <Mole mood={mood} />}
      {mood === 'cheer' && <Sparkles />}
      {mood === 'think' && <Question />}
    </svg>
  );
}
