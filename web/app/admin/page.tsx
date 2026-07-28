'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { Alert, Badge, Button, Card, Input, Select, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import type { AdminUser, AuditLogEntry, AuditSummaryEntry, Role } from '@/lib/types';

export default function AdminPage() {
  const { user } = useAuth();
  // Defensive: AppShell already hides the nav link, but guard the page too.
  if (user && user.role !== 'admin') {
    return (
      <AppShell>
        <Alert tone="warning">This page is for administrators only.</Alert>
      </AppShell>
    );
  }
  return (
    <AppShell>
      <div className="space-y-6">
        <Admin />
        <AuditLog />
      </div>
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

  if (loading) return <Spinner label="Loading users…" />;
  if (error) return <Alert tone="error">{error}</Alert>;

  return (
    <Card title="User management">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-hairline text-xs uppercase tracking-wide text-muted">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Role</th>
              <th className="py-2 pr-4">Minor</th>
              <th className="py-2 pr-4">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-hairline">
                <td className="py-2 pr-4 font-medium text-ink">{u.name}</td>
                <td className="py-2 pr-4 text-muted">{u.email}</td>
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
                  {u.isMinor ? <Badge tone="amber">minor</Badge> : <span className="text-muted">—</span>}
                </td>
                <td className="py-2 pr-4 text-muted">{formatDate(u.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// NFR4: auditable trail with filtering + CSV report export.
function AuditLog() {
  const [items, setItems] = useState<AuditLogEntry[]>([]);
  const [summary, setSummary] = useState<AuditSummaryEntry[]>([]);
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async (action: string) => {
    setLoading(true);
    setError(null);
    try {
      const [log, sum] = await Promise.all([
        api.admin.audit(action ? { action } : undefined),
        api.admin.auditSummary(),
      ]);
      setItems(log.items);
      setSummary(sum.items);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load('');
  }, [load]);

  async function exportCsv() {
    setExporting(true);
    try {
      const blob = await api.admin.downloadAuditCsv(actionFilter ? { action: actionFilter } : undefined);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'audit-report.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  return (
    <Card title="Audit log">
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <Select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            void load(e.target.value);
          }}
          className="w-56"
        >
          <option value="">All actions</option>
          {summary.map((s) => (
            <option key={s.action} value={s.action}>
              {s.action} ({s.count})
            </option>
          ))}
        </Select>
        <Button variant="secondary" onClick={() => void exportCsv()} disabled={exporting}>
          {exporting ? 'Exporting…' : 'Export CSV'}
        </Button>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {loading ? (
        <Spinner label="Loading audit log…" />
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">No audit entries yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-hairline text-xs uppercase tracking-wide text-muted">
                <th className="py-2 pr-4">When</th>
                <th className="py-2 pr-4">Action</th>
                <th className="py-2 pr-4">User</th>
                <th className="py-2 pr-4">Detail</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id} className="border-b border-hairline">
                  <td className="py-2 pr-4 text-muted">{new Date(e.createdAt).toLocaleString()}</td>
                  <td className="py-2 pr-4">
                    <Badge tone="slate">{e.action}</Badge>
                  </td>
                  <td className="py-2 pr-4 font-mono text-xs text-muted">{e.userId ?? '—'}</td>
                  <td className="py-2 pr-4 text-muted">{e.detail ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
