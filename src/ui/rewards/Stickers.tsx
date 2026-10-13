'use client';

import { useState } from 'react';
import { say } from '@/audio/speech';
import { sfx } from '@/audio/sfx';
import { BLOCKS } from '@/core/curriculum';
import type { Profile } from '@/core/model';
import { josa } from '@/core/ko';
import { useStore } from '../store';
import { RHead } from './RHead';

const tilt = (n: number): number => ((n * 53) % 9) - 4;

/** 스티커 도감: 5일 블록마다 한 장, 보스를 첫 도전에 80% 이상 맞히면 금테 */
export function Stickers() {
  const { profile } = useStore();
  const p = profile as Profile;
  const [sel, setSel] = useState<number | null>(null);
  const got = BLOCKS.filter((b) => p.stickers[b.n]).length;
  const golds = BLOCKS.filter((b) => p.stickers[b.n] === 'gold').length;

  const pick = (n: number) => {
    const b = BLOCKS[n - 1];
    if (!b) return;
    setSel(n);
    sfx.tap();
    const st = p.stickers[n];
    void say(st ? `${b.sticker.name} 스티커예요. ${b.title}${josa(b.title, '을/를')} 해냈어요.` : b.ready ? `${n}단계 보스를 이기면 ${b.sticker.name} 스티커를 받아요.` : '아직 준비 중이에요.');
  };

  const selDef = sel ? BLOCKS[sel - 1] : null;
  const selSt = sel ? p.stickers[sel] : undefined;
  const selRes = sel ? p.blocks[sel] : undefined;

  return (
    <main className="app stickers">
      <div className="page">
        <RHead title="스티커 도감" />
        <p className="muted">
          모은 스티커 <b>{got}</b>/{BLOCKS.length}
          {golds > 0 && <> · 금테 {golds}장 ✨</>}
        </p>

        <section className="sheet album" aria-label="스티커 도감">
          <div className="grid">
            {BLOCKS.map((b, i) => {
              const st = p.stickers[b.n];
              const skipped = !!p.blocks[b.n]?.skipped;
              return (
                <button
                  key={b.n}
                  type="button"
                  className={`pocket${st ? ` got ${st}` : ''}${skipped ? ' skipped' : ''}`}
                  style={{ ['--r' as string]: `${tilt(b.n)}deg`, ['--i' as string]: i }}
                  onClick={() => pick(b.n)}
                  aria-label={st ? `${b.n}단계 ${b.sticker.name} 스티커${st === 'gold' ? ', 금테' : ''}` : `${b.n}단계 스티커 자리`}
                >
                  <span className="face">
                    {st ? <span className="emo">{b.sticker.emoji}</span> : b.ready ? <span className="emo shade">{b.sticker.emoji}</span> : <span className="lock">🔒</span>}
                  </span>
                  <span className="nm">{st ? b.sticker.name : '?'}</span>
                  <span className="bn">{b.n}단계</span>
                </button>
              );
            })}
          </div>
          <p className="legend">
            <span>흰 테두리: 보스 통과</span>
            <span>금테 ✨: 첫 도전에 80% 이상</span>
          </p>
        </section>

        {selDef && (
          <section className="sheet col center" aria-live="polite">
            <span className="emo" style={{ fontSize: '3.6rem', lineHeight: 1.1 }}>
              {selSt ? selDef.sticker.emoji : selDef.ready ? '❔' : '🔒'}
            </span>
            <h2>{selSt ? `${selDef.sticker.name} 스티커` : selDef.ready ? '아직 못 받았어요' : '준비 중이에요'}</h2>
            <p className="muted">
              {sel}단계 · {selDef.title}
              <br />
              {selSt === 'gold'
                ? '첫 도전에 80% 이상 맞혀서 금테를 받았어요!'
                : selSt
                  ? selRes?.skipped
                    ? '이미 알고 있어서 건너뛴 단계예요.'
                    : '보스를 이겨서 받았어요.'
                  : selDef.ready
                    ? `${sel}단계 보스를 이기면 받아요.`
                    : '곧 열려요.'}
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
