'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AppShell } from '@/components/AppShell';
import { Alert, Badge, Button, Card, Field, Input, Select, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import type {
  Approval,
  PeerLinkAsApprover,
  PeerLinkAsStudent,
  PeerRelationship,
} from '@/lib/types';

export default function ApprovalsPage() {
  return (
    <AppShell>
      <Approvals />
    </AppShell>
  );
}

function Approvals() {
  const [incoming, setIncoming] = useState<Approval[]>([]);
  const [asStudent, setAsStudent] = useState<PeerLinkAsStudent[]>([]);
  const [asApprover, setAsApprover] = useState<PeerLinkAsApprover[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [approvals, peers] = await Promise.all([
        api.approvals.list('approver'),
        api.peers.list(),
      ]);
      setIncoming(approvals.items);
      setAsStudent(peers.asStudent);
      setAsApprover(peers.asApprover);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Spinner label="Loading approvals…" />;
  if (error) return <Alert tone="error">{error}</Alert>;

  return (
    <div className="space-y-6">
      <IncomingApprovals approvals={incoming} onDone={load} />
      <IncomingLinks links={asApprover} onDone={load} />
      <MyApprovers links={asStudent} onDone={load} />
    </div>
  );
}

function IncomingApprovals({
  approvals,
  onDone,
}: {
  approvals: Approval[];
  onDone: () => Promise<void>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const pending = approvals.filter((a) => a.status === 'pending');

  async function decide(id: string, status: 'approved' | 'denied') {
    setBusyId(id);
    try {
      await api.approvals.decide(id, status);
      await onDone();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card title="Override requests for you to review">
      {pending.length === 0 ? (
        <p className="text-sm text-slate-500">No pending override requests.</p>
      ) : (
        <ul className="space-y-3">
          {pending.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between rounded-lg border border-slate-100 p-3"
            >
              <div>
                <div className="text-sm font-medium text-slate-800">
                  {a.requester.name} · <Badge tone="blue">{a.kind}</Badge>
                </div>
                <div className="text-xs text-slate-500">
                  {a.reason ?? 'No reason given'} · {formatDate(a.createdAt)}
                </div>
              </div>
              <div className="flex gap-2">
                <Button disabled={busyId === a.id} onClick={() => void decide(a.id, 'approved')}>
                  Approve
                </Button>
                <Button
                  variant="danger"
                  disabled={busyId === a.id}
                  onClick={() => void decide(a.id, 'denied')}
                >
                  Deny
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function IncomingLinks({
  links,
  onDone,
}: {
  links: PeerLinkAsApprover[];
  onDone: () => Promise<void>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const pending = links.filter((l) => l.status === 'pending');

  async function decide(id: string, status: 'accepted' | 'rejected') {
    setBusyId(id);
    try {
      await api.peers.decide(id, status);
      await onDone();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card title="People asking you to be their approver">
      {pending.length === 0 ? (
        <p className="text-sm text-slate-500">No pending link requests.</p>
      ) : (
        <ul className="space-y-3">
          {pending.map((l) => (
            <li
              key={l.id}
              className="flex items-center justify-between rounded-lg border border-slate-100 p-3"
            >
              <div>
                <div className="text-sm font-medium text-slate-800">{l.student.name}</div>
                <div className="text-xs text-slate-500">
                  {l.student.email} · wants you as <strong>{l.relationship}</strong>
                </div>
              </div>
              <div className="flex gap-2">
                <Button disabled={busyId === l.id} onClick={() => void decide(l.id, 'accepted')}>
                  Accept
                </Button>
                <Button
                  variant="secondary"
                  disabled={busyId === l.id}
                  onClick={() => void decide(l.id, 'rejected')}
                >
                  Reject
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function MyApprovers({
  links,
  onDone,
}: {
  links: PeerLinkAsStudent[];
  onDone: () => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [relationship, setRelationship] = useState<PeerRelationship>('peer');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.peers.link(email, relationship);
      setEmail('');
      await onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Your approvers (peers & parents)">
      <form onSubmit={submit} className="mb-4 flex flex-wrap items-end gap-3">
        {error && (
          <div className="w-full">
            <Alert tone="error">{error}</Alert>
          </div>
        )}
        <Field label="Approver email">
          <Input
            type="email"
            required
            placeholder="parent@smartlife.rw"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Relationship">
          <Select
            value={relationship}
            onChange={(e) => setRelationship(e.target.value as PeerRelationship)}
          >
            <option value="peer">Peer</option>
            <option value="parent">Parent</option>
          </Select>
        </Field>
        <Button type="submit" disabled={busy}>
          {busy ? 'Sending…' : 'Request link'}
        </Button>
      </form>
      {links.length === 0 ? (
        <p className="text-sm text-slate-500">You haven&apos;t linked any approvers yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {links.map((l) => (
            <li key={l.id} className="flex items-center justify-between py-2">
              <div>
                <div className="text-sm font-medium text-slate-800">{l.approver.name}</div>
                <div className="text-xs text-slate-500">
                  {l.approver.email} · {l.relationship}
                </div>
              </div>
              <Badge
                tone={l.status === 'accepted' ? 'green' : l.status === 'rejected' ? 'red' : 'amber'}
              >
                {l.status}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
