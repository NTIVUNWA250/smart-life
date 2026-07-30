// Typed API client for the SMART LIFE backend.
// Reads NEXT_PUBLIC_API_URL, attaches the bearer token, and exposes one
// function per endpoint. Designed for client-side use.

import type {
  AdminUser,
  AnalyticsSummary,
  AuditLogEntry,
  AuditSummaryEntry,
  Approval,
  ApprovalKind,
  ApprovalStatus,
  AuthResult,
  AuthTokens,
  BudgetSuggestion,
  DailyStatus,
  FinanceInput,
  FinanceResponse,
  Frequency,
  Goal,
  GoalStatus,
  Notification,
  PeerLinkAsApprover,
  PeerLinkAsStudent,
  PeerLinks,
  PeerRelationship,
  Role,
  ScreenTargetKind,
  ScreenTimePolicy,
  SpendingLimit,
  Transaction,
  TransactionType,
  User,
} from './types';

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

const ACCESS_KEY = 'smartlife.accessToken';
const REFRESH_KEY = 'smartlife.refreshToken';

export const tokenStore = {
  get access(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(ACCESS_KEY);
  },
  get refresh(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(REFRESH_KEY);
  },
  set(tokens: AuthTokens): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    window.localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  },
  clear(): void {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  },
};

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface BackendErrorBody {
  error?: { code?: string; message?: string; details?: unknown };
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
  query?: Record<string, string | number | undefined>;
  /** Internal flag to prevent infinite refresh loops. */
  _retried?: boolean;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(`${BASE_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function refreshTokens(): Promise<boolean> {
  const refreshToken = tokenStore.refresh;
  if (!refreshToken) return false;
  try {
    const res = await fetch(buildUrl('/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { tokens: AuthTokens };
    tokenStore.set(data.tokens);
    return true;
  } catch {
    return false;
  }
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, query } = opts;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && tokenStore.access) {
    headers.Authorization = `Bearer ${tokenStore.access}`;
  }

  const res = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Attempt a single transparent token refresh on 401.
  if (res.status === 401 && auth && !opts._retried) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      return request<T>(path, { ...opts, _retried: true });
    }
    tokenStore.clear();
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    const err = (data as BackendErrorBody)?.error;
    throw new ApiError(
      res.status,
      err?.code ?? 'error',
      err?.message ?? `Request failed (${res.status})`,
      err?.details,
    );
  }

  return data as T;
}

// ---- Auth ----------------------------------------------------------------

export interface SignupInput {
  name: string;
  email: string;
  password: string;
  // `admin` is intentionally excluded - internal/developer role only.
  role?: Exclude<Role, 'admin'>;
  isMinor?: boolean;
  finance?: FinanceInput;
}

export const api = {
  auth: {
    signup: (input: SignupInput) =>
      request<AuthResult>('/auth/signup', { method: 'POST', body: input, auth: false }),
    login: (email: string, password: string) =>
      request<AuthResult>('/auth/login', {
        method: 'POST',
        body: { email, password },
        auth: false,
      }),
    me: () => request<{ user: User }>('/auth/me'),
    // `momoMsisdn: null` unlinks the wallet; omitting the key leaves it untouched.
    updateProfile: (input: { name?: string; email?: string; momoMsisdn?: string | null }) =>
      request<{ user: User }>('/auth/me', { method: 'PATCH', body: input }),
    changePassword: (currentPassword: string, newPassword: string) =>
      request<void>('/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      }),
    logout: (refreshToken: string) =>
      request<void>('/auth/logout', { method: 'POST', body: { refreshToken } }),
  },

  // ---- Finance profile ---------------------------------------------------
  finance: {
    get: () => request<FinanceResponse>('/finance'),
    save: (input: FinanceInput) =>
      request<FinanceResponse>('/finance', { method: 'PUT', body: input }),
    suggest: (input: {
      incomeRwf: number;
      incomeFrequency: Frequency;
      expectedPct?: number;
      expectedExpensesRwf?: number;
    }) =>
      request<{ suggestion: BudgetSuggestion }>('/finance/suggest', {
        method: 'POST',
        body: input,
      }),
  },

  // ---- Notifications -----------------------------------------------------
  notifications: {
    list: () => request<{ items: Notification[] }>('/notifications'),
  },

  // ---- Transactions ------------------------------------------------------
  transactions: {
    list: (filter?: { type?: TransactionType; limit?: number }) =>
      request<{ items: Transaction[] }>('/transactions', { query: filter }),
    create: (input: {
      type: TransactionType;
      amountRwf: number;
      category?: string;
      note?: string;
    }) =>
      request<{ transaction: Transaction; limit: SpendingLimit }>('/transactions', {
        method: 'POST',
        body: input,
      }),
    // No remove(): the API has no delete endpoint. Deleting an expense would
    // recompute the limit downward and lift an active block without approval.
  },

  // ---- Goals -------------------------------------------------------------
  goals: {
    list: () => request<{ items: Goal[] }>('/goals'),
    create: (input: { title: string; targetRwf: number; deadline: string }) =>
      request<{ goal: Goal; limit: SpendingLimit }>('/goals', {
        method: 'POST',
        body: input,
      }),
    // Progress / status only. Definition edits go through editRequest below.
    update: (id: string, input: { addSavedRwf?: number; status?: GoalStatus }) =>
      request<{ goal: Goal; limit: SpendingLimit }>(`/goals/${id}`, {
        method: 'PATCH',
        body: input,
      }),
    // Request a title/target/deadline change - routed through an approver
    // (parent for minors, peer for adults) and allowed once a month.
    editRequest: (
      id: string,
      input: { title?: string; targetRwf?: number; deadline?: string; reason?: string },
    ) =>
      request<{ approval: Approval }>(`/goals/${id}/edit-request`, {
        method: 'POST',
        body: input,
      }),
  },

  // ---- Limits ------------------------------------------------------------
  limits: {
    current: () =>
      request<{ limit: SpendingLimit; daily: DailyStatus | null }>('/limits/current'),
    check: (amountRwf: number) =>
      request<{
        allowed: boolean;
        reason?: string;
        limit: SpendingLimit;
        daily: DailyStatus | null;
      }>('/limits/check', { method: 'POST', body: { amountRwf } }),
    setUnexpectedIncome: (amountRwf: number) =>
      request<{ limit: SpendingLimit }>('/limits/unexpected-income', {
        method: 'PUT',
        body: { amountRwf },
      }),
  },

  // ---- Screen time -------------------------------------------------------
  screentime: {
    policies: () => request<{ items: ScreenTimePolicy[] }>('/screentime/policies'),
    // `kind` is sent explicitly. The server defaults it to 'url', and a URL
    // target can never accumulate usage - the phone measures per-app foreground
    // time and cannot see browser URLs.
    upsertPolicy: (input: {
      appOrSite: string;
      dailyLimitMin: number;
      kind: ScreenTargetKind;
      label?: string;
    }) =>
      request<{ policy: ScreenTimePolicy }>('/screentime/policies', {
        method: 'POST',
        body: input,
      }),
  },

  // ---- Peers -------------------------------------------------------------
  peers: {
    list: () => request<PeerLinks>('/peers'),
    link: (approverEmail: string, relationship?: PeerRelationship) =>
      request<{ link: PeerLinkAsStudent }>('/peers', {
        method: 'POST',
        body: { approverEmail, relationship },
      }),
    decide: (id: string, status: 'accepted' | 'rejected') =>
      request<{ link: PeerLinkAsApprover }>(`/peers/${id}`, {
        method: 'PATCH',
        body: { status },
      }),
  },

  // ---- Approvals ---------------------------------------------------------
  approvals: {
    list: (role: 'approver' | 'requester' = 'approver') =>
      request<{ items: Approval[] }>('/approvals', { query: { role } }),
    create: (input: {
      approverId: string;
      kind: ApprovalKind;
      targetId: string;
      reason?: string;
    }) =>
      request<{ approval: Approval }>('/approvals', { method: 'POST', body: input }),
    decide: (id: string, status: Exclude<ApprovalStatus, 'pending'>) =>
      request<{ approval: Approval }>(`/approvals/${id}`, {
        method: 'PATCH',
        body: { status },
      }),
  },

  // ---- Analytics ---------------------------------------------------------
  analytics: {
    summary: () => request<AnalyticsSummary>('/analytics/summary'),
  },

  // ---- Admin -------------------------------------------------------------
  admin: {
    users: () => request<{ items: AdminUser[] }>('/admin/users'),
    updateUser: (id: string, input: { role?: Role; isMinor?: boolean }) =>
      request<{ user: User }>(`/admin/users/${id}`, {
        method: 'PATCH',
        body: input,
      }),
    audit: (filters?: AuditFilters) =>
      request<{ items: AuditLogEntry[] }>('/admin/audit', { query: { ...filters } }),
    auditSummary: () =>
      request<{ items: AuditSummaryEntry[] }>('/admin/audit/summary'),
    // CSV export needs the bearer header, so fetch the raw blob directly.
    downloadAuditCsv: async (filters?: AuditFilters): Promise<Blob> => {
      const res = await fetch(buildUrl('/admin/audit', { ...filters, format: 'csv' }), {
        headers: tokenStore.access ? { Authorization: `Bearer ${tokenStore.access}` } : {},
      });
      if (!res.ok) {
        throw new ApiError(res.status, 'export_failed', 'Could not export audit CSV');
      }
      return res.blob();
    },
  },
};

export interface AuditFilters {
  action?: string;
  userId?: string;
  from?: string;
  to?: string;
  limit?: number;
}
