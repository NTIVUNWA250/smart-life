'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AppShell } from '@/components/AppShell';
import { Alert, Badge, Button, Card, Field, Input, Select, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { appLabel } from '@/lib/apps';
import { errorMessage } from '@/lib/errors';
import { formatDate, formatRwf } from '@/lib/format';
import type {
  Approval,
  ApprovalKind,
  DailyStatus,
  PeerLinkAsApprover,
  PeerLinkAsStudent,
  PeerRelationship,
  ScreenTimePolicy,
  SpendingLimit,
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
  const [outgoing, setOutgoing] = useState<Approval[]>([]);
  const [asStudent, setAsStudent] = useState<PeerLinkAsStudent[]>([]);
  const [asApprover, setAsApprover] = useState<PeerLinkAsApprover[]>([]);
  const [limit, setLimit] = useState<SpendingLimit | null>(null);
  const [daily, setDaily] = useState<DailyStatus | null>(null);
  const [policies, setPolicies] = useState<ScreenTimePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [approvals, mine, peers, current, screentime] = await Promise.all([
        api.approvals.list('approver'),
        api.approvals.list('requester'),
        api.peers.list(),
        api.limits.current(),
        api.screentime.policies(),
      ]);
      setIncoming(approvals.items);
      setOutgoing(mine.items);
      setAsStudent(peers.asStudent);
      setAsApprover(peers.asApprover);
      setLimit(current.limit);
      setDaily(current.daily);
      setPolicies(screentime.items);
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
      <RequestOverride
        approvers={asStudent}
        limit={limit}
        daily={daily}
        policies={policies}
        onDone={load}
      />
      <MyRequests approvals={outgoing} />
      <IncomingApprovals approvals={incoming} onDone={load} />
      <IncomingLinks links={asApprover} onDone={load} />
      <MyApprovers links={asStudent} onDone={load} />
    </div>
  );
}

/**
 * The requester's half of FR6, which had no UI at all: the endpoint existed and
 * `api.approvals.create` was defined, but nothing called it. A student who hit
 * their limit could be blocked with no way to ask anyone to lift it.
 */
function RequestOverride({
  approvers,
  limit,
  daily,
  policies,
  onDone,
}: {
  approvers: PeerLinkAsStudent[];
  limit: SpendingLimit | null;
  daily: DailyStatus | null;
  policies: ScreenTimePolicy[];
  onDone: () => Promise<void>;
}) {
  // Only an accepted link can receive a request - the API rejects the rest.
  const usable = approvers.filter((l) => l.status === 'accepted');
  const blockedPolicies = policies.filter((p) => p.isBlocked);

  const [approverId, setApproverId] = useState('');
  const [kind, setKind] = useState<ApprovalKind>('spending');
  const [policyId, setPolicyId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSent(false);
    setBusy(true);
    try {
      // Spending overrides apply to the whole period, so the current limit is the
      // target; screen-time overrides unblock one specific policy.
      const targetId = kind === 'spending' ? limit?.id : policyId;
      if (!targetId) {
        throw new Error(
          kind === 'spending'
            ? 'No spending limit for this period yet.'
            : 'Choose which app limit you want lifted.',
        );
      }
      await api.approvals.create({
        approverId,
        kind,
        targetId,
        reason: reason.trim() || undefined,
      });
      setReason('');
      setSent(true);
      await onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  // Mirrors the three refusals in limits.checkPayment. Keying this off isBlocked
  // alone was wrong: the daily-budget refusal is by far the most common one and
  // never sets that flag, so the card stayed silent for the exact case it exists
  // for. Screen-time blocks are surfaced too - they refuse a different thing.
  const overDaily = daily ? daily.spentTodayRwf >= daily.allowanceRwf : false;
  const overPeriod = limit ? limit.spentRwf >= limit.limitRwf : false;
  const spendingStuck = Boolean(limit?.isBlocked) || overDaily || overPeriod;

  const why = limit?.isBlocked
    ? 'Spending on your account is blocked.'
    : overPeriod
      ? "You've reached your spending limit for this period."
      : `You've used today's budget of ${formatRwf(daily?.allowanceRwf ?? 0)}.`;

  return (
    <Card title="Ask for more room" id="ask-for-more-room">
      {limit?.overridePending ? (
        <div className="mb-4">
          <Alert tone="success">
            You already have an approved override waiting. It covers one expense that
            would otherwise be refused, and is used up as soon as you record it.
          </Alert>
        </div>
      ) : (
        spendingStuck && (
          <div className="mb-4">
            <Alert tone="warning">
              {why} Further expenses are refused until a peer or parent approves an
              override - one approval covers one expense.
            </Alert>
          </div>
        )
      )}

      {blockedPolicies.length > 0 && (
        <div className="mb-4">
          <Alert tone="warning">
            {blockedPolicies.length === 1
              ? `${appLabel(blockedPolicies[0].appOrSite, blockedPolicies[0].label)} is over its daily limit and blocked.`
              : `${blockedPolicies.length} apps are over their daily limit and blocked.`}{' '}
            An approval clears the block and resets the timer for the rest of the day.
          </Alert>
        </div>
      )}

      {usable.length === 0 ? (
        <p className="text-sm text-muted">
          You need an approver before you can request an override. Add one under{' '}
          <strong>Your approvers</strong> below, and ask them to accept.
        </p>
      ) : (
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
          {error && (
            <div className="w-full">
              <Alert tone="error">{error}</Alert>
            </div>
          )}
          {sent && (
            <div className="w-full">
              <Alert tone="success">Request sent. You&apos;ll see it below as pending.</Alert>
            </div>
          )}
          <Field label="Ask">
            <Select
              required
              value={approverId}
              onChange={(e) => setApproverId(e.target.value)}
            >
              <option value="">Choose an approver…</option>
              {usable.map((l) => (
                <option key={l.id} value={l.approver.id}>
                  {l.approver.name} ({l.relationship})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="To lift">
            <Select value={kind} onChange={(e) => setKind(e.target.value as ApprovalKind)}>
              <option value="spending">My spending limit</option>
              <option value="screentime">An app limit</option>
            </Select>
          </Field>
          {kind === 'screentime' && (
            <Field label="Which app">
              <Select required value={policyId} onChange={(e) => setPolicyId(e.target.value)}>
                <option value="">Choose…</option>
                {(blockedPolicies.length > 0 ? blockedPolicies : policies).map((p) => (
                  <option key={p.id} value={p.id}>
                    {appLabel(p.appOrSite, p.label)}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Reason (optional)">
            <Input
              placeholder="Textbooks for next term"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? 'Sending…' : 'Send request'}
          </Button>
        </form>
      )}
    </Card>
  );
}

function MyRequests({ approvals }: { approvals: Approval[] }) {
  return (
    <Card title="Your requests">
      {approvals.length === 0 ? (
        <p className="text-sm text-muted">You haven&apos;t asked for an override yet.</p>
      ) : (
        <ul className="divide-y divide-hairline">
          {approvals.map((a) => (
            <li key={a.id} className="flex items-center justify-between py-2">
              <div>
                <div className="text-sm font-medium text-ink">
                  {a.kind === 'spending' ? 'Spending limit' : 'App limit'} · {a.approver.name}
                </div>
                <div className="text-xs text-muted">
                  {a.reason ?? 'No reason given'} · {formatDate(a.createdAt)}
                </div>
              </div>
              <Badge
                tone={
                  a.status === 'approved' ? 'green' : a.status === 'denied' ? 'red' : 'amber'
                }
              >
                {a.status}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
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
        <p className="text-sm text-muted">No pending override requests.</p>
      ) : (
        <ul className="space-y-3">
          {pending.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between rounded border border-hairline p-3"
            >
              <div>
                <div className="text-sm font-medium text-ink">
                  {a.requester.name} · <Badge tone="blue">{a.kind}</Badge>
                </div>
                <div className="text-xs text-muted">
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
        <p className="text-sm text-muted">No pending link requests.</p>
      ) : (
        <ul className="space-y-3">
          {pending.map((l) => (
            <li
              key={l.id}
              className="flex items-center justify-between rounded border border-hairline p-3"
            >
              <div>
                <div className="text-sm font-medium text-ink">{l.student.name}</div>
                <div className="text-xs text-muted">
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
        <p className="text-sm text-muted">You haven&apos;t linked any approvers yet.</p>
      ) : (
        <ul className="divide-y divide-hairline">
          {links.map((l) => (
            <li key={l.id} className="flex items-center justify-between py-2">
              <div>
                <div className="text-sm font-medium text-ink">{l.approver.name}</div>
                <div className="text-xs text-muted">
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
