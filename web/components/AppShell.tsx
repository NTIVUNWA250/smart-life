'use client';

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Spinner, Button } from './ui';
import { ThemeToggle } from './ThemeToggle';

interface NavItem {
  href: string;
  label: string;
  roles?: ReadonlyArray<'student' | 'approver' | 'admin'>;
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/approvals', label: 'Approvals' },
  { href: '/notifications', label: 'Notifications' },
  { href: '/settings', label: 'Settings' },
  { href: '/admin', label: 'Admin', roles: ['admin'] },
];

/**
 * Wraps authenticated pages: redirects unauthenticated users to /login and
 * renders the shared nav + logout.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label="Loading your account…" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label="Redirecting to sign in…" />
      </div>
    );
  }

  const items = NAV.filter((item) => !item.roles || item.roles.includes(user.role));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-lg font-bold text-brand-700 dark:text-brand-300">
              SMART LIFE
            </Link>
            <nav className="flex items-center gap-1">
              {items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                      active
                        ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{user.name}</div>
              <div className="text-xs capitalize text-slate-500 dark:text-slate-400">{user.role}</div>
            </div>
            <Button variant="secondary" onClick={() => void logout()}>
              Log out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
