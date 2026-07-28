'use client';

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Spinner } from './ui';
import { VuxCredit } from './vux/VuxIcon';

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
  const { user, loading } = useAuth();
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
    // No `dark:` variants anywhere below. The VUX tokens already carry both
    // themes, so a colour cannot be right in one mode and wrong in the other.
    <div className="min-h-screen bg-paper">
      <header className="border-b border-hairline bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="font-display text-lg font-semibold text-brand">
              SMART LIFE
            </Link>
            <nav className="flex items-center gap-1">
              {items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`rounded px-3 py-1.5 text-xs font-semibold transition-hover ease-vux ${
                      active ? 'text-brand' : 'text-muted hover:text-ink'
                    }`}
                    style={
                      active
                        ? { background: 'color-mix(in srgb, var(--vux-brand) 12%, transparent)' }
                        : undefined
                    }
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="hidden text-right sm:block">
            <div className="text-xs font-semibold text-ink">{user.name}</div>
            <div className="vux-label capitalize">{user.role}</div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      <footer className="mx-auto flex max-w-5xl justify-end px-4 pb-6">
        <VuxCredit />
      </footer>
    </div>
  );
}
