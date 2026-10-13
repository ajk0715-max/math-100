'use client';

import { useState } from 'react';
import { daysInMonth } from '@/core/dates';
import { josa } from '@/core/ko';
import type { Profile } from '@/core/model';
import type { FamilyEvent } from '@/core/types';
import { deleteProfile } from '@/db/repo';
import { AVATARS } from '../Wizard';
import { useStore } from '../store';
import { Confirm, rid, type Notify } from './shared';

const MAX_EVENTS = 12;
const MAX_PROFILES = 4;
const KIND_LABEL: Record<FamilyEvent['kind'], string> = { birthday: '생일', anniversary: '기념일', holiday: '공휴일' };
const KIND_EMOJI: Record<FamilyEvent['kind'], string> = { birthday: '🎂', anniversary: '💝', holiday: '🎌' };

/** 이름 뒤에 ‘생일/기념일’을 붙인다. 문제 문장이 “…은 3월 5일이에요”로 읽히도록 항상 ‘일’로 끝나게 한다. */
const labelOf = (name: string, kind: 'birthday' | 'anniversary'): string => `${name.trim()} ${KIND_LABEL[kind]}`;

/** 가족: 달력 문제에 나올 가족 날짜, 아이 프로필 */
export function FamilyTab({ notify }: { notify: Notify }) {
  const { profile, profiles, events, setEvents, selectProfile, createProfile, reload } = useStore();
  const p = profile as Profile;

  // ---- 가족 날짜 ----
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'birthday' | 'anniversary'>('birthday');
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);
  const [evErr, setEvErr] = useState<string | null>(null);

  const sorted = [...events].sort((a, b) => a.month - b.month || a.day - b.day);
  const maxDay = daysInMonth(2024, month); // 윤년 기준: 2월 29일 생일도 적을 수 있다

  const addEvent = async () => {
    if (name.trim().length === 0) {
      setEvErr('누구의 날인지 이름을 적어 주세요. 예: 엄마');
      return;
    }
    if (events.length >= MAX_EVENTS) {
      setEvErr(`가족 날짜는 ${MAX_EVENTS}개까지 둘 수 있어요.`);
      return;
    }
    const label = labelOf(name, kind);
    if (events.some((e) => e.label === label && e.month === month && e.day === day)) {
      setEvErr('같은 날짜가 이미 있어요.');
      return;
    }
    await setEvents([...events, { id: rid(), label, month, day: Math.min(day, maxDay), kind }]);
    setName('');
    setEvErr(null);
    notify(`${label}${josa(label, '을/를')} 넣었어요. 달력 수업에 나와요.`);
  };

  // ---- 아이 프로필 ----
  const [adding, setAdding] = useState(false);
  const [nick, setNick] = useState('');
  const [avatar, setAvatar] = useState<string>(AVATARS[1] as string);
  const [delP, setDelP] = useState<Profile | null>(null);

  const addProfile = async () => {
    if (nick.trim().length === 0) return;
    const np = await createProfile(nick, avatar);
    setAdding(false);
    setNick('');
    notify(`${np.avatar} ${np.nickname}${josa(np.nickname, '을/를')} 추가했어요. 진도 탭에서 시작 진단을 해 볼 수 있어요.`);
  };

  const removeProfile = async (target: Profile) => {
    await deleteProfile(target.id);
    setDelP(null);
    await reload({ keepScreen: true });
    notify(`${target.nickname}의 기록을 지웠어요.`);
  };

  return (
    <>
      <section className="sheet col">
        <h2>가족 날짜</h2>
        <p className="muted">생일이나 기념일을 넣으면 달력 문제에 나와요. 예: “엄마 생일은 3월 5일이에요. 무슨 요일일까요?”</p>
        {sorted.length > 0 && (
          <ul className="lrows">
            {sorted.map((e) => (
              <li key={e.id} className="lrow">
                <span className="emo" aria-hidden="true">
                  {KIND_EMOJI[e.kind]}
                </span>
                <div className="lmain">
                  <b>{e.label}</b>
                  <small>
                    {e.month}월 {e.day}일
                  </small>
                </div>
                <button type="button" className="btn small ghost" onClick={() => void setEvents(events.filter((x) => x.id !== e.id))} aria-label={`${e.label} 지우기`}>
                  지우기
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="col editor">
          <h3 className="subtitle">날짜 넣기</h3>
          <div className="seg" role="radiogroup" aria-label="종류">
            {(['birthday', 'anniversary'] as const).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>
                {KIND_EMOJI[k]} {KIND_LABEL[k]}
              </button>
            ))}
          </div>
          <label className="field">
            <span>누구의 {KIND_LABEL[kind]}인가요?</span>
            <input value={name} maxLength={8} placeholder="예: 엄마" onChange={(e) => setName(e.target.value)} autoComplete="off" />
          </label>
          <div className="row two">
            <label className="field">
              <span>월</span>
              <select
                value={month}
                onChange={(e) => {
                  const m = Number(e.target.value);
                  setMonth(m);
                  setDay((d) => Math.min(d, daysInMonth(2024, m)));
                }}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {m}월
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>일</span>
              <select value={Math.min(day, maxDay)} onChange={(e) => setDay(Number(e.target.value))}>
                {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}일
                  </option>
                ))}
              </select>
            </label>
          </div>
          {evErr && <p className="status warn">{evErr}</p>}
          <button type="button" className="btn go" onClick={() => void addEvent()}>
            넣기
          </button>
        </div>
      </section>

      <section className="sheet col">
        <h2>아이 프로필</h2>
        <p className="muted">형제자매가 함께 쓸 수 있어요. 별명만 적고, 기록은 아이마다 따로 쌓여요.</p>
        <ul className="lrows">
          {profiles.map((x) => (
            <li key={x.id} className={`lrow wrap${x.id === p.id ? ' now' : ''}`}>
              <span className="emo" aria-hidden="true">
                {x.avatar}
              </span>
              <div className="lmain">
                <b>{x.nickname}</b>
                <small>
                  Day {x.day} · 별 {x.stars}개
                </small>
              </div>
              {x.id === p.id && <span className="chip leaf">지금 사용 중</span>}
              {(x.id !== p.id || profiles.length > 1) && (
                <div className="lact">
                  {x.id !== p.id && (
                    <button
                      type="button"
                      className="btn small ghost"
                      onClick={() => {
                        selectProfile(x.id);
                        notify(`${x.nickname}${josa(x.nickname, '으로/로')} 바꿨어요.`);
                      }}
                    >
                      사용하기
                    </button>
                  )}
                  {profiles.length > 1 && (
                    <button type="button" className="btn small ghost" onClick={() => setDelP(x)} aria-label={`${x.nickname} 기록 지우기`}>
                      지우기
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
        {!adding && profiles.length < MAX_PROFILES && (
          <button type="button" className="btn ghost" onClick={() => setAdding(true)}>
            아이 추가하기
          </button>
        )}
        {adding && (
          <div className="col editor">
            <h3 className="subtitle">새 아이</h3>
            <label className="field">
              <span>별명</span>
              <input value={nick} maxLength={8} placeholder="예: 하윤" onChange={(e) => setNick(e.target.value)} autoComplete="off" />
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
            <div className="row two">
              <button type="button" className="btn ghost" onClick={() => setAdding(false)}>
                취소
              </button>
              <button type="button" className="btn go" disabled={nick.trim().length === 0} onClick={() => void addProfile()}>
                추가
              </button>
            </div>
          </div>
        )}
      </section>

      {delP && (
        <Confirm title={`${delP.nickname}의 기록을 지울까요?`} ok="지우기" tone="rose" onOk={() => void removeProfile(delP)} onCancel={() => setDelP(null)}>
          <p>
            {delP.avatar} {delP.nickname}의 진도, 별, 스티커, 마을, 풀이 기록이 모두 지워지고 되돌릴 수 없어요.
          </p>
          <p className="muted">필요하면 먼저 ‘기록’ 탭에서 파일로 내려받아 두세요.</p>
        </Confirm>
      )}
    </>
  );
}
