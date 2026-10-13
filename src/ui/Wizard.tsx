'use client';

import { useEffect, useState } from 'react';
import { say, koVoices, speechSupported } from '@/audio/speech';
import { sfx, unlockAudio } from '@/audio/sfx';
import { requestPersistence } from '@/db/repo';
import { setPin } from '@/db/pin';
import { Buddy } from './Buddy';
import { canPromptInstall, isStandalone, platform, promptInstall } from './install';
import { PinPad } from './parts/PinPad';
import { Switch } from './parts/Switch';
import { useStore } from './store';

export const AVATARS = ['🐻', '🦊', '🐰', '🐯', '🐼', '🐧', '🦁', '🐸'] as const;

type Step = 'welcome' | 'child' | 'pin' | 'recovery' | 'sound' | 'install' | 'done';

/** 처음 한 번, 보호자가 아이 정보·PIN·소리·설치를 정하는 흐름 */
export function Wizard() {
  const store = useStore();
  const [step, setStep] = useState<Step>('welcome');
  const [nick, setNick] = useState('');
  const [avatar, setAvatar] = useState<string>(AVATARS[0]);
  const [pinFirst, setPinFirst] = useState<string | null>(null);
  const [pinMsg, setPinMsg] = useState<string | null>(null);
  const [pinReset, setPinReset] = useState(0);
  const [pinShake, setPinShake] = useState(false);
  const [recovery, setRecovery] = useState('');
  const [wrote, setWrote] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [sfxOn, setSfxOn] = useState(true);
  const [voices, setVoices] = useState<{ name: string; local: boolean }[]>([]);
  const [heard, setHeard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [installMsg, setInstallMsg] = useState<string | null>(null);

  const plat = typeof window === 'undefined' ? 'other' : platform();
  const skipInstall = typeof window !== 'undefined' && isStandalone();

  useEffect(() => {
    if (step !== 'sound') return;
    const refresh = () => setVoices(koVoices());
    refresh();
    const id = setInterval(refresh, 700);
    const stop = setTimeout(() => clearInterval(id), 4000);
    return () => {
      clearInterval(id);
      clearTimeout(stop);
    };
  }, [step]);

  const order: Step[] = ['welcome', 'child', 'pin', 'recovery', 'sound', ...(skipInstall ? [] : (['install'] as Step[])), 'done'];
  const next = () => {
    sfx.tap();
    const i = order.indexOf(step);
    setStep(order[Math.min(order.length - 1, i + 1)] as Step);
  };
  const back = () => {
    sfx.tap();
    if (step === 'recovery') return; // PIN을 이미 만들었으므로 되돌리지 않는다
    const i = order.indexOf(step);
    setStep(order[Math.max(0, i - 1)] as Step);
  };

  const onPin = async (pin: string) => {
    if (pinFirst === null) {
      setPinFirst(pin);
      setPinMsg('한 번 더 입력해 주세요.');
      setPinReset((n) => n + 1);
      return;
    }
    if (pin !== pinFirst) {
      setPinFirst(null);
      setPinMsg('두 번이 달랐어요. 처음부터 다시 입력해 주세요.');
      setPinShake(true);
      setTimeout(() => setPinShake(false), 400);
      setPinReset((n) => n + 1);
      return;
    }
    setBusy(true);
    try {
      setRecovery(await setPin(pin));
      setStep('recovery');
    } finally {
      setBusy(false);
    }
  };

  const testSound = () => {
    unlockAudio();
    sfx.star();
    void say('안녕! 나는 수 곰이야. 우리 같이 공부해 보자.', { force: true }).then(() => setHeard(true));
    setHeard(true);
  };

  const finish = async () => {
    setBusy(true);
    try {
      const p = await store.createProfile(nick, avatar);
      store.update((x) => ({ ...x, settings: { ...x.settings, voice: voiceOn, sfx: sfxOn } }));
      void requestPersistence();
      sfx.fanfare();
      store.go({ name: 'home' }, { replace: true });
      return p;
    } finally {
      setBusy(false);
    }
  };

  const hasKo = voices.length > 0;

  return (
    <main className="app">
      <div className="page wizard">
        {step === 'welcome' && (
          <section className="sheet stitch center col welcome">
            <div className="trio" aria-hidden="true">
              <Buddy who="owl" size={5} />
              <Buddy who="bear" mood="cheer" size={6.4} />
              <Buddy who="mole" size={5} />
            </div>
            <h1 className="title">100일 수학</h1>
            <p className="lead">초등학교 입학 전 100일, 하루 15분.</p>
            <p className="muted">수, 시계, 달력을 놀이처럼 익혀요.</p>
            <button type="button" className="btn go block" onClick={next}>
              시작하기
            </button>
            <p className="fine">처음 한 번만 보호자가 설정해요. 기록은 이 기기 안에만 저장돼요.</p>
          </section>
        )}

        {step === 'child' && (
          <section className="sheet stitch col">
            <h2>누가 공부할까요?</h2>
            <label className="field">
              <span>별명</span>
              <input value={nick} onChange={(e) => setNick(e.target.value)} maxLength={8} placeholder="예: 하준" autoComplete="off" enterKeyHint="done" />
            </label>
            <div className="field">
              <span>친구 얼굴</span>
              <div className="avatars" role="radiogroup" aria-label="친구 얼굴">
                {AVATARS.map((a) => (
                  <button key={a} type="button" role="radio" aria-checked={avatar === a} className={`avatar${avatar === a ? ' on' : ''}`} onClick={() => setAvatar(a)}>
                    <span className="emo">{a}</span>
                  </button>
                ))}
              </div>
            </div>
            <p className="fine">이름 대신 별명을 써도 돼요.</p>
            <div className="row two">
              <button type="button" className="btn ghost" onClick={back}>
                이전
              </button>
              <button type="button" className="btn go" onClick={next} disabled={nick.trim().length === 0}>
                다음
              </button>
            </div>
          </section>
        )}

        {step === 'pin' && (
          <section className="sheet stitch col center">
            <h2>보호자 PIN 만들기</h2>
            <p className="muted">수업 기록과 설정을 볼 때 쓰는 숫자 4자리예요.</p>
            <p className={`pinmsg${pinMsg ? '' : ' hidden'}`} aria-live="polite">
              {pinMsg ?? '　'}
            </p>
            <PinPad onComplete={(p) => void onPin(p)} resetKey={pinReset} shake={pinShake} disabled={busy} />
            <button type="button" className="btn ghost small" onClick={back}>
              이전
            </button>
          </section>
        )}

        {step === 'recovery' && (
          <section className="sheet stitch col">
            <h2>복구 코드를 적어 두세요</h2>
            <div className="code" aria-label="복구 코드">
              {recovery}
            </div>
            <p>PIN을 잊어버렸을 때, 이 코드로 새 PIN을 만들 수 있어요. 다시 보여 드리지 않으니 종이에 적거나 화면을 사진으로 남겨 주세요.</p>
            <label className="check">
              <input type="checkbox" checked={wrote} onChange={(e) => setWrote(e.target.checked)} />
              <span>적어 두었어요</span>
            </label>
            <button type="button" className="btn go block" onClick={next} disabled={!wrote}>
              다음
            </button>
          </section>
        )}

        {step === 'sound' && (
          <section className="sheet stitch col">
            <h2>소리 확인</h2>
            <p>문제를 읽어 주는 목소리와 효과음이 나와요. 아이가 한글을 아직 다 읽지 못해도 풀 수 있게 하려는 거예요.</p>
            <button type="button" className="btn warm block" onClick={testSound}>
              <span aria-hidden="true">🔊</span> 소리 들어보기
            </button>
            <p className={`status ${hasKo ? 'ok' : 'warn'}`} aria-live="polite">
              {!speechSupported()
                ? '이 브라우저는 읽어 주기를 지원하지 않아요. 글자로만 진행돼요.'
                : hasKo
                  ? `한국어 목소리를 찾았어요 (${voices[0]?.name}).`
                  : '한국어 목소리를 아직 못 찾았어요. 소리가 안 나면 기기 설정에서 한국어 음성을 내려받아 주세요.'}
            </p>
            {heard && <p className="fine">소리가 안 들리면 볼륨과 무음 모드를 확인해 주세요.</p>}
            <div className="switches">
              <Switch on={voiceOn} onChange={setVoiceOn} label="문제 읽어 주기" sub="목소리로 문제를 읽어 줘요" />
              <Switch on={sfxOn} onChange={setSfxOn} label="효과음" sub="맞았을 때 딩동 소리" />
            </div>
            <div className="row two">
              <button type="button" className="btn ghost" onClick={back}>
                이전
              </button>
              <button type="button" className="btn go" onClick={next}>
                다음
              </button>
            </div>
          </section>
        )}

        {step === 'install' && (
          <section className="sheet stitch col">
            <h2>홈 화면에 추가</h2>
            <p>앱처럼 바로 열려요. 인터넷이 없어도 이어서 할 수 있어요.</p>
            {plat === 'ios' && (
              <ol className="howto">
                <li>
                  <b>사파리</b>로 이 페이지를 열어요. (다른 앱 안의 브라우저에서는 추가할 수 없어요)
                </li>
                <li>
                  화면 아래의 <b>공유 단추</b>(네모에 위쪽 화살표)를 눌러요.
                </li>
                <li>
                  <b>홈 화면에 추가</b>를 고르고 <b>추가</b>를 눌러요.
                </li>
              </ol>
            )}
            {plat === 'android' && (
              <>
                {canPromptInstall() ? (
                  <button
                    type="button"
                    className="btn warm block"
                    onClick={async () => setInstallMsg((await promptInstall()) ? '추가했어요!' : '나중에 다시 할 수 있어요.')}
                  >
                    앱으로 추가하기
                  </button>
                ) : (
                  <ol className="howto">
                    <li>
                      <b>크롬</b>에서 이 페이지를 열고 오른쪽 위 <b>⋮ 메뉴</b>를 눌러요.
                    </li>
                    <li>
                      <b>홈 화면에 추가</b> 또는 <b>앱 설치</b>를 눌러요.
                    </li>
                  </ol>
                )}
                {installMsg && <p className="status ok">{installMsg}</p>}
              </>
            )}
            {plat === 'other' && <p className="muted">휴대폰이나 태블릿의 브라우저 메뉴에서 &lsquo;홈 화면에 추가&rsquo;를 찾아 눌러 주세요.</p>}
            <div className="row two">
              <button type="button" className="btn ghost" onClick={back}>
                이전
              </button>
              <button type="button" className="btn go" onClick={next}>
                다음
              </button>
            </div>
          </section>
        )}

        {step === 'done' && (
          <section className="sheet stitch col center">
            <Buddy who="bear" mood="cheer" size={7} className="hop" />
            <h2 className="title">준비 끝!</h2>
            <p className="lead">
              {avatar} {nick.trim() || '친구'}, 오늘부터 시작해 볼까?
            </p>
            <button type="button" className="btn go block" onClick={() => void finish()} disabled={busy}>
              첫 수업 만나러 가기
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
