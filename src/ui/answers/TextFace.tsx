import type { ReactNode } from 'react';
import type { Visual } from '@/core/types';
import { Scene } from '../visual/Scene';

const LEAD_EMOJI = /^(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*)\s+(.+)$/u;

/** 칸 안에 글자만 있는 선택지에서 가장 긴 낱말의 글자 수(그림이 붙은 칸이나 이모지로 시작하는 글은 빼고 센다) */
export function fitLen(items: { visual?: Visual; text?: string }[]): number {
  let max = 0;
  for (const it of items) {
    if (it.visual || it.text === undefined || LEAD_EMOJI.test(it.text)) continue;
    for (const w of it.text.split(/\s+/)) max = Math.max(max, Array.from(w).length);
  }
  return max;
}

/** "⏰ 일어나요"처럼 앞에 이모지가 붙은 글은 그림과 글자를 위아래로 나눠 보여 준다 */
export function TextFace({ visual, text }: { visual?: Visual; text?: string }): ReactNode {
  const m = text !== undefined ? LEAD_EMOJI.exec(text) : null;
  return (
    <>
      {visual && <Scene v={visual} />}
      {m ? (
        <>
          <span className="emo big">{m[1]}</span>
          <span className="t sm">{m[2]}</span>
        </>
      ) : (
        text !== undefined && <span className="t">{text}</span>
      )}
    </>
  );
}
