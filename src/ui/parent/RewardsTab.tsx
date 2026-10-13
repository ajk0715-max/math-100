'use client';

import { useState } from 'react';
import { sfx } from '@/audio/sfx';
import type { Profile, WishRequest } from '@/core/model';
import { MAX_COST, MAX_REWARDS, REWARD_EMOJIS, REWARD_SUGGESTIONS, decideWish, normalizeReward, pendingWishes, type RewardDef } from '@/core/wishes';
import { STARS_BOSS, STARS_LESSON } from '@/core/session';
import { useStore } from '../store';
import { Confirm, rid, type Notify } from './shared';

interface Draft {
  id: string | null;
  title: string;
  emoji: string;
  cost: string;
}

const EMPTY: Draft = { id: null, title: '', emoji: REWARD_EMOJIS[0] as string, cost: '30' };

const dateText = (ts: number): string => new Date(ts).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
const days = (cost: number): string => `수업 ${Math.max(1, Math.round(cost / STARS_LESSON))}일치`;

/** 보상: 아이의 소원 요청을 허락·거절하고, 줄 선물 목록을 관리한다 */
export function RewardsTab({ notify }: { notify: Notify }) {
  const { profile, rewards, setRewards, update } = useStore();
  const p = profile as Profile;
  const pend = pendingWishes(p);
  const past = p.wishes.filter((w) => w.status !== 'pending').slice(-8).reverse();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [del, setDel] = useState<RewardDef | null>(null);

  const decide = (w: WishRequest, ok: boolean) => {
    sfx.tap();
    update((x) => decideWish(x, w.id, ok, Date.now()));
    notify(ok ? `‘${w.title}’을(를) 허락했어요. 아이와 약속한 대로 직접 챙겨 주세요.` : `별 ${w.cost}개를 아이에게 돌려줬어요.`);
  };

  const save = async () => {
    if (!draft) return;
    const id = draft.id ?? rid();
    const def = normalizeReward({ title: draft.title, emoji: draft.emoji, cost: Number(draft.cost) }, id);
    if (!def) {
      setErr(`선물 이름을 적고, 별 개수는 1~${MAX_COST} 사이로 정해 주세요.`);
      return;
    }
    if (!draft.id && rewards.length >= MAX_REWARDS) {
      setErr(`선물은 ${MAX_REWARDS}개까지 둘 수 있어요.`);
      return;
    }
    // 아이 화면에 같은 이름이 둘 보이면 헷갈린다
    if (rewards.some((r) => r.id !== id && r.title === def.title)) {
      setErr('같은 이름의 선물이 이미 있어요. 다른 이름으로 적어 주세요.');
      return;
    }
    await setRewards(draft.id ? rewards.map((r) => (r.id === draft.id ? def : r)) : [...rewards, def]);
    notify(draft.id ? '선물을 고쳤어요.' : '선물을 추가했어요.');
    setDraft(null);
    setErr(null);
  };

  const fillSuggestions = async () => {
    await setRewards(REWARD_SUGGESTIONS.map((r) => ({ ...r, id: rid() })));
    notify('추천 선물 5개를 넣었어요. 집 사정에 맞게 고쳐 쓰세요.');
  };

  const step = (n: number) => setDraft((d) => (d ? { ...d, cost: String(Math.min(MAX_COST, Math.max(1, (Number(d.cost) || 0) + n))) } : d));

  return (
    <>
      <section className="sheet col">
        <h2>
          소원 요청
          {pend.length > 0 && <span className="chip tomato inl">{pend.length}</span>}
        </h2>
        {pend.length === 0 ? (
          <p className="muted">기다리는 요청이 없어요. 아이가 별로 선물을 부탁하면 여기에 나타나요.</p>
        ) : (
          <ul className="lrows">
            {pend.map((w) => (
              <li key={w.id} className="lrow wrap pending">
                <span className="emo" aria-hidden="true">
                  {w.emoji}
                </span>
                <div className="lmain">
                  <b>{w.title}</b>
                  <small>
                    별 {w.cost}개 · {dateText(w.ts)}
                  </small>
                </div>
                <div className="lact">
                  <button type="button" className="btn small ghost" onClick={() => decide(w, false)}>
                    거절
                  </button>
                  <button type="button" className="btn small go" onClick={() => decide(w, true)}>
                    허락
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="fine">허락하면 별은 그대로 쓴 것이 되고, 거절하면 별을 돌려줘요. 선물은 앱 밖에서 직접 챙겨 주세요.</p>
        {past.length > 0 && (
          <>
            <h3 className="subtitle">지난 요청</h3>
            <ul className="lrows">
              {past.map((w) => (
                <li key={w.id} className="lrow">
                  <span className="emo" aria-hidden="true">
                    {w.emoji}
                  </span>
                  <div className="lmain">
                    <b>{w.title}</b>
                    <small>
                      별 {w.cost}개 · {dateText(w.decidedAt ?? w.ts)}
                    </small>
                  </div>
                  <span className={`chip ${w.status === 'approved' ? 'leaf' : ''}`}>{w.status === 'approved' ? '허락' : '거절'}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="sheet col">
        <h2>줄 수 있는 선물</h2>
        <p className="muted">
          아이는 수업 하루에 별 {STARS_LESSON}개, 보스전에 {STARS_BOSS}개를 받아요. 선물 값은 며칠치 별인지 생각해 정해 주세요. 마을 꾸미기에도 같은 별을 써요.
        </p>
        {rewards.length === 0 && !draft ? (
          <div className="col">
            <p>아직 선물이 없어요.</p>
            <button type="button" className="btn warm" onClick={() => void fillSuggestions()}>
              추천 선물 넣기
            </button>
          </div>
        ) : (
          <ul className="lrows">
            {rewards.map((r) => (
              <li key={r.id} className="lrow wrap">
                <span className="emo" aria-hidden="true">
                  {r.emoji}
                </span>
                <div className="lmain">
                  <b>{r.title}</b>
                  <small>
                    별 {r.cost}개 · {days(r.cost)}
                  </small>
                </div>
                <div className="lact">
                  <button type="button" className="btn small ghost" onClick={() => setDraft({ id: r.id, title: r.title, emoji: r.emoji, cost: String(r.cost) })}>
                    고치기
                  </button>
                  <button type="button" className="btn small ghost" onClick={() => setDel(r)} aria-label={`${r.title} 지우기`}>
                    지우기
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {!draft && rewards.length < MAX_REWARDS && (
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setDraft(EMPTY);
              setErr(null);
            }}
          >
            선물 추가하기
          </button>
        )}

        {draft && (
          <div className="col editor">
            <h3 className="subtitle">{draft.id ? '선물 고치기' : '새 선물'}</h3>
            <label className="field">
              <span>선물 이름</span>
              <input value={draft.title} maxLength={24} placeholder="예: 아이스크림 먹기" onChange={(e) => setDraft({ ...draft, title: e.target.value })} autoComplete="off" />
            </label>
            <div className="field">
              <span>그림</span>
              <div className="emojis" role="radiogroup" aria-label="선물 그림">
                {REWARD_EMOJIS.map((e) => (
                  <button key={e} type="button" role="radio" aria-checked={draft.emoji === e} className={`emoji${draft.emoji === e ? ' on' : ''}`} onClick={() => setDraft({ ...draft, emoji: e })}>
                    <span className="emo">{e}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <span>필요한 별</span>
              <div className="stepper">
                <button type="button" className="btn small ghost" onClick={() => step(-5)} aria-label="5개 줄이기">
                  −5
                </button>
                <input inputMode="numeric" value={draft.cost} onChange={(e) => setDraft({ ...draft, cost: e.target.value.replace(/\D/g, '').slice(0, 3) })} aria-label="필요한 별 개수" />
                <button type="button" className="btn small ghost" onClick={() => step(5)} aria-label="5개 늘리기">
                  +5
                </button>
              </div>
              <small>{Number(draft.cost) > 0 ? days(Number(draft.cost)) : ''}</small>
            </div>
            {err && <p className="status warn">{err}</p>}
            <div className="row two">
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setDraft(null);
                  setErr(null);
                }}
              >
                취소
              </button>
              <button type="button" className="btn go" onClick={() => void save()}>
                저장
              </button>
            </div>
          </div>
        )}
      </section>

      {del && (
        <Confirm
          title="선물을 지울까요?"
          ok="지우기"
          tone="rose"
          onOk={() => {
            void setRewards(rewards.filter((r) => r.id !== del.id));
            setDel(null);
            notify('선물을 지웠어요. 이미 한 요청은 그대로 남아요.');
          }}
          onCancel={() => setDel(null)}
        >
          <p>
            {del.emoji} {del.title}
          </p>
        </Confirm>
      )}
    </>
  );
}
