'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { say } from '@/audio/speech';
import { sfx } from '@/audio/sfx';
import { nativeNum } from '@/core/ko';
import { hashSeed, makeRng } from '@/core/rng';

export interface ObjectsProps {
  emoji: string;
  n: number;
  layout?: 'row' | 'scatter' | 'frame10' | 'frame20';
  crossed?: number;
  numbered?: boolean;
  countable?: boolean;
  size?: 'sm' | 'md' | 'lg';
  cols?: number;
}

function Item({ emoji, num, crossed, ghost }: { emoji: string; num?: number; crossed?: boolean; ghost?: boolean }) {
  return (
    <span className={`obj${crossed ? ' crossed' : ''}${ghost ? ' ghost' : ''}`}>
      {!ghost && <span className="emo">{emoji}</span>}
      {num !== undefined && <i className="num">{num}</i>}
    </span>
  );
}

function Frame({ emoji, count, offset, numbered, crossed }: { emoji: string; count: number; offset: number; numbered: boolean; crossed: number }) {
  return (
    <div className="frame">
      {Array.from({ length: 10 }, (_, i) => {
        const idx = offset + i;
        const filled = i < count;
        return (
          <div className="cell" key={i}>
            {filled && (
              <span className={`obj${idx < crossed ? ' crossed' : ''}`} style={{ width: '100%', height: '100%' }}>
                <span className="emo">{emoji}</span>
                {numbered && <i className="num">{idx + 1}</i>}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function Objects({ emoji, n, layout = 'row', crossed = 0, numbered = false, countable = false, size = 'md', cols }: ObjectsProps) {
  const [marked, setMarked] = useState<number[]>([]);

  const scatterCells = useMemo(() => {
    if (layout !== 'scatter') return null;
    const c = n <= 4 ? 3 : n <= 9 ? 4 : n <= 14 ? 5 : 6;
    const rows = Math.max(2, Math.ceil((n * 1.3) / c));
    const total = c * rows;
    const rng = makeRng(hashSeed(emoji, n, 'scatter'));
    const order = Array.from({ length: total }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j] as number, order[i] as number];
    }
    const chosen = new Set(order.slice(0, n));
    let k = 0;
    const cells = Array.from({ length: total }, (_, i) =>
      chosen.has(i)
        ? { item: k++, dx: (rng() - 0.5) * 22, dy: (rng() - 0.5) * 22, rot: (rng() - 0.5) * 40 }
        : null,
    );
    return { c, cells };
  }, [layout, n, emoji]);

  const tap = (i: number) => {
    if (marked.includes(i)) return;
    const next = [...marked, i];
    setMarked(next);
    sfx.tap();
    void say(nativeNum(next.length));
  };

  const cls = `objs ${size}`;
  const renderItem = (i: number) => {
    const isMarked = marked.indexOf(i);
    const num = isMarked >= 0 ? isMarked + 1 : numbered ? i + 1 : undefined;
    if (countable) {
      return (
        <button key={i} type="button" className={`obj${isMarked >= 0 ? ' marked' : ''}${i < crossed ? ' crossed' : ''}`} onClick={() => tap(i)} aria-label={`${i + 1}번째`}>
          <span className="emo">{emoji}</span>
          {num !== undefined && <i className="num">{num}</i>}
        </button>
      );
    }
    return <Item key={i} emoji={emoji} num={num} crossed={i < crossed} />;
  };

  if (layout === 'frame10' || layout === 'frame20') {
    const frames = layout === 'frame20' ? 2 : 1;
    return (
      <div className={`frames ${cls}`}>
        {Array.from({ length: frames }, (_, f) => (
          <Frame key={f} emoji={emoji} count={Math.max(0, Math.min(10, n - f * 10))} offset={f * 10} numbered={numbered} crossed={crossed} />
        ))}
      </div>
    );
  }

  if (layout === 'scatter' && scatterCells) {
    return (
      <div className={`scatter ${cls}`} style={{ gridTemplateColumns: `repeat(${scatterCells.c}, 1fr)`, ['--c' as string]: scatterCells.c }}>
        {scatterCells.cells.map((cell, i) => (
          <div className="slot" key={i}>
            {cell && (
              <div style={{ transform: `translate(${cell.dx}%, ${cell.dy}%) rotate(${cell.rot}deg)` }}>{renderItem(cell.item)}</div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // 한 줄에 놓을 개수가 정해져 있으면 상자 너비에 맞춰 물건 크기를 정한다(CSS .objs.grid)
  return (
    <div className={cols ? `${cls} grid` : cls} style={cols ? ({ ['--cols' as string]: cols } as CSSProperties) : undefined}>
      {Array.from({ length: n }, (_, i) => renderItem(i))}
    </div>
  );
}
