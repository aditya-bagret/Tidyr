import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { themeVariables } from '@/lib/theme';
import { Providers } from './providers';
import './globals.css';

// Self-hosted by next/font at build time, so the CSP's font-src 'self' covers it.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: { default: 'Tidyr', template: '%s · Tidyr' },
  description: 'Projects and tasks, tidied up.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Reading the request makes every page render per request, which the CSP nonce needs (proxy.ts).
  await headers();

  return (
    <html lang="en" className={inter.variable} style={themeVariables()}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
