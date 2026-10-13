import type { Visual } from '@/core/types';

type CoinsV = Extract<Visual, { k: 'coins' }>;
type PriceV = Extract<Visual, { k: 'price' }>;

/** 보여 주는 동전. 누르는 동전은 답 입력 화면(Coins)에 따로 있다. */
export function CoinsView({ v }: { v: CoinsV }) {
  return (
    <div className="coinrow" role="img" aria-label={`동전 ${v.coins.length}개`}>
      {v.coins.map((w, i) => (
        <span key={i} className={`coin w${w} view`}>
          <span>{w}</span>
        </span>
      ))}
    </div>
  );
}

/** 물건과 값이 붙은 가격표 */
export function PriceTag({ v }: { v: PriceV }) {
  return (
    <div className="price" role="img" aria-label={`${v.name} ${v.won}원`}>
      <span className="emo pe">{v.emoji}</span>
      <span className="pn">{v.name}</span>
      <span className="pw">{v.won}원</span>
    </div>
  );
}
