'use client';

import type { CSSProperties, ReactNode } from 'react';
import { WEEKDAYS_LONG, WEEKDAYS_SHORT } from '@/core/dates';
import { digitalText } from '@/core/ko';
import type { Tone, Visual } from '@/core/types';
import { Calendar } from './Calendar';
import { ClockFace } from './ClockFace';
import { Bag, DataTable, Pattern, Pictograph, Queue, Timetable } from './Data';
import { Bars, Cells, Routine, Seesaw } from './Measure';
import { CoinsView, PriceTag } from './Money';
import { Chart, Tens } from './Numbers';
import { Objects } from './Objects';
import { ShapeArt, SolidArt } from './Shapes';

const isEmoji = (t: string): boolean => /\p{Extended_Pictographic}/u.test(t);

function Big({ text, tone = 'sky', sub }: { text: string; tone?: Tone; sub?: string }) {
  const emoji = isEmoji(text);
  return (
    <div className={`big ${emoji ? 'emoji' : `tone-${tone}`}`}>
      <div className={`face${emoji ? ' emo' : ''}`}>{text}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

function Bond({ total, a, b }: { total: number | null; a: number | null; b: number | null }) {
  const node = (v: number | null, cls: string) => <div className={`node ${cls}${v === null ? ' q' : ''}`}>{v === null ? '?' : v}</div>;
  return (
    <div className="bond" role="img" aria-label="가르기 그림">
      <svg viewBox="0 0 192 147" preserveAspectRatio="none">
        <line x1="96" y1="45" x2="40" y2="102" stroke="#1d2742" strokeWidth="3" strokeLinecap="round" />
        <line x1="96" y1="45" x2="152" y2="102" stroke="#1d2742" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {node(total, 'top')}
      {node(a, 'a')}
      {node(b, 'b')}
    </div>
  );
}

function Stones({ seq }: { seq: (number | null)[] }) {
  return (
    <div className="stones" role="img" aria-label="징검다리">
      {seq.map((v, i) => (
        <div key={i} className={`stone${v === null ? ' empty' : ''}`}>
          {v === null ? '?' : v}
        </div>
      ))}
    </div>
  );
}

function Weekdays({ hide = [], highlight, names = 'short' }: { hide?: number[]; highlight?: number; names?: 'short' | 'long' }) {
  return (
    <div className={`wk${names === 'long' ? ' long' : ''}`}>
      {WEEKDAYS_SHORT.map((w, i) => (
        <div key={w} className={`c${i === 0 ? ' sun' : i === 6 ? ' sat' : ''}${highlight === i ? ' hl' : ''}${hide.includes(i) ? ' hide' : ''}`}>
          {hide.includes(i) ? '?' : names === 'long' ? WEEKDAYS_LONG[i] : w}
        </div>
      ))}
    </div>
  );
}

function Months({ hide = [], highlight }: { hide?: number[]; highlight?: number }) {
  return (
    <div className="mo">
      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
        <div key={m} className={`c${highlight === m ? ' hl' : ''}${hide.includes(m) ? ' hide' : ''}`}>
          {hide.includes(m) ? '?' : `${m}월`}
        </div>
      ))}
    </div>
  );
}

function Digital({ h, m }: { h: number; m: number }) {
  const [hh, mm] = digitalText(h, m).split(':');
  return (
    <div className="digital-box">
      <div className="digital" role="img" aria-label="디지털 시계">
        <span>{hh}</span>
        <span className="colon">:</span>
        <span>{mm}</span>
      </div>
    </div>
  );
}

function Groups({ v }: { v: Extract<Visual, { k: 'groups' }> }) {
  const op = v.op === '+' ? '+' : v.op === '-' ? '−' : 'vs';
  const group = (g: typeof v.a, crossed?: boolean) =>
    g.unknown ? (
      <div className="unk">?</div>
    ) : (
      <div className="box">
        <Objects emoji={g.emoji} n={g.n} layout="row" size="sm" crossed={crossed ? g.n : 0} />
      </div>
    );
  return (
    <div className="groups">
      {group(v.a)}
      <div className="op">{op}</div>
      {group(v.b, v.crossed)}
    </div>
  );
}

export function Scene({ v }: { v: Visual }): ReactNode {
  switch (v.k) {
    case 'objects':
      return <Objects emoji={v.emoji} n={v.n} layout={v.layout} crossed={v.crossed} numbered={v.numbered} countable={v.countable} size={v.size} cols={v.cols} />;
    case 'groups':
      return <Groups v={v} />;
    case 'big':
      return <Big text={v.text} tone={v.tone} sub={v.sub} />;
    case 'bond':
      return <Bond total={v.total} a={v.a} b={v.b} />;
    case 'stones':
      return <Stones seq={v.seq} />;
    case 'clock':
      return <ClockFace h={v.h} m={v.m} hands={v.hands} numbers={v.numbers} mark={v.mark} size={v.size} />;
    case 'digital':
      return <Digital h={v.h} m={v.m} />;
    case 'calendar':
      return <Calendar year={v.year} month={v.month} marks={v.marks} compact={v.compact} highlightWeekday={v.highlightWeekday} />;
    case 'weekdays':
      return <Weekdays hide={v.hide} highlight={v.highlight} names={v.names} />;
    case 'months':
      return <Months hide={v.hide} highlight={v.highlight} />;
    case 'shape':
      return <ShapeArt shape={v.shape} color={v.color} rot={v.rot} size={v.size} label={v.label} />;
    case 'solid':
      return <SolidArt solid={v.solid} size={v.size} />;
    case 'eq':
      return (
        <div className={`eq tone-${v.tone ?? 'sky'}`}>
          {v.parts.map((p, i) => (
            <span key={i} className={/^[+−\-=×÷]$/.test(p) ? 'op' : p === '?' ? 't q' : 't'}>
              {p}
            </span>
          ))}
        </div>
      );
    case 'bars':
      return <Bars v={v} />;
    case 'seesaw':
      return <Seesaw v={v} />;
    case 'cells':
      return <Cells v={v} />;
    case 'routine':
      return <Routine v={v} />;
    case 'tens':
      return <Tens v={v} />;
    case 'chart':
      return <Chart v={v} />;
    case 'table':
      return <DataTable v={v} />;
    case 'bag':
      return <Bag v={v} />;
    case 'pattern':
      return <Pattern v={v} />;
    case 'pictograph':
      return <Pictograph v={v} />;
    case 'timetable':
      return <Timetable v={v} />;
    case 'queue':
      return <Queue v={v} />;
    case 'coins':
      return <CoinsView v={v} />;
    case 'price':
      return <PriceTag v={v} />;
    case 'story':
      return (
        <div className="story">
          {v.emoji && <span className="emo">{v.emoji}</span>}
          <span>{v.text}</span>
        </div>
      );
    case 'row':
      return (
        <div className={`viz-row${v.items.length >= 3 ? ' many' : ''}`} style={{ gap: v.gap ?? 12, flexWrap: v.wrap ? 'wrap' : 'nowrap', ['--n' as string]: v.items.length } as CSSProperties}>
          {v.items.map((it, i) => (
            <Scene key={i} v={it} />
          ))}
        </div>
      );
    case 'col':
      return (
        <div className="viz-col" style={{ gap: v.gap ?? 12 }}>
          {v.items.map((it, i) => (
            <Scene key={i} v={it} />
          ))}
        </div>
      );
    default:
      return <div className="viz-missing">그림을 준비하고 있어요</div>;
  }
}
