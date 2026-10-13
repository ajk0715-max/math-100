'use client';

import { useState } from 'react';
import { BLOCKS, BLOCK_DAYS, firstDayOf, lastReadyDay, lessonFor } from '@/core/curriculum';
import type { Profile } from '@/core/model';
import { STATE_LABEL, blockState, canSkip, currentBlock, moveToBlock, type BlockState } from '@/core/progress';
import { useStore } from '../store';
import { Confirm, type Notify } from './shared';

const CHIP: Record<BlockState, string> = { gold: 'sun', passed: 'leaf', skipped: 'grape', current: '', upcoming: '', moved: 'warm', soon: '' };

const dateText = (ts: number): string => new Date(ts).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });

/** 진도: 단계별 지도, 되돌리기, 보스로 건너뛰기, 시작 진단 */
export function ProgressTab({ notify }: { notify: Notify }) {
  const { profile, today, update, go } = useStore();
  const p = profile as Profile;
  const [ask, setAsk] = useState<{ kind: 'move' | 'skip'; block: number } | null>(null);
  const [sel, setSel] = useState<number>(currentBlock(p));
  const [pick, setPick] = useState(p.day);
  const [askDay, setAskDay] = useState(false);

  const days = Array.from({ length: lastReadyDay() }, (_, i) => i + 1);
  const askDef = ask ? BLOCKS[ask.block - 1] : null;
  const diag = p.diagnostic;
  const started = p.doneDays.length > 0;

  const confirm = () => {
    if (!ask || !askDef) return;
    if (ask.kind === 'move') {
      update((x) => moveToBlock(x, ask.block, today));
      notify(`${ask.block}단계부터 다시 시작해요. 별과 스티커는 그대로예요.`);
      setAsk(null);
      return;
    }
    setAsk(null);
    go({ name: 'boss', block: ask.block, skip: true });
  };

  return (
    <>
      <section className="sheet col">
        <h2>진도 지도</h2>
        <p className="muted">
          지금은 Day {p.day} · 마친 날 {p.doneDays.length}일. 단계마다 5일씩이고, 5일째가 보스전이에요. 단계를 누르면 되돌리기·건너뛰기 단추가 나와요.
        </p>
        <ol className="pmap">
          {BLOCKS.map((b) => {
            const st = blockState(p, b.n);
            const first = firstDayOf(b.n);
            const sticker = p.stickers[b.n];
            return (
              <li key={b.n} className={`pblock ${st}${sel === b.n ? ' sel' : ''}`}>
                <button type="button" className="pb-head" aria-expanded={b.ready ? sel === b.n : undefined} disabled={!b.ready} onClick={() => setSel(sel === b.n ? 0 : b.n)}>
                  <span className="bnum">{b.n}</span>
                  <span className="lmain">
                    <b>{b.title}</b>
                    <small>
                      Day {first}~{first + BLOCK_DAYS - 1}
                    </small>
                  </span>
                  <span className={`chip ${CHIP[st]}`}>
                    {sticker && <span className="emo">{b.sticker.emoji}</span>}
                    {STATE_LABEL[st]}
                  </span>
                </button>
                {b.ready && sel === b.n && (
                  <div className="pb-act">
                    <button type="button" className="btn small ghost" onClick={() => setAsk({ kind: 'move', block: b.n })}>
                      {st === 'current' ? '이 단계 처음부터' : '여기부터 하기'}
                    </button>
                    {canSkip(p, b.n) && (
                      <button type="button" className="btn small grape" onClick={() => setAsk({ kind: 'skip', block: b.n })}>
                        보스로 건너뛰기
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        <p className="fine">되돌려도 이미 받은 별·스티커·기록은 그대로 남아요. 이미 마친 날을 다시 해도 별은 더 받지 않아요.</p>
      </section>

      <section className="sheet col">
        <h2>시작 진단</h2>
        {diag ? (
          <p>
            {dateText(diag.ts)}에 {diag.asked}문제 중 {diag.right}개를 바로 맞혔어요. 진단은 {diag.suggested}단계를 권했고, {diag.chosen}단계에서 시작했어요.
          </p>
        ) : (
          <p className="muted">12문제(약 10분)로 지금 실력에 맞는 시작 단계를 찾아요. 틀려도 별이나 기록에 불이익은 없어요.</p>
        )}
        <button
          type="button"
          className="btn warm"
          disabled={started}
          onClick={() => {
            go({ name: 'diagnostic' });
          }}
        >
          {diag ? '시작 진단 다시 하기' : '시작 진단 하기'}
        </button>
        {started && <p className="fine">수업을 시작한 뒤에는 위의 ‘보스로 건너뛰기’를 써요.</p>}
      </section>

      <details className="sheet pdetails">
        <summary>날짜를 직접 골라 옮기기</summary>
        <div className="col">
          <label className="field">
            <span>다음에 할 날</span>
            <select
              value={pick}
              onChange={(e) => {
                setPick(Number(e.target.value));
                setAskDay(false);
              }}
            >
              {days.map((d) => (
                <option key={d} value={d}>
                  {d === p.day ? '▶ ' : ''}Day {d} · {lessonFor(d)?.title ?? ''}
                </option>
              ))}
            </select>
          </label>
          {pick !== p.day &&
            (askDay ? (
              <div className="col">
                <p className="status warn">Day {pick}(으)로 옮기면 건너뛴 날은 ‘마친 날’로 표시되지 않아요. 옮길까요?</p>
                <div className="row two">
                  <button type="button" className="btn ghost" onClick={() => setAskDay(false)}>
                    취소
                  </button>
                  <button
                    type="button"
                    className="btn go"
                    onClick={() => {
                      update((x) => ({ ...x, day: pick, extraLessonDate: today }));
                      setAskDay(false);
                      notify(`Day ${pick}(으)로 옮겼어요.`);
                    }}
                  >
                    옮기기
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="btn ghost" onClick={() => setAskDay(true)}>
                이 날로 옮기기
              </button>
            ))}
        </div>
      </details>

      {ask && askDef && ask.kind === 'move' && (
        <Confirm title={`${ask.block}단계부터 할까요?`} ok="옮기기" onOk={confirm} onCancel={() => setAsk(null)}>
          <p>
            ‘{askDef.title}’({firstDayOf(ask.block)}일째)부터 다시 시작해요. 이미 받은 별·스티커·기록은 그대로 남아요.
          </p>
        </Confirm>
      )}
      {ask && askDef && ask.kind === 'skip' && (
        <Confirm title="보스로 건너뛸까요?" ok="아이에게 건네기" tone="grape" onOk={confirm} onCancel={() => setAsk(null)}>
          <p>
            아이가 ‘{askDef.title}’ 단계의 보스전을 먼저 풀어서 80% 이상 맞히면 이 단계를 건너뛰고 다음 단계로 가요.
          </p>
          <p className="muted">못 맞혀도 기록과 금빛 스티커 기회에는 영향이 없어요. 기기를 아이에게 건네 주세요.</p>
        </Confirm>
      )}
    </>
  );
}
