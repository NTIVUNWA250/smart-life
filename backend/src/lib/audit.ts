import type { AuditLog } from '@prisma/client';
import { prisma } from './prisma.js';
import { logger } from './logger.js';

/**
 * Audit trail (NFR4: auditability + report generation).
 *
 * Every security- or money-relevant action records an immutable AuditLog row.
 * Writes are best-effort: an audit failure must never break the user-facing
 * request, so errors are logged and swallowed.
 */
export type AuditAction =
  | 'auth.signup'
  | 'auth.login'
  | 'auth.logout'
  | 'auth.profile.updated'
  | 'auth.password.changed'
  | 'limit.blocked'
  | 'limit.unblocked'
  | 'approval.created'
  | 'approval.decided'
  | 'screentime.blocked'
  | 'admin.user.updated'
  | 'finance.profile.created'
  | 'finance.profile.updated'
  | 'goal.edit.requested'
  | 'goal.edited'
  | 'timetable.entry.created'
  | 'timetable.entry.updated'
  | 'timetable.entry.deleted';

export async function audit(
  action: AuditAction,
  userId: string | null,
  detail?: string,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: { action, userId: userId ?? null, detail: detail ?? null },
    });
  } catch (err) {
    logger.error('audit.write_failed', { action, err: String(err) });
  }
}

/** A single CSV field, quoted/escaped per RFC 4180 when it contains , " or newlines. */
export function csvField(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Serialises audit rows to a CSV report (NFR4 report generation). Pure + testable. */
export function auditToCsv(rows: Pick<AuditLog, 'createdAt' | 'action' | 'userId' | 'detail'>[]): string {
  const header = ['createdAt', 'action', 'userId', 'detail'];
  const lines = rows.map((r) =>
    [r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt, r.action, r.userId, r.detail]
      .map(csvField)
      .join(','),
  );
  return [header.join(','), ...lines].join('\n');
}
