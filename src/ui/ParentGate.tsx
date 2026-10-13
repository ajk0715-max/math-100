'use client';

import { useEffect, useState } from 'react';
import { sfx } from '@/audio/sfx';
import { checkRecovery, resetPinWithRecovery, verifyPin } from '@/db/pin';
import { PinPad } from './parts/PinPad';

type Mode = 'pin' | 'code' | 'new1' | 'new2' | 'saved';

/** 보호자 PIN을 묻는 창. 틀리면 흔들리고, 5번 틀리면 5분 동안 잠긴다. 잊었으면 복구 코드로 새 PIN을 만든다. */
export function ParentGate({ onOk, onCancel }: { onOk: () => void; onCancel: () => void }) {
  const [mode, setMode] = useState<Mode>('pin');
  const [reset, setReset] = useState(0);
  const [shake, setShake] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [lockMs, setLockMs] = useState(0);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [first, setFirst] = useState('');
  const [newCode, setNewCode] = useState('');
  const [wrote, setWrote] = useState(false);

  useEffect(() => {
    if (lockMs <= 0) return;
    const id = setInterval(() => setLockMs((m) => Math.max(0, m - 1000)), 1000);
    return () => clearInterval(id);
  }, [lockMs]);

  const wobble = (m: string) => {
    setMsg(m);
    setShake(true);
    setTimeout(() => setShake(false), 400);
    setReset((n) => n + 1);
  };

  const check = async (pin: string) => {
    setBusy(true);
    try {
      const r = await verifyPin(pin);
      if (r.ok) {
        sfx.place();
        onOk();
        return;
      }
      if (r.locked) {
        setLockMs(r.lockMs);
        wobble('PIN을 여러 번 틀렸어요. 잠시 뒤에 다시 해 주세요.');
      } else {
        wobble(`PIN이 달라요. (${r.remaining}번 더 틀리면 잠겨요)`);
      }
    } finally {
      setBusy(false);
    }
  };

  const checkCode = async () => {
    setBusy(true);
    try {
      if (await checkRecovery(code)) {
        sfx.place();
        setMsg(null);
        setReset((n) => n + 1);
        setMode('new1');
      } else {
        setMsg('복구 코드가 달라요. 처음 설정할 때 적어 둔 코드를 확인해 주세요.');
      }
    } finally {
      setBusy(false);
    }
  };

  const onNewPin = async (pin: string) => {
    if (mode === 'new1') {
      setFirst(pin);
      setMsg('한 번 더 입력해 주세요.');
      setReset((n) => n + 1);
      setMode('new2');
      return;
    }
    if (pin !== first) {
      setMode('new1');
      wobble('두 번이 달랐어요. 새 PIN을 처음부터 다시 입력해 주세요.');
      return;
    }
    setBusy(true);
    try {
      const r = await resetPinWithRecovery(code, pin);
      if (r.ok && r.recovery) {
        setNewCode(r.recovery);
        setMode('saved');
      } else {
        setMode('code');
        setMsg('복구 코드를 다시 확인해 주세요.');
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
        {mode === 'pin' && (
          <>
            <h2>보호자 확인</h2>
            <p className="muted">PIN 4자리를 입력해 주세요.</p>
            <p className={`pinmsg${msg ? '' : ' hidden'}`} aria-live="polite">
              {lockMs > 0 ? `${min}분 ${String(sec).padStart(2, '0')}초 뒤에 다시 할 수 있어요.` : (msg ?? '　')}
            </p>
            <PinPad onComplete={(p) => void check(p)} resetKey={reset} shake={shake} disabled={busy || lockMs > 0} />
            <button
              type="button"
              className="btn ghost small"
              onClick={() => {
                setMsg(null);
                setMode('code');
              }}
            >
              PIN을 잊었어요
            </button>
            <button type="button" className="btn ghost small" onClick={onCancel}>
              닫기
            </button>
          </>
        )}

        {mode === 'code' && (
          <>
            <h2>복구 코드</h2>
            <p className="muted">처음 설정할 때 적어 둔 코드 8자리를 입력해 주세요.</p>
            <input
              className="codeinput"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 9))}
              placeholder="AB12-CD34"
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              aria-label="복구 코드"
            />
            <p className={`pinmsg${msg ? '' : ' hidden'}`} aria-live="polite">
              {msg ?? '　'}
            </p>
            <button type="button" className="btn go block" disabled={busy || code.replace(/[^A-Za-z0-9]/g, '').length < 8} onClick={() => void checkCode()}>
              확인
            </button>
            <button
              type="button"
              className="btn ghost small"
              onClick={() => {
                setMsg(null);
                setMode('pin');
              }}
            >
              돌아가기
            </button>
          </>
        )}

        {(mode === 'new1' || mode === 'new2') && (
          <>
            <h2>{mode === 'new1' ? '새 PIN을 정해 주세요' : '새 PIN을 한 번 더'}</h2>
            <p className={`pinmsg${msg ? '' : ' hidden'}`} aria-live="polite">
              {msg ?? '　'}
            </p>
            <PinPad onComplete={(p) => void onNewPin(p)} resetKey={reset} shake={shake} disabled={busy} />
            <button type="button" className="btn ghost small" onClick={onCancel}>
              닫기
            </button>
          </>
        )}

        {mode === 'saved' && (
          <>
            <h2>새 복구 코드</h2>
            <div className="code" aria-label="새 복구 코드">
              {newCode}
            </div>
            <p>PIN을 새로 만들었어요. 복구 코드도 새로 바뀌었으니 종이에 적어 두세요. 예전 코드는 더 쓸 수 없어요.</p>
            <label className="check">
              <input type="checkbox" checked={wrote} onChange={(e) => setWrote(e.target.checked)} />
              <span>적어 두었어요</span>
            </label>
            <button type="button" className="btn go block" disabled={!wrote} onClick={onOk}>
              보호자 메뉴 열기
            </button>
          </>
        )}
      </div>
    </div>
  );
}
