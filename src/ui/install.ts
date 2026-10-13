/** 홈 화면에 추가(설치) 안내를 돕는 작은 도구 */

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
let watching = false;

export function watchInstall(): void {
  if (typeof window === 'undefined' || watching) return;
  watching = true;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
  });
}

export function canPromptInstall(): boolean {
  return deferred !== null;
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const d = deferred;
  deferred = null;
  try {
    await d.prompt();
    return (await d.userChoice).outcome === 'accepted';
  } catch {
    return false;
  }
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches === true || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

export type Platform = 'ios' | 'android' | 'other';

export function platform(): Platform {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  // iPadOS는 데스크톱 사파리처럼 보이므로 터치 지점 수로 구분한다
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}
