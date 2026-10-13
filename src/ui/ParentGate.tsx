'use client';

import { useEffect, useState } from 'react';
import { sfx } from '@/audio/sfx';
import { verifyPin } from '@/db/pin';
import { PinPad } from './parts/PinPad';

/** 보호자 PIN을 묻는 창. 틀리면 흔들리고, 5번 틀리면 5분 동안 잠긴다. */
export function ParentGate({ onOk, onCancel }: { onOk: () => void; onCancel: () => void }) {
  const [reset, setReset] = useState(0);
  const [shake, setShake] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [lockMs, setLockMs] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (lockMs <= 0) return;
    const id = setInterval(() => setLockMs((m) => Math.max(0, m - 1000)), 1000);
    return () => clearInterval(id);
  }, [lockMs]);

  const check = async (pin: string) => {
    setBusy(true);
    try {
      const r = await verifyPin(pin);
      if (r.ok) {
        sfx.place();
        onOk();
        return;
      }
      setShake(true);
      setTimeout(() => setShake(false), 400);
      setReset((n) => n + 1);
      if (r.locked) {
        setLockMs(r.lockMs);
        setMsg('PIN을 여러 번 틀렸어요. 잠시 뒤에 다시 해 주세요.');
      } else {
        setMsg(`PIN이 달라요. (${r.remaining}번 더 틀리면 잠겨요)`);
      }
    } finally {
      setBusy(false);
    }
  };

  const min = Math.floor(lockMs / 60000);
  const sec = Math.floor((lockMs % 60000) / 1000);

  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-label="보호자 확인">
      <div className="sheet dialog col center">
        <h2>보호자 확인</h2>
        <p className="muted">PIN 4자리를 입력해 주세요.</p>
        <p className={`pinmsg${msg ? '' : ' hidden'}`} aria-live="polite">
          {lockMs > 0 ? `${min}분 ${String(sec).padStart(2, '0')}초 뒤에 다시 할 수 있어요.` : (msg ?? '　')}
        </p>
        <PinPad onComplete={(p) => void check(p)} resetKey={reset} shake={shake} disabled={busy || lockMs > 0} />
        <button type="button" className="btn ghost small" onClick={onCancel}>
          닫기
        </button>
      </div>
    </div>
  );
}
