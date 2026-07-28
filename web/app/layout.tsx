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
    // data-product selects the VUX ground and accent. SMART LIFE is finance:
    // plum accent on a plum-tinted paper. See design-system/vux.css.
    <html lang="en" data-product="finance" suppressHydrationWarning>
      <head>
        {/* Apply saved theme before paint to avoid a flash of the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: themeNoFlashScript }} />
        {/* Slab House: Zilla Slab / Poppins / IBM Plex Mono. Loaded by link
            rather than next/font so the build never depends on the network —
            vux.css declares full fallback stacks either way. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@500;600;700&family=Poppins:wght@400;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
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
