import type { CSSProperties } from 'react';
import type { Tone, Visual } from '@/core/types';

type TensV = Extract<Visual, { k: 'tens' }>;
type ChartV = Extract<Visual, { k: 'chart' }>;

const TONE_FILL: Record<Tone, [string, string, string]> = {
  ink: ['#46557f', '#1d2742', '#e5e9f4'],
  sky: ['#4f9cf5', '#2d6dc2', '#dcecff'],
  tangerine: ['#ff8a3d', '#cf5f17', '#ffe6d2'],
  leaf: ['#34b77a', '#1d8654', '#d3f4e3'],
  grape: ['#8a6be8', '#5d41ba', '#e8e0ff'],
  rose: ['#ff6b8e', '#cf3d63', '#ffdfe7'],
  sun: ['#ffc83d', '#c99200', '#fff0bd'],
  tomato: ['#e8453c', '#a9261e', '#ffdbd7'],
};

// 막대 하나(10개 묶음)와 낱개의 모눈 크기
const CELL = 11;
const GAP = 2;
const PAD = 4;
const ROD_W = 2 * CELL + GAP + 2 * PAD;
const ROD_H = 5 * CELL + 4 * GAP + 2 * PAD;
const ROD_GAP = 6;
const ONES_COLS = 5;
const ONES_GAP = 14;

/** 십 모형: 10개 묶음 막대와 낱개 모형. 화면 너비에 맞춰 그림 전체가 줄어든다. */
export function Tens({ v }: { v: TensV }) {
  const tone = v.tone ?? 'sky';
  const [main, dark, light] = TONE_FILL[tone];
  const ones = Math.max(0, Math.min(9, v.ones));
  const tens = Math.max(0, Math.min(10, v.tens));
  const onesCols = ones === 0 ? 0 : Math.min(ONES_COLS, ones);
  const onesW = onesCols === 0 ? 0 : onesCols * CELL + (onesCols - 1) * GAP;
  const rodsW = tens === 0 ? 0 : tens * ROD_W + (tens - 1) * ROD_GAP;
  const W = rodsW + (rodsW > 0 && onesW > 0 ? ONES_GAP : 0) + onesW;
  const H = ROD_H;
  const onesX = rodsW + (rodsW > 0 ? ONES_GAP : 0);

  const rods = Array.from({ length: tens }, (_, i) => {
    const x = i * (ROD_W + ROD_GAP);
    return (
      <g key={`r${i}`} transform={`translate(${x} 0)`}>
        <rect x="1" y="1" width={ROD_W - 2} height={ROD_H - 2} rx="7" fill={light} stroke={dark} strokeWidth="2" />
        {Array.from({ length: 10 }, (_, k) => (
          <rect key={k} x={PAD + (k % 2) * (CELL + GAP)} y={PAD + Math.floor(k / 2) * (CELL + GAP)} width={CELL} height={CELL} rx="2.5" fill={main} />
        ))}
      </g>
    );
  });
  // 낱개는 막대와 같은 높이의 아래쪽에 맞춰 둔다
  const onesH = ones <= ONES_COLS ? CELL : 2 * CELL + GAP;
  const onesY = (H - onesH) / 2;
  const loose = Array.from({ length: ones }, (_, k) => (
    <rect key={`o${k}`} x={onesX + (k % ONES_COLS) * (CELL + GAP)} y={onesY + Math.floor(k / ONES_COLS) * (CELL + GAP)} width={CELL} height={CELL} rx="2.5" fill={main} stroke={dark} strokeWidth="1.2" />
  ));

  const label = `10개씩 묶음 ${tens}개와 낱개 ${ones}개`;
  const style: CSSProperties = { width: `min(100%, ${Math.round(W * 1.5)}px)` };
  return (
    <figure className="tens" role="img" aria-label={label}>
      <svg viewBox={`0 0 ${Math.max(W, 1)} ${H}`} style={style} preserveAspectRatio="xMidYMid meet">
        {rods}
        {loose}
      </svg>
      {v.caption && (
        <figcaption>
          묶음 <b>{tens}</b>개 · 낱개 <b>{ones}</b>개
        </figcaption>
      )}
    </figure>
  );
}

/** 수 배열표. blanks는 물음표 칸, marks는 색칠한 칸 */
export function Chart({ v }: { v: ChartV }) {
  const cols = v.cols ?? 10;
  const nums: number[] = [];
  for (let n = v.from; n <= v.to; n++) nums.push(n);
  const blanks = new Set(v.blanks ?? []);
  const marks = new Set(v.marks ?? []);
  return (
    <div className="chartbox">
      <div className={`chart tone-${v.tone ?? 'sky'}`} style={{ ['--cols' as string]: cols } as CSSProperties} role="img" aria-label={`${v.from}부터 ${v.to}까지의 수 배열표`}>
        {nums.map((n) => (
          <i key={n} className={`cc${blanks.has(n) ? ' q' : ''}${marks.has(n) ? ' mk' : ''}`}>
            {blanks.has(n) ? '?' : n}
          </i>
        ))}
      </div>
    </div>
  );
}
