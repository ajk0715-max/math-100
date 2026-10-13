'use client';

import { useState } from 'react';
import { sfx } from '@/audio/sfx';
import { setPin, verifyPin } from '@/db/pin';
import { PinPad } from '../parts/PinPad';

type Step = 'old' | 'new1' | 'new2' | 'code';

/** 보호자 PIN 바꾸기: 지금 PIN → 새 PIN 두 번 → 새 복구 코드 */
export function PinChange({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [step, setStep] = useState<Step>('old');
  const [first, setFirst] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [wrote, setWrote] = useState(false);

  const fail = (m: string) => {
    setMsg(m);
    setShake(true);
    setTimeout(() => setShake(false), 400);
    setReset((n) => n + 1);
  };

  const onPin = async (pin: string) => {
    if (step === 'old') {
      setBusy(true);
      try {
        const r = await verifyPin(pin);
        if (r.ok) {
          sfx.place();
          setMsg(null);
          setReset((n) => n + 1);
          setStep('new1');
        } else if (r.locked) fail('여러 번 틀려서 잠시 잠겼어요. 나중에 다시 해 주세요.');
        else fail(`PIN이 달라요. (${r.remaining}번 더 틀리면 잠겨요)`);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (step === 'new1') {
      setFirst(pin);
      setMsg('한 번 더 입력해 주세요.');
      setReset((n) => n + 1);
      setStep('new2');
      return;
    }
    if (step === 'new2') {
      if (pin !== first) {
        setStep('new1');
        fail('두 번이 달랐어요. 새 PIN을 처음부터 다시 입력해 주세요.');
        return;
      }
      setBusy(true);
      try {
        setCode(await setPin(pin));
        setStep('code');
      } finally {
        setBusy(false);
      }
    }
  };

  const title = step === 'old' ? '지금 PIN을 입력해 주세요' : step === 'new1' ? '새 PIN을 정해 주세요' : step === 'new2' ? '새 PIN을 한 번 더' : '새 복구 코드';

  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-label="PIN 바꾸기">
      <div className="sheet dialog col center">
        <h2>{title}</h2>
        {step !== 'code' ? (
          <>
            <p className={`pinmsg${msg ? '' : ' hidden'}`} aria-live="polite">
              {msg ?? '　'}
            </p>
            <PinPad onComplete={(p) => void onPin(p)} resetKey={reset} shake={shake} disabled={busy} />
            <button type="button" className="btn ghost small" onClick={onCancel}>
              취소
            </button>
          </>
        ) : (
          <>
            <div className="code" aria-label="복구 코드">
              {code}
            </div>
            <p>PIN을 바꾸면 복구 코드도 새로 만들어져요. 예전 코드는 더 쓸 수 없어요. 종이에 적어 두세요.</p>
            <label className="check">
              <input type="checkbox" checked={wrote} onChange={(e) => setWrote(e.target.checked)} />
              <span>적어 두었어요</span>
            </label>
            <button type="button" className="btn go block" disabled={!wrote} onClick={onDone}>
              완료
            </button>
          </>
        )}
      </div>
    </div>
  );
}
