import { speak as toSpoken } from '@/core/ko';

/** 기기에 들어 있는 한국어 음성으로 읽어 준다. 첫 소리는 반드시 사용자가 화면을 누른 뒤에 낸다. */

let enabled = true;
let chosenName: string | null = null;
let rate = 0.92;
let voices: SpeechSynthesisVoice[] = [];
let wired = false;
let timer: ReturnType<typeof setTimeout> | null = null;

function synth(): SpeechSynthesis | null {
  return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
}

function refresh(): void {
  const s = synth();
  if (!s) return;
  voices = s.getVoices().filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith('ko'));
}

/** 음성 목록을 불러오기 시작한다(여러 번 불러도 된다) */
export function initSpeech(): void {
  const s = synth();
  if (!s) return;
  refresh();
  if (!wired) {
    wired = true;
    s.addEventListener?.('voiceschanged', refresh);
  }
}

export function speechSupported(): boolean {
  return synth() !== null;
}

export function koVoices(): { name: string; local: boolean }[] {
  refresh();
  return voices.map((v) => ({ name: v.name, local: v.localService }));
}

export function speechEnabled(): boolean {
  return enabled && synth() !== null;
}

export function setSpeechEnabled(on: boolean): void {
  enabled = on;
  if (!on) stopSpeech();
}

export function setVoiceName(name: string | null): void {
  chosenName = name;
}

export function setSpeechRate(r: number): void {
  rate = Math.min(1.2, Math.max(0.6, r));
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (!voices.length) refresh();
  if (chosenName) {
    const v = voices.find((x) => x.name === chosenName);
    if (v) return v;
  }
  const byName = voices.find((v) => /yuna|유나|sora|소라|heami|hyemi/i.test(v.name));
  return byName ?? voices.find((v) => v.localService) ?? voices[0] ?? null;
}

export function stopSpeech(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  synth()?.cancel();
}

/**
 * 글을 읽어 준다. 화면 글(숫자 포함)을 그대로 넘기면 읽는 말로 바꿔서 읽는다.
 * 끝나면(또는 실패하면) 이행된다. 소리가 꺼져 있거나 지원하지 않으면 바로 이행된다.
 */
export function say(text: string, opts: { force?: boolean } = {}): Promise<void> {
  const s = synth();
  if (!s || (!enabled && !opts.force)) return Promise.resolve();
  const spoken = toSpoken(text);
  if (!spoken) return Promise.resolve();
  return new Promise<void>((resolve) => {
    stopSpeech();
    // 일부 안드로이드 브라우저는 cancel 직후의 speak를 버리므로 잠깐 띄운다
    timer = setTimeout(() => {
      const u = new SpeechSynthesisUtterance(spoken);
      u.lang = 'ko-KR';
      u.rate = rate;
      u.pitch = 1.08;
      const v = pickVoice();
      if (v) u.voice = v;
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      u.onend = done;
      u.onerror = done;
      // 끝 이벤트가 오지 않는 브라우저를 위한 안전장치
      setTimeout(done, Math.max(2500, spoken.length * 330));
      s.speak(u);
    }, 40);
  });
}
