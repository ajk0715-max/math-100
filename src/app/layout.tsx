import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@fontsource/gowun-dodum/400.css';
import '@fontsource/do-hyeon/400.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/ui.css';
import './styles/visual.css';
import './styles/question.css';
import './styles/screens.css';
import './styles/lesson.css';
import './styles/home.css';
import './styles/games.css';
import './styles/parent.css';
import { RegisterSW } from '@/ui/RegisterSW';

export const metadata: Metadata = {
  title: '100일 수학',
  description: '초등 입학을 앞둔 아이를 위한 100일 수학·시계·달력 학습',
  applicationName: '100일 수학',
  appleWebApp: { capable: true, title: '100일 수학', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f4f6fb',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
