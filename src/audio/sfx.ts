/** 효과음은 파일 없이 웹 오디오로 만든다. 부드럽고 짧게, 틀렸을 때도 놀라지 않게. */

type Ctor = typeof AudioContext;

let ac: AudioContext | null = null;
let on = true;

export function setSfxEnabled(v: boolean): void {
  on = v;
}

/** 첫 탭에서 부른다(브라우저가 소리를 막아 두었다가 풀어 준다) */
export function unlockAudio(): void {
  if (typeof window === 'undefined') return;
  const C: Ctor | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
  if (!C) return;
  if (!ac) ac = new C();
  if (ac.state === 'suspended') void ac.resume();
}

function tone(freq: number, at: number, dur: number, o: { type?: OscillatorType; gain?: number; to?: number } = {}): void {
  if (!on || !ac) return;
  const t0 = ac.currentTime + at;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
  const peak = o.gain ?? 0.12;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

function noise(at: number, dur: number, gain: number, cutoff = 1800): void {
  if (!on || !ac) return;
  const t0 = ac.currentTime + at;
  const len = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const f = ac.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = cutoff;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(ac.destination);
  src.start(t0);
}

export const sfx = {
  tap: () => tone(620, 0, 0.05, { type: 'triangle', gain: 0.05 }),
  right: () => {
    tone(660, 0, 0.12, { gain: 0.1 });
    tone(880, 0.09, 0.14, { gain: 0.1 });
    tone(1320, 0.19, 0.24, { gain: 0.09 });
  },
  wrong: () => tone(300, 0, 0.2, { type: 'sine', gain: 0.1, to: 230 }),
  pop: () => {
    noise(0, 0.08, 0.25, 3200);
    tone(900, 0, 0.1, { type: 'triangle', gain: 0.1, to: 220 });
  },
  place: () => tone(440, 0, 0.07, { type: 'triangle', gain: 0.08, to: 520 }),
  star: () => {
    [880, 1100, 1320, 1760].forEach((f, i) => tone(f, i * 0.07, 0.16, { gain: 0.08 }));
  },
  stamp: () => {
    tone(110, 0, 0.3, { gain: 0.32, to: 42 });
    noise(0, 0.1, 0.22, 900);
  },
  whoosh: () => noise(0, 0.22, 0.08, 1400),
  fanfare: () => {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.13, 0.28, { gain: 0.1 }));
    tone(1046, 0.55, 0.5, { gain: 0.09 });
  },
};

export function buzz(ms = 12): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* 지원하지 않는 기기 */
  }
}
