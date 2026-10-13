'use client';

import { useEffect } from 'react';

/** 서비스 워커를 등록해 한 번 열어 본 뒤에는 오프라인에서도 열리게 한다. 개발 서버에서는 등록하지 않는다. */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* 등록 실패는 앱 동작에 영향이 없다 */
      });
    };
    if (document.readyState === 'complete') onLoad();
    else window.addEventListener('load', onLoad, { once: true });
    return () => window.removeEventListener('load', onLoad);
  }, []);
  return null;
}
