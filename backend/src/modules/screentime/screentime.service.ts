import type { ScreenTimePolicy } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { providers } from '../../providers/index.js';
import { notFound } from '../../lib/http-error.js';

export async function listPolicies(userId: string): Promise<ScreenTimePolicy[]> {
  return prisma.screenTimePolicy.findMany({ where: { userId }, orderBy: { appOrSite: 'asc' } });
}

export async function upsertPolicy(
  userId: string,
  appOrSite: string,
  dailyLimitMin: number,
): Promise<ScreenTimePolicy> {
  return prisma.screenTimePolicy.upsert({
    where: { userId_appOrSite: { userId, appOrSite } },
    update: { dailyLimitMin },
    create: { userId, appOrSite, dailyLimitMin },
  });
}

/**
 * The mobile app reports usage (FR5). For each app/site we update minutes used and
 * block it when the daily limit is exceeded, enforcing via the OS provider.
 */
export async function reportUsage(
  userId: string,
  usage: { appOrSite: string; usedMin: number }[],
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
      data: { usedMin: u.usedMin, isBlocked },
    });
    await providers.screentime.enforceBlock(userId, u.appOrSite, isBlocked);
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
