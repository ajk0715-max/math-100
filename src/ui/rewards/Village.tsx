'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { say } from '@/audio/speech';
import { buzz, sfx } from '@/audio/sfx';
import { josa } from '@/core/ko';
import type { Profile, WishRequest } from '@/core/model';
import { CAT_LABEL, CAT_ORDER, STAGE_NAME, VILLAGE_ITEMS, buyItem, canBuy, emptySlots, farthestDay, layout, villageStage, type VillageCat, type VillageItem } from '@/core/village';
import { cancelWish, pendingWishes, requestWish, type RewardDef } from '@/core/wishes';
import { useStore } from '../store';
import { RHead } from './RHead';

const rid = (): string => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);

const CLOUDS: { x: number; y: number }[] = [
  { x: 44, y: 5 },
  { x: 14, y: 15 },
];

const dateText = (ts: number): string => new Date(ts).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });

/** 마을 장면: 산 것은 정해진 자리에 놓이고, 고른 종류의 빈자리는 점선 터로 보인다 */
function Scene({ p, cat, fresh }: { p: Profile; cat: VillageCat; fresh: string | null }) {
  const stage = villageStage(farthestDay(p));
  const placed = useMemo(() => layout(p.village), [p.village]);
  const holes = useMemo(() => emptySlots(p.village).filter((e) => e.cat === cat), [p.village, cat]);
  return (
    <div className={`vscene s${stage}`} role="img" aria-label={`내 마을, ${STAGE_NAME[stage]}. 마을에 ${p.village.length}개가 있어요.`}>
      <span className="sun emo" aria-hidden="true">
        ☀️
      </span>
      {stage === 4 && (
        <span className="cloud emo" style={{ left: '66%', top: '17%' }} aria-hidden="true">
          🌈
        </span>
      )}
      {CLOUDS.slice(0, stage >= 3 ? 2 : 1).map((c, i) => (
        <span key={i} className="cloud emo" style={{ left: `${c.x}%`, top: `${c.y}%` }} aria-hidden="true">
          ☁️
        </span>
      ))}
      {holes.map((h, i) => (
        <span key={`${h.cat}${i}`} className="vslot" style={{ ['--x' as string]: h.slot.x, ['--y' as string]: h.slot.y, ['--s' as string]: h.slot.s }} aria-hidden="true" />
      ))}
      {placed.map(({ item, slot, order }) => (
        <span
          key={item.id}
          className={`vitem emo${item.id === fresh ? ' fresh' : ''}`}
          style={{ ['--x' as string]: slot.x, ['--y' as string]: slot.y, ['--s' as string]: slot.s, ['--o' as string]: order }}
          aria-hidden="true"
        >
          {item.emoji}
        </span>
      ))}
      <span className="vcap">
        {STAGE_NAME[stage]} · {p.village.length}개
      </span>
    </div>
  );
}

function goodNote(p: Profile, item: VillageItem): { cls: string; text: string } {
  const c = canBuy(p, item);
  if (c.ok) return { cls: ' can', text: '살 수 있어요' };
  if (c.reason === 'owned') return { cls: ' have', text: '마을에 있어요' };
  if (c.reason === 'locked') return { cls: ' off', text: `Day ${c.from}부터` };
  return { cls: '', text: `별 ${c.need}개 더` };
}

function Town({ p }: { p: Profile }) {
  const { update } = useStore();
  const [cat, setCat] = useState<VillageCat>('house');
  const [buying, setBuying] = useState<VillageItem | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const sceneRef = useRef<HTMLDivElement | null>(null);

  const pick = (item: VillageItem) => {
    const c = canBuy(p, item);
    if (c.ok) {
      sfx.tap();
      setBuying(item);
      return;
    }
    sfx.wrong();
    if (c.reason === 'owned') void say(`${item.name}${josa(item.name, '은/는')} 이미 마을에 있어요.`);
    else if (c.reason === 'locked') void say(`${c.from}일째 수업을 하면 열려요.`);
    else void say(`별이 ${c.need}개 더 필요해요.`);
  };

  const confirm = () => {
    if (!buying) return;
    const item = buying;
    let ok = false;
    update((cur) => {
      const next = buyItem(cur, item.id);
      ok = next !== null;
      return next ?? cur;
    });
    setBuying(null);
    if (!ok) return;
    setFresh(item.id);
    setCat(item.cat);
    sfx.star();
    buzz(25);
    void say(`${item.name}${josa(item.name, '이/가')} 마을에 생겼어요!`);
    sceneRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  const items = VILLAGE_ITEMS.filter((i) => i.cat === cat);
  const left = buying ? p.stars - buying.cost : 0;

  return (
    <>
      <div ref={sceneRef}>
        <Scene p={p} cat={cat} fresh={fresh} />
      </div>

      <section className="shop" aria-label="마을 가게">
        <div className="cats" role="tablist" aria-label="무엇을 살까요">
          {CAT_ORDER.map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={cat === c}
              onClick={() => {
                sfx.tap();
                setCat(c);
              }}
            >
              {CAT_LABEL[c]}
            </button>
          ))}
        </div>
        <div className="goods">
          {items.map((item) => {
            const n = goodNote(p, item);
            return (
              <button key={item.id} type="button" className={`good${n.cls}`} onClick={() => pick(item)} aria-label={`${item.name}, 별 ${item.cost}개, ${n.text}`}>
                <span className="emo">{item.emoji}</span>
                <b>{item.name}</b>
                <span className="price">
                  <span className="emo">⭐</span>
                  {item.cost}
                </span>
                <span className="note">{n.text}</span>
              </button>
            );
          })}
        </div>
      </section>

      {buying && (
        <div className="scrim" role="dialog" aria-modal="true" aria-label={`${buying.name} 들이기`}>
          <div className="sheet dialog col center buydlg">
            <span className="big emo">{buying.emoji}</span>
            <h2>
              {buying.name}
              {josa(buying.name, '을/를')} 마을에 들일까요?
            </h2>
            <p className="muted">
              별 {buying.cost}개를 써요. 남는 별은 {left}개예요.
            </p>
            <button type="button" className="btn go block" onClick={confirm}>
              들이기
            </button>
            <button type="button" className="btn ghost block" onClick={() => setBuying(null)}>
              아니요
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function WishRow({ w }: { w: WishRequest }) {
  return (
    <li className="wish sheet">
      <span className="emo">{w.emoji}</span>
      <h3>{w.title}</h3>
      <div className="meta">
        {w.status === 'approved' ? <span className="chip leaf">받았어요 · {dateText(w.decidedAt ?? w.ts)}</span> : <span className="chip warm">이번에는 안 됐어요 · 별은 돌려받았어요</span>}
      </div>
    </li>
  );
}

/** 소원 상자: 부모가 정한 선물을 별로 바꿔 달라고 부탁한다. 부모가 허락해야 이뤄진다. */
function WishBox({ p }: { p: Profile }) {
  const { rewards, update } = useStore();
  const [ask, setAsk] = useState<RewardDef | null>(null);
  const pend = pendingWishes(p);
  const past = p.wishes.filter((w) => w.status !== 'pending').slice(-6).reverse();

  const send = () => {
    if (!ask) return;
    const def = ask;
    let ok = false;
    update((cur) => {
      const next = requestWish(cur, def, Date.now(), rid());
      ok = next !== null;
      return next ?? cur;
    });
    setAsk(null);
    if (ok) {
      sfx.pop();
      void say('부모님께 말했어요. 조금만 기다려 봐요.');
    }
  };

  return (
    <>
      <p className="muted">별을 모아 부모님께 부탁해 보세요. 부모님이 좋다고 하면 선물을 받아요.</p>

      {pend.length > 0 && (
        <section className="wsec" aria-label="기다리는 소원">
          <h2 className="subhead">기다리는 중</h2>
          <ul className="wishlist">
            {pend.map((w) => (
              <li key={w.id} className="wish sheet pending">
                <span className="emo">{w.emoji}</span>
                <h3>{w.title}</h3>
                <div className="meta">
                  <span className="chip sun">부모님이 보고 있어요</span>
                  <span className="muted">별 {w.cost}개 맡김</span>
                </div>
                <div className="act">
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() => {
                      sfx.tap();
                      update((cur) => cancelWish(cur, w.id));
                    }}
                  >
                    취소하고 별 돌려받기
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="wsec" aria-label="받고 싶은 선물">
        <h2 className="subhead">받고 싶은 선물</h2>
        {rewards.length === 0 ? (
          <div className="sheet empty">
            <span className="emo">🎁</span>
            아직 비어 있어요.
            <br />
            보호자가 선물을 정하면 여기에 나타나요.
          </div>
        ) : (
          <ul className="wishlist">
            {rewards.map((r) => {
              const waiting = pend.some((w) => w.rewardId === r.id);
              const enough = p.stars >= r.cost;
              return (
                <li key={r.id} className="wish sheet">
                  <span className="emo">{r.emoji}</span>
                  <h3>{r.title}</h3>
                  <div className="meta">
                    <span className="stars">
                      <span className="emo">⭐</span> {r.cost}
                    </span>
                  </div>
                  <div className="act">
                    <button
                      type="button"
                      className={`btn small block ${enough && !waiting ? 'rose' : 'ghost'}`}
                      disabled={!enough || waiting}
                      onClick={() => {
                        sfx.tap();
                        setAsk(r);
                      }}
                    >
                      {waiting ? '기다리는 중' : enough ? '부탁하기' : `별 ${r.cost - p.stars}개 더 모아요`}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section className="wsec" aria-label="지난 소원">
          <h2 className="subhead">지난 소원</h2>
          <ul className="wishlist">
            {past.map((w) => (
              <WishRow key={w.id} w={w} />
            ))}
          </ul>
        </section>
      )}

      {ask && (
        <div className="scrim" role="dialog" aria-modal="true" aria-label={`${ask.title} 부탁하기`}>
          <div className="sheet dialog col center buydlg">
            <span className="big emo">{ask.emoji}</span>
            <h2>
              {ask.title}
              {josa(ask.title, '을/를')} 부탁할까요?
            </h2>
            <p className="muted">별 {ask.cost}개를 먼저 맡겨 둬요. 부모님이 안 된다고 하면 별을 돌려받아요.</p>
            <button type="button" className="btn rose block" onClick={send}>
              부탁하기
            </button>
            <button type="button" className="btn ghost block" onClick={() => setAsk(null)}>
              아니요
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** 별을 쓰는 곳: 마을 꾸미기와 소원 상자 */
export function Village({ tab: initial }: { tab?: 'town' | 'wish' }) {
  const { profile } = useStore();
  const p = profile as Profile;
  const [tab, setTab] = useState<'town' | 'wish'>(initial ?? 'town');
  const pend = pendingWishes(p).length;

  useEffect(() => {
    void say(tab === 'town' ? '별로 마을을 꾸며 봐요.' : '받고 싶은 선물을 부탁해 봐요.');
    // 화면에 들어올 때와 탭을 바꿀 때만 말한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <main className="app village">
      <div className="page">
        <RHead title="내 마을" stars={p.stars} />
        <div className="tabs" role="tablist" aria-label="별 쓰는 곳">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'town'}
            onClick={() => {
              sfx.tap();
              setTab('town');
            }}
          >
            <span className="emo">🏘️</span> 마을 꾸미기
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'wish'}
            onClick={() => {
              sfx.tap();
              setTab('wish');
            }}
          >
            <span className="emo">🎁</span> 소원 상자
            {pend > 0 && <span className="dot">{pend}</span>}
          </button>
        </div>
        {tab === 'town' ? <Town p={p} /> : <WishBox p={p} />}
      </div>
    </main>
  );
}
