'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { Alert, Badge, Button, Card, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import type { Notification, NotificationType } from '@/lib/types';

const READ_KEY = 'smartlife.readNotifications';

function loadRead(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    return new Set(JSON.parse(window.localStorage.getItem(READ_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

const TONE: Record<NotificationType, 'green' | 'red' | 'amber'> = {
  approval: 'green',
  denial: 'red',
  reminder: 'amber',
};

const LABEL: Record<NotificationType, string> = {
  approval: 'Approved',
  denial: 'Denied',
  reminder: 'Reminder',
};

export default function NotificationsPage() {
  return (
    <AppShell>
      <NotificationsView />
    </AppShell>
  );
}

function NotificationsView() {
  const [items, setItems] = useState<Notification[]>([]);
  const [read, setRead] = useState<Set<string>>(() => loadRead());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.notifications.list();
      setItems(res.items);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function persist(next: Set<string>) {
    setRead(new Set(next));
    window.localStorage.setItem(READ_KEY, JSON.stringify([...next]));
  }

  function markAllRead() {
    persist(new Set(items.map((i) => i.id)));
  }

  if (loading) return <Spinner label="Loading notifications…" />;

  const unread = items.filter((i) => !read.has(i.id)).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-ink">
          Notifications {unread > 0 && <Badge tone="blue">{unread} new</Badge>}
        </h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => void load()}>
            Refresh
          </Button>
          {unread > 0 && (
            <Button variant="secondary" onClick={markAllRead}>
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {items.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">You&apos;re all caught up. ◉</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {items.map((n) => {
            const isUnread = !read.has(n.id);
            return (
              <li key={n.id}>
                <Card className={isUnread ? 'border-l-4 border-l-brand' : ''}>
                  <button
                    type="button"
                    onClick={() => persist(new Set(read).add(n.id))}
                    className="block w-full text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge tone={TONE[n.type]}>{LABEL[n.type]}</Badge>
                        <span className="font-medium text-ink">
                          {n.title}
                        </span>
                      </div>
                      <span className="text-xs text-muted">
                        {formatDate(n.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted">{n.body}</p>
                  </button>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
