'use client';

import { sfx } from '@/audio/sfx';
import { useStore } from '../store';

/** 도감·마을 화면 위쪽: 돌아가기, 제목, 별 */
export function RHead({ title, stars }: { title: string; stars?: number }) {
  const { go } = useStore();
  return (
    <header className="rhead">
      <button
        type="button"
        className="btn small ghost"
        onClick={() => {
          sfx.tap();
          go({ name: 'home' }, { replace: true });
        }}
        aria-label="홈으로 돌아가기"
      >
        ← 홈
      </button>
      <h1>{title}</h1>
      {stars !== undefined && (
        <span className="stars" aria-label={`별 ${stars}개`}>
          <span className="emo">⭐</span> {stars}
        </span>
      )}
    </header>
  );
}
