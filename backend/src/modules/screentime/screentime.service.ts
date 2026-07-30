import type { ScreenTargetKind, ScreenTimePolicy } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { providers } from '../../providers/index.js';
import { notFound } from '../../lib/http-error.js';
import { isNewUtcDay } from '../../lib/period.js';
import { audit } from '../../lib/audit.js';
import { normalizeTarget } from './screentime.targets.js';

export async function listPolicies(userId: string): Promise<ScreenTimePolicy[]> {
  return prisma.screenTimePolicy.findMany({ where: { userId }, orderBy: { appOrSite: 'asc' } });
}

export async function upsertPolicy(
  userId: string,
  input: { appOrSite: string; dailyLimitMin: number; kind: ScreenTargetKind; label?: string },
): Promise<ScreenTimePolicy> {
  const target = normalizeTarget(input.kind, input.appOrSite, input.label);
  return prisma.screenTimePolicy.upsert({
    where: { userId_appOrSite: { userId, appOrSite: target.appOrSite } },
    update: { dailyLimitMin: input.dailyLimitMin, kind: target.kind, label: target.label },
    create: {
      userId,
      appOrSite: target.appOrSite,
      kind: target.kind,
      label: target.label,
      dailyLimitMin: input.dailyLimitMin,
    },
  });
}

/**
 * The mobile app reports usage (FR5). For each app/site we update minutes used and
 * block it when the daily limit is exceeded, enforcing via the OS provider.
 *
 * Screen-time limits are *daily*: when the first report of a new UTC day arrives,
 * the policy's counter and block are reset before the new usage is applied.
 */
export async function reportUsage(
  userId: string,
  usage: { appOrSite: string; usedMin: number }[],
  now = new Date(),
): Promise<ScreenTimePolicy[]> {
  const updated: ScreenTimePolicy[] = [];
  for (const u of usage) {
    const policy = await prisma.screenTimePolicy.findUnique({
      where: { userId_appOrSite: { userId, appOrSite: u.appOrSite } },
    });
    if (!policy) continue;

    const isBlocked = u.usedMin >= policy.dailyLimitMin;
    const next = await prisma.screenTimePolicy.update({
      where: { id: policy.id },
      // On a new day, stamp resetAt so the window rolls over from this report.
      data: isNewUtcDay(policy.resetAt, now)
        ? { usedMin: u.usedMin, isBlocked, resetAt: now }
        : { usedMin: u.usedMin, isBlocked },
    });
    await providers.screentime.enforceBlock(userId, u.appOrSite, isBlocked);
    // Audit only the false->true transition (a new block taking effect).
    if (isBlocked && !policy.isBlocked) {
      await audit('screentime.blocked', userId, `app=${u.appOrSite} used=${u.usedMin} limit=${policy.dailyLimitMin}`);
    }
    updated.push(next);
  }
  return updated;
}

/** Used by the approvals flow to unblock a policy after peer/parental approval. */
export async function setPolicyBlocked(
  userId: string,
  policyId: string,
  blocked: boolean,
): Promise<ScreenTimePolicy> {
  const policy = await prisma.screenTimePolicy.findFirst({ where: { id: policyId, userId } });
  if (!policy) throw notFound('Screen-time policy not found');
  const updated = await prisma.screenTimePolicy.update({
    where: { id: policy.id },
    data: { isBlocked: blocked, ...(blocked ? {} : { usedMin: 0 }) },
  });
  await providers.screentime.enforceBlock(userId, policy.appOrSite, blocked);
  return updated;
}
