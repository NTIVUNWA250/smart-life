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
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply saved theme before paint to avoid a flash of the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: themeNoFlashScript }} />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
