import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '매일혈압 · 나와 가족의 작은 건강 습관',
  description: '간편하게 혈압을 기록하고, 매일의 변화를 살펴보세요.',
  appleWebApp: { capable: true, title: '매일혈압', statusBarStyle: 'default' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, interactiveWidget: 'resizes-content', themeColor: '#f7f8f5' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
