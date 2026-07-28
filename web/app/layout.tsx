import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { ThemeProvider, themeNoFlashScript } from '@/lib/theme';

export const metadata: Metadata = {
  title: 'SMART LIFE',
  description: 'Money + time management for Rwandan students. Stop spending, start saving.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // data-product selects the VUX ground and accent, and the display face with
    // it. Education: violet accent on a violet-tinted paper, set in Aleo — the
    // softer slab, because this is a product people read in. design-system/vux.css.
    <html lang="en" data-product="education" suppressHydrationWarning>
      <head>
        {/* Apply saved theme before paint to avoid a flash of the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: themeNoFlashScript }} />
        {/* The education stack: Aleo display, Poppins interface, JetBrains Mono
            for labels and figures. Five weights, no more — every extra file is a
            real cost on a Rwandan mobile connection. Loaded by link rather than
            next/font so the build never depends on the network; vux.css declares
            full fallback stacks either way. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Aleo:wght@500;600;700&family=Poppins:wght@400;600&family=JetBrains+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
