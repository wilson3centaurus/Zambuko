import type { Metadata, Viewport } from 'next';
import './globals.css';
import { GeistSans } from 'geist/font/sans';
import { ToastProvider } from '@/components/ui/Toast';
import { ThemeProvider } from '@/components/ThemeProvider';

export const metadata: Metadata = {
  title: 'Connect WiFi',
  description: 'Fast, affordable internet access — a Robokorda Africa initiative',
  applicationName: 'Connect WiFi',
  themeColor: '#1e40af',
  manifest: '/manifest.json',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#1e40af',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body>
        <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>
      </body>
    </html>
  );
}
