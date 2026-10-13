'use client';

import { useEffect, useState } from 'react';
import { sfx, unlockAudio } from '@/audio/sfx';
import { koVoices, say, speechSupported } from '@/audio/speech';
import { WEEKDAYS_SHORT } from '@/core/dates';
import { parseHm } from '@/core/limits';
import { DEFAULT_SETTINGS, type Profile, type ProfileSettings } from '@/core/model';
import { Switch } from '../parts/Switch';
import { useStore } from '../store';
import { PinChange } from './PinChange';
import type { Notify } from './shared';

const CAPS = [10, 15, 20, 30] as const;
const EXTRAS = [0, 5, 10] as const;

/** 설정: 공부 시간·요일·시간대, 선택 과제, 소리, PIN */
export function SettingsTab({ notify }: { notify: Notify }) {
  const { profile, update } = useStore();
  const p = profile as Profile;
  const st = p.settings;
  const [voices, setVoices] = useState<{ name: string; local: boolean }[]>([]);
  const [pinOpen, setPinOpen] = useState(false);
  const [from, setFrom] = useState(st.allowedFrom);
  const [to, setTo] = useState(st.allowedTo);

  useEffect(() => {
    const refresh = () => setVoices(koVoices());
    refresh();
    const id = setInterval(refresh, 800);
    const stop = setTimeout(() => clearInterval(id), 3000);
    return () => {
      clearInterval(id);
      clearTimeout(stop);
    };
  }, []);

  const set = (patch: Partial<ProfileSettings>) => update((x) => ({ ...x, settings: { ...x.settings, ...patch } }));

  const limited = !(st.allowedFrom === '00:00' && st.allowedTo === '24:00');
  const fromMin = parseHm(from);
  const toMin = parseHm(to);
  const windowOk = fromMin !== null && toMin !== null && fromMin < toMin;

  const toggleDay = (d: number) => {
    const on = st.studyDays.includes(d);
    if (on && st.studyDays.length === 1) {
      notify('공부하는 요일이 하나는 있어야 해요.');
      return;
    }
    set({ studyDays: on ? st.studyDays.filter((x) => x !== d) : [...st.studyDays, d].sort() });
  };

  const commitWindow = (f: string, t: string) => {
    const a = parseHm(f);
    const b = parseHm(t);
    if (a !== null && b !== null && a < b) set({ allowedFrom: f, allowedTo: t });
  };

  const testSound = () => {
    unlockAudio();
    sfx.star();
    void say('안녕! 나는 수 곰이야. 소리가 잘 들리니?', { force: true });
  };

  return (
    <>
      <section className="sheet col">
        <h2>공부 시간</h2>
        <div className="field">
          <span>하루 최대</span>
          <div className="seg" role="radiogroup" aria-label="하루 최대 공부 시간">
            {CAPS.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={st.dailyCapMin === m} className={st.dailyCapMin === m ? 'on' : ''} onClick={() => set({ dailyCapMin: m })}>
                {m}분
              </button>
            ))}
          </div>
          <small>수업은 약 15분이에요. 상한에 닿으면 ‘내일 만나요’가 나와요.</small>
        </div>

        <div className="field">
          <span>공부하는 요일</span>
          <div className="days" role="group" aria-label="공부하는 요일">
            {WEEKDAYS_SHORT.map((w, d) => (
              <button key={w} type="button" aria-pressed={st.studyDays.includes(d)} className={st.studyDays.includes(d) ? 'on' : ''} onClick={() => toggleDay(d)}>
                {w}
              </button>
            ))}
          </div>
          <small>쉬는 요일에는 ‘오늘은 쉬는 날’이 나와요. 쉬어도 별은 줄지 않아요.</small>
        </div>

        <Switch
          on={limited}
          onChange={(v) => {
            if (v) {
              setFrom(DEFAULT_SETTINGS.allowedFrom);
              setTo(DEFAULT_SETTINGS.allowedTo);
              set({ allowedFrom: DEFAULT_SETTINGS.allowedFrom, allowedTo: DEFAULT_SETTINGS.allowedTo });
            } else {
              set({ allowedFrom: '00:00', allowedTo: '24:00' });
            }
          }}
          label="공부 시간대 정하기"
          sub={limited ? `${st.allowedFrom}~${st.allowedTo}에만 수업이 열려요` : '하루 중 언제든 열려요'}
        />
        {limited && (
          <div className="row two">
            <label className="field">
              <span>시작</span>
              <input
                type="time"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  commitWindow(e.target.value, to);
                }}
              />
            </label>
            <label className="field">
              <span>끝</span>
              <input
                type="time"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  commitWindow(from, e.target.value);
                }}
              />
            </label>
          </div>
        )}
        {limited && !windowOk && <p className="status warn">시작 시각이 끝 시각보다 빨라야 해요. 지금은 이전 시간대 그대로예요.</p>}

        <Switch on={st.oneLessonPerDay} onChange={(v) => set({ oneLessonPerDay: v })} label="하루에 수업 하나만" sub="끝내면 ‘내일 만나요’ 화면이 나와요" />

        <div className="field">
          <span>수업 뒤 더 놀기</span>
          <div className="seg" role="radiogroup" aria-label="수업 뒤 더 놀기 시간">
            {EXTRAS.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={st.extraMin === m} className={st.extraMin === m ? 'on' : ''} onClick={() => set({ extraMin: m })}>
                {m === 0 ? '끄기' : `${m}분`}
              </button>
            ))}
          </div>
          <small>수업을 마친 날, 별 없이 게임만 더 해요. 하루 최대 시간을 넘지 않아요.</small>
        </div>
      </section>

      <section className="sheet col">
        <h2>소리</h2>
        <div className="switches">
          <Switch on={st.voice} onChange={(v) => set({ voice: v })} label="문제 읽어 주기" sub="글자를 다 읽지 못해도 풀 수 있어요" />
          <Switch on={st.sfx} onChange={(v) => set({ sfx: v })} label="효과음" />
        </div>
        <button type="button" className="btn warm" onClick={testSound}>
          <span aria-hidden="true">🔊</span> 소리 점검
        </button>
        <p className={`status ${voices.length > 0 ? 'ok' : 'warn'}`}>
          {!speechSupported() ? '이 브라우저는 읽어 주기를 지원하지 않아요.' : voices.length > 0 ? `한국어 목소리: ${voices[0]?.name}` : '한국어 목소리를 찾지 못했어요. 기기 설정에서 한국어 음성을 내려받아 주세요.'}
        </p>
      </section>

      <section className="sheet col">
        <h2>보호자 PIN</h2>
        <p className="muted">PIN을 바꾸면 복구 코드도 새로 만들어져요.</p>
        <button type="button" className="btn ghost" onClick={() => setPinOpen(true)}>
          PIN 바꾸기
        </button>
      </section>

      {pinOpen && (
        <PinChange
          onCancel={() => setPinOpen(false)}
          onDone={() => {
            setPinOpen(false);
            notify('PIN을 바꿨어요.');
          }}
        />
      )}
    </>
  );
}
