'use client';

import { useEffect } from 'react';
import { unlockAudio } from '@/audio/sfx';
import { watchInstall } from './install';
import { Diagnostic } from './diagnostic/Diagnostic';
import { Home } from './Home';
import { BossRunner } from './lesson/BossRunner';
import { ExtraRunner } from './lesson/ExtraRunner';
import { LessonRunner } from './lesson/LessonRunner';
import { Parent } from './parent/Parent';
import { Stickers } from './rewards/Stickers';
import { Village } from './rewards/Village';
import { StoreProvider, useStore } from './store';
import { Wizard } from './Wizard';

function Screens() {
  const { ready, screen, profile } = useStore();

  useEffect(() => {
    watchInstall();
    // 브라우저는 첫 터치 뒤에만 소리를 허락한다
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  if (!ready) {
    return (
      <main className="app">
        <div className="page" style={{ justifyContent: 'center', alignItems: 'center' }}>
          <p className="display muted" style={{ fontSize: '1.4rem' }}>
            100일 수학
          </p>
        </div>
      </main>
    );
  }
  if (screen.name === 'setup' || !profile) return <Wizard />;
  switch (screen.name) {
    case 'lesson':
      return <LessonRunner key={`l${screen.day}-${screen.n ?? 0}`} day={screen.day} />;
    case 'boss':
      return <BossRunner key={`b${screen.block}-${screen.n ?? 0}-${screen.skip ? 's' : ''}`} block={screen.block} skip={!!screen.skip} />;
    case 'extra':
      return <ExtraRunner key={`x${screen.n ?? 0}`} />;
    case 'diagnostic':
      return <Diagnostic key={`d${screen.n ?? 0}`} />;
    case 'parent':
      return <Parent />;
    case 'stickers':
      return <Stickers />;
    case 'village':
      return <Village key={screen.tab ?? 'town'} tab={screen.tab} />;
    default:
      return <Home />;
  }
}

export function App() {
  return (
    <StoreProvider>
      <Screens />
    </StoreProvider>
  );
}
