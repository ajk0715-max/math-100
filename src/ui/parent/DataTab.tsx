'use client';

import { useEffect, useRef, useState } from 'react';
import { BACKUP_DAYS, backupDue } from '@/core/progress';
import type { Profile } from '@/core/model';
import { attemptsToCsv } from '@/core/report';
import { attemptsOf, exportAll, importAll, isBackup, requestPersistence, type BackupFile } from '@/db/repo';
import { isStandalone, platform } from '../install';
import { useStore } from '../store';
import { Confirm, agoText, saveFile, type Notify } from './shared';

/** 기록: 백업 파일, 풀이 기록(CSV), 불러오기 */
export function DataTab({ notify }: { notify: Notify }) {
  const { profile, today, lastBackupAt, markBackup, reload } = useStore();
  const p = profile as Profile;
  const file = useRef<HTMLInputElement | null>(null);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [standalone, setStandalone] = useState(true);
  const [ios, setIos] = useState(false);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const now = Date.now();
  const due = backupDue(p, lastBackupAt, now);

  useEffect(() => {
    setStandalone(isStandalone());
    setIos(platform() === 'ios');
    void (async () => {
      try {
        setPersisted((await navigator.storage?.persisted?.()) ?? null);
      } catch {
        setPersisted(null);
      }
    })();
  }, []);

  const downloadJson = async () => {
    const b = await exportAll();
    saveFile(`100일수학-기록-${today}.json`, new Blob([JSON.stringify(b)], { type: 'application/json' }));
    await markBackup();
    notify('기록 파일을 내려받았어요. 안전한 곳에 보관해 주세요.');
  };

  const downloadCsv = async () => {
    const rows = await attemptsOf(p.id);
    if (rows.length === 0) {
      notify('아직 풀이 기록이 없어요.');
      return;
    }
    saveFile(`100일수학-풀이-${p.nickname}-${today}.csv`, new Blob([attemptsToCsv(rows)], { type: 'text/csv;charset=utf-8' }));
    notify('풀이 기록(CSV)을 내려받았어요. 엑셀이나 구글 시트에서 열 수 있어요.');
  };

  const onFile = async (f: File | undefined) => {
    setErr(null);
    if (!f) return;
    try {
      const data: unknown = JSON.parse(await f.text());
      if (!isBackup(data)) {
        setErr('이 앱의 기록 파일이 아니에요. ‘100일수학-기록-날짜.json’ 파일을 골라 주세요.');
        return;
      }
      setPending(data);
    } catch {
      setErr('파일을 읽을 수 없어요. 내려받은 기록 파일이 맞는지 확인해 주세요.');
    } finally {
      if (file.current) file.current.value = '';
    }
  };

  const restore = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await importAll(pending);
      setPending(null);
      await reload();
      notify('기록을 불러왔어요.');
    } catch {
      setErr('기록을 불러오다가 문제가 생겼어요. 현재 기록은 그대로예요.');
      setPending(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="sheet col">
        <h2>기록 보관</h2>
        <p className="muted">기록은 이 기기 안에만 저장돼요. 기기를 바꾸거나 브라우저 데이터를 지우기 전에 파일로 내려받아 두세요.</p>
        <p className={`status ${due ? 'warn' : 'ok'}`}>
          {lastBackupAt > 0 ? `마지막으로 내려받은 때: ${agoText(lastBackupAt, now)}.` : '아직 내려받은 적이 없어요.'}
          {due && ` ${BACKUP_DAYS}일이 지났어요. 지금 내려받아 두세요.`}
        </p>
        <button type="button" className="btn grape" onClick={() => void downloadJson()}>
          기록 파일(.json) 내려받기
        </button>
        <button type="button" className="btn ghost" onClick={() => void downloadCsv()}>
          {p.nickname}의 풀이 기록(.csv) 내려받기
        </button>
        <p className="fine">.json은 다시 불러올 수 있는 전체 백업이고, .csv는 문제마다 맞고 틀린 것을 표로 본 거예요.</p>
      </section>

      <section className="sheet col">
        <h2>기록 불러오기</h2>
        <p className="muted">내려받은 기록 파일로 되돌려요. 이 기기의 지금 기록은 모두 파일의 기록으로 바뀌고, PIN도 파일에 있던 것으로 돌아가요.</p>
        <button type="button" className="btn ghost" onClick={() => file.current?.click()}>
          파일 골라서 불러오기
        </button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
        {err && <p className="status warn">{err}</p>}
      </section>

      <section className="sheet col">
        <h2>저장 상태</h2>
        <p className={`status ${standalone || !ios ? 'ok' : 'warn'}`}>
          {standalone
            ? '홈 화면에 추가한 앱으로 쓰고 있어요. 기록이 더 안전해요.'
            : ios
              ? '홈 화면에 추가하지 않으면 사파리가 일주일 이상 열지 않은 기록을 지울 수 있어요. 공유 단추에서 ‘홈 화면에 추가’를 해 두세요.'
              : '홈 화면에 추가하면 앱처럼 바로 열리고, 인터넷이 없어도 쓸 수 있어요.'}
        </p>
        {persisted === false && (
          <>
            <p className="muted">브라우저가 저장 공간이 모자랄 때 기록을 정리할 수도 있어요.</p>
            <button
              type="button"
              className="btn ghost"
              onClick={() =>
                void requestPersistence().then((ok) => {
                  setPersisted(ok);
                  notify(ok ? '기록을 지우지 않도록 브라우저에 부탁했어요.' : '브라우저가 허락하지 않았어요. 기록 파일을 자주 내려받아 주세요.');
                })
              }
            >
              기록 지우지 않게 부탁하기
            </button>
          </>
        )}
        {persisted === true && <p className="muted">브라우저가 이 기록을 지우지 않도록 보호하고 있어요.</p>}
      </section>

      {pending && (
        <Confirm title="이 기록으로 바꿀까요?" ok={busy ? '불러오는 중…' : '바꾸기'} tone="rose" onOk={() => void restore()} onCancel={() => setPending(null)}>
          <p>
            아이 {pending.profiles.length}명 · 수업 {pending.sessions.length}개 · 풀이 {pending.attempts.length}개
            <br />
            <span className="muted">{new Date(pending.exportedAt).toLocaleString('ko-KR')}에 내려받은 파일이에요.</span>
          </p>
          <p className="status warn">이 기기의 지금 기록은 모두 사라지고 되돌릴 수 없어요.</p>
        </Confirm>
      )}
    </>
  );
}
