import type { ReactNode } from 'react';
import type { Visual } from '@/core/types';
import { Scene } from '../visual/Scene';

const LEAD_EMOJI = /^(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*)\s+(.+)$/u;

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
