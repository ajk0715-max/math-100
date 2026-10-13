import { getKv, setKv } from './repo';

const enc = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomHex(bytes: number): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hash(secret: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 120_000 }, key, 256);
  return toHex(bits);
}

interface PinRec {
  salt: string;
  hash: string;
  recoverySalt: string;
  recoveryHash: string;
}

const MAX_FAILS = 5;
const LOCK_MS = 5 * 60 * 1000;

export async function hasPin(): Promise<boolean> {
  return !!(await getKv<PinRec | null>('pin', null));
}

const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function newRecoveryCode(): string {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  const s = [...a].map((b) => RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length]).join('');
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

/** PIN을 새로 정한다. 복구 코드를 돌려주니 부모가 적어 두게 한다. */
export async function setPin(pin: string): Promise<string> {
  const recovery = newRecoveryCode();
  const salt = randomHex(16);
  const recoverySalt = randomHex(16);
  const rec: PinRec = {
    salt,
    hash: await hash(pin, salt),
    recoverySalt,
    recoveryHash: await hash(recovery.replace('-', ''), recoverySalt),
  };
  await setKv('pin', rec);
  await setKv('pinFails', 0);
  await setKv('pinLockUntil', 0);
  return recovery;
}

export type PinResult = { ok: true } | { ok: false; locked: boolean; remaining: number; lockMs: number };

export async function verifyPin(pin: string): Promise<PinResult> {
  const now = Date.now();
  const lockUntil = await getKv<number>('pinLockUntil', 0);
  if (lockUntil > now) return { ok: false, locked: true, remaining: 0, lockMs: lockUntil - now };
  const rec = await getKv<PinRec | null>('pin', null);
  if (!rec) return { ok: true };
  if ((await hash(pin, rec.salt)) === rec.hash) {
    await setKv('pinFails', 0);
    return { ok: true };
  }
  const fails = (await getKv<number>('pinFails', 0)) + 1;
  if (fails >= MAX_FAILS) {
    await setKv('pinFails', 0);
    await setKv('pinLockUntil', now + LOCK_MS);
    return { ok: false, locked: true, remaining: 0, lockMs: LOCK_MS };
  }
  await setKv('pinFails', fails);
  return { ok: false, locked: false, remaining: MAX_FAILS - fails, lockMs: 0 };
}

/** 복구 코드로 PIN을 다시 정한다 */
export async function resetPinWithRecovery(code: string, newPin: string): Promise<{ ok: boolean; recovery?: string }> {
  const rec = await getKv<PinRec | null>('pin', null);
  if (!rec) return { ok: false };
  const norm = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if ((await hash(norm, rec.recoverySalt)) !== rec.recoveryHash) return { ok: false };
  const recovery = await setPin(newPin);
  return { ok: true, recovery };
}
