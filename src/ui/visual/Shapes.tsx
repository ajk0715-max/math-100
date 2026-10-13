import type { ShapeKind, Solid, Tone } from '@/core/types';

const FILL: Record<Tone, [string, string]> = {
  ink: ['#46557f', '#1d2742'],
  sky: ['#4f9cf5', '#2d6dc2'],
  tangerine: ['#ff8a3d', '#cf5f17'],
  leaf: ['#34b77a', '#1d8654'],
  grape: ['#8a6be8', '#5d41ba'],
  rose: ['#ff6b8e', '#cf3d63'],
  sun: ['#ffc83d', '#c99200'],
  tomato: ['#e8453c', '#a9261e'],
};

function ShapeBody({ kind, fill }: { kind: ShapeKind; fill: string }) {
  switch (kind) {
    case 'circle':
      return <circle cx="50" cy="50" r="42" fill={fill} />;
    case 'oval':
      return <ellipse cx="50" cy="50" rx="44" ry="30" fill={fill} />;
    case 'square':
      return <rect x="10" y="10" width="80" height="80" rx="6" fill={fill} />;
    case 'rect':
      return <rect x="5" y="24" width="90" height="52" rx="6" fill={fill} />;
    case 'triangle':
      return <polygon points="50,8 94,86 6,86" fill={fill} strokeLinejoin="round" />;
    case 'star':
      return <polygon points="50,6 62,36 94,38 69,58 78,90 50,72 22,90 31,58 6,38 38,36" fill={fill} strokeLinejoin="round" />;
    case 'heart':
      return <path d="M50 88 C10 58 6 30 26 20 C38 14 48 22 50 32 C52 22 62 14 74 20 C94 30 90 58 50 88 Z" fill={fill} />;
  }
}

export function ShapeArt({ shape, color, rot = 0, size = 72, label }: { shape: ShapeKind; color: Tone; rot?: number; size?: number; label?: string }) {
  const [light, dark] = FILL[color];
  return (
    <div className="shape" style={{ ['--w' as string]: `${size / 16}rem` }}>
      <svg viewBox="0 0 100 100" role="img" aria-label={label ?? '모양'}>
        <g transform={`rotate(${rot} 50 50)`}>
          <g transform="translate(0 5)">
            <ShapeBody kind={shape} fill={dark} />
          </g>
          <ShapeBody kind={shape} fill={light} />
        </g>
      </svg>
      {label && <div className="lbl">{label}</div>}
    </div>
  );
}

export function SolidArt({ solid, size = 72 }: { solid: Solid; size?: number }) {
  return (
    <div className="solid" style={{ ['--w' as string]: `${size / 16}rem` }}>
      <svg viewBox="0 0 100 100" role="img" aria-label="입체 모양">
        {solid === 'box' && (
          <g strokeLinejoin="round" stroke="#a9561a" strokeWidth="2">
            <polygon points="50,12 88,32 50,52 12,32" fill="#ffb27a" />
            <polygon points="12,32 50,52 50,92 12,72" fill="#ff8a3d" />
            <polygon points="50,52 88,32 88,72 50,92" fill="#d9691f" />
          </g>
        )}
        {solid === 'cylinder' && (
          <g stroke="#4a319c" strokeWidth="2" strokeLinejoin="round">
            <path d="M16 26 L16 76 A34 13 0 0 0 84 76 L84 26 Z" fill="#8a6be8" />
            <path d="M50 26 L84 26 L84 76 A34 13 0 0 1 50 89 Z" fill="#6f4fd0" stroke="none" opacity="0.55" />
            <ellipse cx="50" cy="26" rx="34" ry="13" fill="#b9a4f6" />
          </g>
        )}
        {solid === 'ball' && (
          <g>
            <defs>
              <radialGradient id="ballg" cx="35%" cy="32%" r="75%">
                <stop offset="0" stopColor="#bfe0ff" />
                <stop offset="0.55" stopColor="#4f9cf5" />
                <stop offset="1" stopColor="#2d6dc2" />
              </radialGradient>
            </defs>
            <circle cx="50" cy="50" r="40" fill="url(#ballg)" stroke="#2d6dc2" strokeWidth="2" />
            <ellipse cx="36" cy="32" rx="9" ry="6" fill="#fff" opacity="0.65" transform="rotate(-30 36 32)" />
          </g>
        )}
      </svg>
    </div>
  );
}
