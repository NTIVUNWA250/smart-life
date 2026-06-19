'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { Alert, Badge, Card, Select, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import type { AdminUser, Role } from '@/lib/types';

export default function AdminPage() {
  return (
    <AppShell>
      <Admin />
    </AppShell>
  );
}

function Admin() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.admin.users();
      setUsers(res.items);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function changeRole(id: string, role: Role) {
    setBusyId(id);
    try {
      await api.admin.updateUser(id, { role });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  // Defensive: AppShell already hides the nav link, but guard the page too.
  if (user && user.role !== 'admin') {
    return <Alert tone="warning">This page is for administrators only.</Alert>;
  }
  if (loading) return <Spinner label="Loading users…" />;
  if (error) return <Alert tone="error">{error}</Alert>;

  return (
    <Card title="User management">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Role</th>
              <th className="py-2 pr-4">Minor</th>
              <th className="py-2 pr-4">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-100">
                <td className="py-2 pr-4 font-medium text-slate-800">{u.name}</td>
                <td className="py-2 pr-4 text-slate-600">{u.email}</td>
                <td className="py-2 pr-4">
                  <Select
                    value={u.role}
                    disabled={busyId === u.id || u.id === user?.id}
                    onChange={(e) => void changeRole(u.id, e.target.value as Role)}
                    className="w-36"
                  >
                    <option value="student">Student</option>
                    <option value="approver">Approver</option>
                    <option value="admin">Admin</option>
                  </Select>
                </td>
                <td className="py-2 pr-4">
                  {u.isMinor ? <Badge tone="amber">minor</Badge> : <span className="text-slate-400">—</span>}
                </td>
                <td className="py-2 pr-4 text-slate-500">{formatDate(u.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
