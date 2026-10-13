import type { CSSProperties } from 'react';
import type { ShapeKind, Tone, Visual } from '@/core/types';
import { ShapeArt } from './Shapes';

type TableV = Extract<Visual, { k: 'table' }>;
type BagV = Extract<Visual, { k: 'bag' }>;
type PatternV = Extract<Visual, { k: 'pattern' }>;
type PictoV = Extract<Visual, { k: 'pictograph' }>;
type TimetableV = Extract<Visual, { k: 'timetable' }>;
type QueueV = Extract<Visual, { k: 'queue' }>;

const cssVars = (vars: Record<string, string | number>): CSSProperties => vars as CSSProperties;

/** 간단한 표. 값이 null인 칸은 물음표 칸이다. */
export function DataTable({ v }: { v: TableV }) {
  return (
    <table className={`dtable tone-${v.tone ?? 'sky'}`} aria-label="표">
      <thead>
        <tr>
          {v.head.map((h, i) => (
            <th key={i}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {v.rows.map((row, r) => (
          <tr key={r}>
            {row.map((cell, c) => (
              <td key={c} className={cell === null ? 'q' : c === 0 ? 'lead' : 'num'}>
                {cell === null ? '?' : cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** 섞여 있는 그림 더미. 줄을 맞추지 않아 하나씩 짚어 가며 분류하게 한다. */
export function Bag({ v }: { v: BagV }) {
  return (
    <div className={`bag ${v.size ?? 'md'}`} role="img" aria-label="섞여 있는 그림들">
      {v.items.map((it, i) => (
        <span key={i} className="emo">
          {it}
        </span>
      ))}
    </div>
  );
}

const PATTERN_TONES = new Set<string>(['sky', 'tangerine', 'leaf', 'grape', 'rose', 'sun', 'tomato', 'ink']);

function PatternCell({ kind, value, n }: { kind: PatternV['kind']; value: string; n: number }) {
  if (kind === 'color') {
    const tone = (PATTERN_TONES.has(value) ? value : 'sky') as Tone;
    return <span className={`pc color tone-${tone}`} />;
  }
  if (kind === 'emoji') {
    return <span className="pc emoji emo">{value}</span>;
  }
  if (kind === 'shape') {
    const [shape, tone] = value.split(':');
    return (
      <span className="pc shape">
        <ShapeArt shape={(shape ?? 'circle') as ShapeKind} color={(tone ?? 'sky') as Tone} size={n <= 5 ? 56 : n <= 7 ? 46 : 38} />
      </span>
    );
  }
  return <span className="pc text">{value}</span>;
}

/** 규칙 찾기: 나열된 그림·색·수. blanks 자리는 물음표 칸 */
export function Pattern({ v }: { v: PatternV }) {
  const blanks = new Set(v.blanks ?? []);
  return (
    <div className="pattern" style={cssVars({ '--n': v.seq.length })} role="img" aria-label="규칙이 있는 나열">
      {v.seq.map((it, i) =>
        blanks.has(i) ? (
          <span key={i} className="pc blank">
            ?
          </span>
        ) : (
          <PatternCell key={i} kind={v.kind} value={it} n={v.seq.length} />
        ),
      )}
    </div>
  );
}

/** 그림그래프: 줄마다 이름과 그림 n개 */
export function Pictograph({ v }: { v: PictoV }) {
  return (
    <ul className="picto" aria-label="그림그래프">
      {v.rows.map((r, i) => (
        <li key={i}>
          <span className="pl">{r.label}</span>
          <span className="pe">
            {Array.from({ length: r.n }, (_, k) => (
              <span key={k} className="emo">
                {r.emoji}
              </span>
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** 학교 시간표 */
export function Timetable({ v }: { v: TimetableV }) {
  return (
    <div className="timetable" role="table" aria-label="시간표">
      {v.day && <div className="tt-day">{v.day}</div>}
      {v.periods.map((p, i) => (
        <div key={i} className="tt-row" role="row">
          <span className="tt-no">{p.label}</span>
          <span className="emo tt-em">{p.emoji}</span>
          <span className="tt-sub">{p.subject}</span>
        </div>
      ))}
    </div>
  );
}

/** 줄 서 있는 그림. mark 자리에는 화살표를 붙인다. */
export function Queue({ v }: { v: QueueV }) {
  return (
    <div className="queue" style={cssVars({ '--n': v.items.length })} role="img" aria-label="줄 서 있는 모습">
      <div className="qrow">
        {v.sides && <span className="qside">왼쪽</span>}
        <div className="qitems">
          {v.items.map((it, i) => (
            <span key={i} className={`qi${v.mark === i ? ' on' : ''}`}>
              <span className="emo">{it}</span>
              {v.mark === i && <i className="qarrow">▲</i>}
            </span>
          ))}
        </div>
        {v.sides && <span className="qside">오른쪽</span>}
      </div>
    </div>
  );
}
