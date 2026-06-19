// Shared API types mirroring the backend contract (saving-app/backend/src/modules).

export type Role = 'student' | 'approver' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  isMinor: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: User;
  tokens: AuthTokens;
}

export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amountRwf: number;
  category: string;
  note: string | null;
  occurredAt: string;
}

export interface SpendingLimit {
  id: string;
  userId: string;
  periodStart: string;
  periodEnd: string;
  limitRwf: number;
  spentRwf: number;
  isBlocked: boolean;
}

export type GoalStatus = 'active' | 'achieved' | 'failed';

export interface Goal {
  id: string;
  userId: string;
  title: string;
  targetRwf: number;
  savedRwf: number;
  deadline: string;
  status: GoalStatus;
}

export interface ScreenTimePolicy {
  id: string;
  userId: string;
  appOrSite: string;
  dailyLimitMin: number;
  usedMin: number;
  isBlocked: boolean;
}

export interface AnalyticsSummary {
  period: { start: string; end: string };
  finance: {
    incomeRwf: number;
    expenseRwf: number;
    limitRwf: number;
    spentRwf: number;
    isBlocked: boolean;
  };
  savings: {
    savedRwf: number;
    targetRwf: number;
    progressPct: number;
    activeGoals: number;
    achievedGoals: number;
  };
  time: {
    totalUsedMin: number;
    totalLimitMin: number;
    blocked: string[];
  };
}

export type ApprovalKind = 'spending' | 'screentime';
export type ApprovalStatus = 'pending' | 'approved' | 'denied';

export interface ApprovalParty {
  id: string;
  name: string;
  email: string;
}

export interface Approval {
  id: string;
  requesterId: string;
  approverId: string;
  kind: ApprovalKind;
  targetId: string;
  status: ApprovalStatus;
  reason: string | null;
  createdAt: string;
  decidedAt: string | null;
  requester: ApprovalParty;
  approver: ApprovalParty;
}

export type PeerRelationship = 'peer' | 'parent';
export type PeerLinkStatus = 'pending' | 'accepted' | 'rejected';

export interface PeerLinkAsStudent {
  id: string;
  studentId: string;
  approverId: string;
  relationship: PeerRelationship;
  status: PeerLinkStatus;
  approver: ApprovalParty;
}

export interface PeerLinkAsApprover {
  id: string;
  studentId: string;
  approverId: string;
  relationship: PeerRelationship;
  status: PeerLinkStatus;
  student: ApprovalParty;
}

export interface PeerLinks {
  asStudent: PeerLinkAsStudent[];
  asApprover: PeerLinkAsApprover[];
}

export interface AdminUser extends User {
  createdAt: string;
}
