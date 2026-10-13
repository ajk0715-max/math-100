import type { CSSProperties } from 'react';
import type { Group, Visual } from '@/core/types';

type BarsV = Extract<Visual, { k: 'bars' }>;
type SeesawV = Extract<Visual, { k: 'seesaw' }>;
type CellsV = Extract<Visual, { k: 'cells' }>;
type RoutineV = Extract<Visual, { k: 'routine' }>;

const cssVars = (vars: Record<string, string | number>): CSSProperties => vars as CSSProperties;

/** 길이·높이 막대. h는 왼쪽 끝을 맞춘 가로 막대, v는 바닥을 맞춘 세로 막대 */
export function Bars({ v }: { v: BarsV }) {
  const max = v.unitMax ?? Math.max(1, ...v.items.map((i) => i.value));
  const solo = v.items.length === 1;
  return (
    <div className={`bars ${v.dir}${solo ? ' solo' : ''}${v.grid ? ' grid' : ''}${v.showValues ? ' vals' : ''}`} style={cssVars({ '--max': max, '--n': v.items.length })} role="img" aria-label="길이를 견주는 막대">
      {v.items.map((it, i) => (
        <div key={i} className={`bar tone-${it.tone}`} style={cssVars({ '--val': it.value })}>
          {!solo && <span className="blabel">{it.label}</span>}
          <span className="track">
            <i className="fill" />
            {v.showValues && <b className="val">{it.value}칸</b>}
          </span>
        </div>
      ))}
    </div>
  );
}

function Pile({ g, deg }: { g: Group; deg: number }) {
  return (
    <div className="pan" style={{ transform: `rotate(${-deg}deg)` }}>
      {g.unknown ? (
        <span className="unk">?</span>
      ) : (
        Array.from({ length: g.n }, (_, i) => (
          <span key={i} className="emo">
            {g.emoji}
          </span>
        ))
      )}
    </div>
  );
}

/** 시소. tilt가 left면 왼쪽이 아래로 내려간다 */
export function Seesaw({ v }: { v: SeesawV }) {
  const deg = v.tilt === 'left' ? -11 : v.tilt === 'right' ? 11 : 0;
  // 양쪽 그림 크기를 같게 둔다. 크기가 다르면 아이가 큰 쪽을 무겁다고 읽는다
  const m = Math.min(Math.max(v.left.n, v.right.n), 4);
  return (
    <div className={`seesaw m${m}`} role="img" aria-label={v.tilt === 'left' ? '왼쪽이 내려간 시소' : v.tilt === 'right' ? '오른쪽이 내려간 시소' : '평평한 시소'}>
      <div className="plank" style={{ transform: `rotate(${deg}deg)` }}>
        <div className="side l">
          <Pile g={v.left} deg={deg} />
        </div>
        <div className="side r">
          <Pile g={v.right} deg={deg} />
        </div>
      </div>
      <div className="pivot" />
    </div>
  );
}

/** 넓이를 견주는 칸 모양. fill이 있으면 위에서부터 그만큼만 색칠한다 */
export function Cells({ v }: { v: CellsV }) {
  const total = v.cols * v.rows;
  const fill = v.fill ?? total;
  return (
    <div className="sqbox">
      <div className={`sqcells tone-${v.tone}${v.numbered ? ' numbered' : ''}`} style={cssVars({ '--cols': v.cols, '--fit': v.fit ?? v.cols })} role="img" aria-label={`${fill}칸`}>
        {Array.from({ length: total }, (_, i) => (i < fill ? <i key={i} className="sq on">{v.numbered ? i + 1 : ''}</i> : <i key={i} className="sq off" />))}
      </div>
    </div>
  );
}

/** 하루 일과표 */
export function Routine({ v }: { v: RoutineV }) {
  return (
    <ul className="routine" aria-label="하루 일과">
      {v.items.map((it, i) => (
        <li key={i}>
          {it.time && <span className="rt">{it.time}</span>}
          <span className="emo re">{it.emoji}</span>
          <span className="rl">{it.label}</span>
        </li>
      ))}
    </ul>
  );
}
