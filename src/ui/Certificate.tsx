'use client';

import { useState } from 'react';
import { sfx } from '@/audio/sfx';
import { CERT_NAME_MAX, certificateInfo, cleanCertName } from '@/core/certificate';
import { josa } from '@/core/ko';
import type { Profile } from '@/core/model';
import { Stamp } from './parts/Stamp';
import { RHead } from './rewards/RHead';
import { useStore } from './store';

/** 이름 글자 수에 맞춰 글자 크기를 줄인다(증서 너비의 %) */
const nameSize = (len: number): number => Math.min(11, 74 / Math.max(1, len));

/** 100일 수료증: 화면에서 보고, 인쇄하거나 PDF로 저장한다(A4 세로) */
export function Certificate() {
  const { profile, today, go, update } = useStore();
  const p = profile as Profile;
  const [draft, setDraft] = useState(p.certName ?? '');
  const shown = { ...p, certName: draft };
  const info = certificateInfo(shown, today);
  const len = Array.from(info.name).length;

  if (!info.earned) {
    return (
      <main className="app certscreen">
        <div className="page">
          <RHead title="수료증" />
          <section className="sheet col center">
            <span className="emo" style={{ fontSize: '3.4rem', lineHeight: 1.1 }}>
              🎓
            </span>
            <h2>아직 받을 수 없어요</h2>
            <p className="muted">100일째 마지막 보스를 이기면 수료증이 열려요. 조금만 더 힘내요!</p>
          </section>
        </div>
      </main>
    );
  }

  const print = () => {
    sfx.tap();
    try {
      window.print();
    } catch {
      /* 인쇄를 지원하지 않는 환경에서는 안내 문구로 대신한다 */
    }
  };

  return (
    <main className="app certscreen">
      <div className="page">
        <div className="noprint">
          <RHead title="수료증" />
        </div>

        <article className="cert" aria-label={`${info.name} 수료증`}>
          <div className="cert-frame">
            <span className="cert-deco tl" aria-hidden="true">
              🎉
            </span>
            <span className="cert-deco tr" aria-hidden="true">
              🎉
            </span>
            <p className="cert-brand">100일 수학 · 수 · 달력 · 시계</p>
            <h1 className="cert-title">수료증</h1>

            <div className="cert-who">
              <span className="emo cert-avatar">{p.avatar}</span>
              <p className="cert-name" style={{ ['--ns' as string]: `${nameSize(len)}cqw` }}>
                {info.name}
              </p>
            </div>

            <p className="cert-body">
              위 어린이는 100일 동안 수와 달력과 시계를 끝까지 배워 마지막 보스를 이겼으므로 이 증서를 드립니다.
            </p>

            <ul className="cert-stats" aria-label="100일 기록">
              <li>
                <b>{info.days}일</b>
                <span>함께 공부한 날</span>
              </li>
              <li>
                <b>{info.stars}개</b>
                <span>모은 별</span>
              </li>
              <li>
                <b>{info.stickerCount}장</b>
                <span>{info.goldCount > 0 ? `스티커(금테 ${info.goldCount})` : '모은 스티커'}</span>
              </li>
            </ul>

            <ol className="cert-stickers" aria-label="스티커">
              {info.stickers.map((s) => (
                <li key={s.n} className={s.kind ? `got ${s.kind}` : 'empty'} aria-label={s.kind ? `${s.name} 스티커` : `${s.n}단계 스티커 없음`}>
                  <span className="emo">{s.emoji}</span>
                </li>
              ))}
            </ol>

            <div className="cert-foot">
              <div className="cert-date">
                <p>{info.dateText}</p>
                <span className="cert-sign">보호자 확인</span>
              </div>
              <Stamp lines={['수료']} className="cert-stamp" play={false} />
            </div>
          </div>
        </article>

        <section className="sheet col noprint">
          <label className="field">
            <span>수료증에 쓸 이름</span>
            <input
              type="text"
              value={draft}
              placeholder={p.nickname}
              autoComplete="off"
              enterKeyHint="done"
              onChange={(e) => {
                const v = e.target.value;
                setDraft(v);
                update((x) => ({ ...x, certName: cleanCertName(v) }));
              }}
            />
            <small>
              비워 두면 ‘{p.nickname}’{josa(p.nickname, '으로/로')} 나와요. {CERT_NAME_MAX}글자까지 들어가요.
            </small>
          </label>
          <button type="button" className="btn go block" onClick={print}>
            인쇄하기 · PDF로 저장
          </button>
          <p className="fine">
            인쇄 화면에서 ‘PDF로 저장’을 고르면 파일로 남길 수 있어요. 인쇄 단추가 반응하지 않으면 화면을 캡처해서 보관해 주세요.
          </p>
          <button
            type="button"
            className="btn ghost block"
            onClick={() => {
              sfx.tap();
              go({ name: 'home' }, { replace: true });
            }}
          >
            홈으로
          </button>
        </section>
      </div>
    </main>
  );
}
