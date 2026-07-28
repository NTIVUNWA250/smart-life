'use client';

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Spinner } from './ui';
import { VuxIcon, VuxMark, type VuxIconName } from './vux/VuxIcon';

interface NavItem {
  href: string;
  label: string;
  /** Shorter label for the phone tab bar, where five items share the width. */
  short?: string;
  icon: VuxIconName;
  roles?: ReadonlyArray<'student' | 'approver' | 'admin'>;
}

/**
 * The rail carries everything; the phone tab bar carries the first five and the
 * rest fall into the overflow sheet. Five is a hard limit — a sixth tab makes
 * every target too narrow to hit.
 */
const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', short: 'Home', icon: 'home' },
  { href: '/approvals', label: 'Approvals', short: 'Approve', icon: 'approvals' },
  { href: '/notifications', label: 'Notifications', short: 'Alerts', icon: 'analytics' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
  { href: '/admin', label: 'Admin', icon: 'timetable', roles: ['admin'] },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <Spinner label="Loading your account…" />
      </div>
    );
  }
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <Spinner label="Redirecting to sign in…" />
      </div>
    );
  }

  const items = NAV.filter((i) => !i.roles || i.roles.includes(user.role));
  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-paper md:flex">
      {/* Desktop rail. Hidden on phones, where the tab bar takes over. */}
      <aside className="vux-rail sticky top-0 hidden h-screen w-56 shrink-0 md:flex">
        <div className="flex items-center gap-2.5 px-2 pb-5 pt-1">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-sm bg-brand font-display text-sm font-bold text-paper">
            S
          </span>
          <span className="font-display text-base font-semibold text-ink">SMART LIFE</span>
        </div>

        <nav className="flex flex-col gap-0.5" aria-label="Main">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? 'page' : undefined}
              className="vux-nav"
            >
              <span className="vux-nav-glyph">
                <VuxIcon name={item.icon} size={18} />
              </span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-2 border-t border-hairline pt-3">
          <div className="px-2">
            <div className="text-xs font-semibold text-ink">{user.name}</div>
            <div className="vux-label capitalize">{user.role}</div>
          </div>
          <span className="vux-credit px-2 pb-1">
            <VuxMark size={13} />
            Made by Vux · {year}
          </span>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phone header. The rail is gone here, so the product mark comes back. */}
        <header className="flex items-center gap-2.5 border-b border-hairline bg-surface px-4 py-3 md:hidden">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-sm bg-brand font-display text-xs font-bold text-paper">
            S
          </span>
          <span className="font-display text-sm font-semibold text-ink">SMART LIFE</span>
          <span className="vux-label ml-auto capitalize">{user.role}</span>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 pb-24 md:pb-8">{children}</main>

        <footer className="mx-auto hidden w-full max-w-5xl justify-end px-4 pb-6 md:flex">
          <span className="vux-credit">
            <VuxMark size={13} />
            Made by Vux · {year}
          </span>
        </footer>
      </div>

      {/* Phone tab bar. Fixed, so it survives a long scroll. */}
      <nav
        className="vux-tabbar fixed inset-x-0 bottom-0 z-40 md:hidden"
        aria-label="Main"
      >
        {items.slice(0, 5).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={pathname === item.href ? 'page' : undefined}
            className="vux-tab"
          >
            <VuxIcon name={item.icon} size={19} />
            {item.short ?? item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
