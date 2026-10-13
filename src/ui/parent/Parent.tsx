'use client';

import { useState } from 'react';
import { sfx } from '@/audio/sfx';
import type { Profile } from '@/core/model';
import { backupDue } from '@/core/progress';
import { pendingWishes } from '@/core/wishes';
import { useStore } from '../store';
import { DataTab } from './DataTab';
import { FamilyTab } from './FamilyTab';
import { ProgressTab } from './ProgressTab';
import { RewardsTab } from './RewardsTab';
import { SettingsTab } from './SettingsTab';
import { TodayTab } from './TodayTab';

type Tab = 'today' | 'progress' | 'rewards' | 'settings' | 'family' | 'data';

const TABS: { id: Tab; label: string }[] = [
  { id: 'today', label: '오늘' },
  { id: 'progress', label: '진도' },
  { id: 'rewards', label: '보상' },
  { id: 'settings', label: '설정' },
  { id: 'family', label: '가족' },
  { id: 'data', label: '기록' },
];

/** 보호자 화면: 오늘 리포트, 진도, 보상, 설정, 가족, 기록 */
export function Parent() {
  const { profile, go, lastBackupAt } = useStore();
  const p = profile as Profile;
  const [tab, setTab] = useState<Tab>('today');
  const [toast, setToast] = useState<{ id: number; msg: string } | null>(null);
  const notify = (msg: string) => setToast({ id: Date.now(), msg });

  const dots: Partial<Record<Tab, boolean>> = {
    rewards: pendingWishes(p).length > 0,
    data: backupDue(p, lastBackupAt, Date.now()),
  };

  return (
    <main className="app parent">
      <div className="page">
        <header className="phead row">
          <h1 className="grow">보호자 메뉴</h1>
          <button type="button" className="btn small" onClick={() => go({ name: 'home' }, { replace: true })}>
            나가기
          </button>
        </header>

        <nav className="ptabs" role="tablist" aria-label="보호자 메뉴">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => {
                sfx.tap();
                setTab(t.id);
              }}
            >
              {t.label}
              {dots[t.id] && <i className="pdot" aria-label="확인할 것이 있어요" />}
            </button>
          ))}
        </nav>

        {tab === 'today' && <TodayTab notify={notify} />}
        {tab === 'progress' && <ProgressTab notify={notify} />}
        {tab === 'rewards' && <RewardsTab notify={notify} />}
        {tab === 'settings' && <SettingsTab notify={notify} />}
        {tab === 'family' && <FamilyTab notify={notify} />}
        {tab === 'data' && <DataTab notify={notify} />}

        {toast && (
          <div key={toast.id} className="toast" role="status" onAnimationEnd={() => setToast(null)}>
            {toast.msg}
          </div>
        )}
      </div>
    </main>
  );
}
