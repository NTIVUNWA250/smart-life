import { prisma } from '../../lib/prisma.js';
import { recomputeCurrentLimit } from '../limits/limits.service.js';
import { buildAgenda } from '../timetable/timetable.service.js';
import type { Clock } from '../timetable/timetable.schedule.js';

export type NotificationType = 'approval' | 'denial' | 'reminder';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  createdAt: string; // ISO
}

const KIND_LABEL: Record<string, string> = {
  spending: 'spending override',
  screentime: 'screen-time override',
  goal_edit: 'goal edit',
};

/**
 * Builds a per-user notification feed from existing state (no separate store):
 *  - decisions on requests I made (approval / denial)
 *  - requests awaiting my decision as an approver (reminder)
 *  - money/goal reminders (blocked spending, deadlines, failed goals)
 */
export async function buildFeed(userId: string, clock?: Clock): Promise<Notification[]> {
  const [decidedForMe, pendingForMe, limit, goals] = await Promise.all([
    prisma.approval.findMany({
      where: { requesterId: userId, status: { in: ['approved', 'denied'] } },
      orderBy: { decidedAt: 'desc' },
      take: 30,
      include: { approver: { select: { name: true } } },
    }),
    prisma.approval.findMany({
      where: { approverId: userId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { requester: { select: { name: true } } },
    }),
    recomputeCurrentLimit(userId),
    prisma.goal.findMany({ where: { userId, status: 'active' } }),
  ]);

  const items: Notification[] = [];

  for (const a of decidedForMe) {
    const label = KIND_LABEL[a.kind] ?? a.kind;
    const approved = a.status === 'approved';
    items.push({
      id: `decision:${a.id}`,
      type: approved ? 'approval' : 'denial',
      title: approved ? `${label} approved` : `${label} denied`,
      body: `${a.approver.name} ${approved ? 'approved' : 'denied'} your ${label} request.`,
      createdAt: (a.decidedAt ?? a.createdAt).toISOString(),
    });
  }

  for (const a of pendingForMe) {
    const label = KIND_LABEL[a.kind] ?? a.kind;
    items.push({
      id: `pending:${a.id}`,
      type: 'reminder',
      title: 'Approval needed',
      body: `${a.requester.name} is requesting a ${label} - review it in Approvals.`,
      createdAt: a.createdAt.toISOString(),
    });
  }

  if (limit.isBlocked) {
    items.push({
      id: `limit:${limit.id}:${limit.periodStart.toISOString()}`,
      type: 'reminder',
      title: 'Spending blocked',
      body: 'You have reached your monthly spending limit. Request an approval to unblock.',
      createdAt: limit.updatedAt.toISOString(),
    });
  }

  const soon = Date.now() + 7 * 24 * 60 * 60 * 1000;
  for (const g of goals) {
    if (g.deadline.getTime() <= soon && g.savedRwf < g.targetRwf) {
      items.push({
        id: `goal:${g.id}`,
        type: 'reminder',
        title: `Goal deadline near: ${g.title}`,
        body: `"${g.title}" is due ${g.deadline.toISOString().slice(0, 10)} and not yet funded.`,
        createdAt: g.updatedAt.toISOString(),
      });
    }
  }

  // Timetable: activities about to start (needs the client's local time).
  if (clock) {
    const { reminders } = await buildAgenda(userId, clock);
    for (const r of reminders) {
      items.push({
        id: `timetable:${r.entry.id}:${r.entry.startMin}`,
        type: 'reminder',
        title: `Starting in ${r.startsInMin} min: ${r.entry.title}`,
        body: r.entry.isolation
          ? `${r.entry.title} is about to start - focus mode will keep only its allowed apps and sites enabled.`
          : `${r.entry.title} is about to start.`,
        createdAt: new Date().toISOString(),
      });
    }
  }

  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
