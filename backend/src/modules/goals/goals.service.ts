import type { Approval, Goal, User } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { isSameUtcMonth } from '../../lib/period.js';
import { encryptField, decryptField } from '../../lib/crypto.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/http-error.js';
import { audit } from '../../lib/audit.js';
import { recomputeCurrentLimit } from '../limits/limits.service.js';

/** Fields of a goal's *definition* that an edit may change. */
export interface GoalEditProposal {
  title?: string;
  targetRwf?: number;
  deadline?: string; // ISO
}

/**
 * Picks the approver a goal edit must be routed to:
 *   - minors  → a linked, accepted **parent**
 *   - adults  → a linked, accepted **peer**
 * An explicit approverId may be supplied but must still satisfy the relationship.
 */
async function pickApprover(user: Pick<User, 'id' | 'isMinor'>, approverId?: string): Promise<string> {
  const relationship = user.isMinor ? 'parent' : 'peer';
  const link = await prisma.peerLink.findFirst({
    where: {
      studentId: user.id,
      status: 'accepted',
      relationship,
      ...(approverId ? { approverId } : {}),
    },
  });
  if (!link) {
    throw badRequest(
      user.isMinor
        ? 'Goal edits by minors need an accepted parent approver linked to your account'
        : 'Goal edits need an accepted peer approver linked to your account',
    );
  }
  return link.approverId;
}

/**
 * Requests an edit to a goal's definition. Enforces the once-per-calendar-month
 * rule and routes the change through an approval instead of applying it directly.
 */
export async function requestGoalEdit(
  user: Pick<User, 'id' | 'isMinor'>,
  goalId: string,
  proposal: GoalEditProposal,
  opts: { approverId?: string; reason?: string } = {},
): Promise<Approval> {
  if (proposal.title === undefined && proposal.targetRwf === undefined && proposal.deadline === undefined) {
    throw badRequest('Provide at least one of title, targetRwf or deadline to edit');
  }

  const goal = await prisma.goal.findFirst({ where: { id: goalId, userId: user.id } });
  if (!goal) throw notFound('Goal not found');

  // Once-a-month control: block a second edit in the same calendar month.
  if (goal.lastEditedAt && isSameUtcMonth(goal.lastEditedAt)) {
    throw conflict('This goal can only be edited once a month');
  }
  // Don't stack a second request while one is still pending.
  const pending = await prisma.approval.findFirst({
    where: { kind: 'goal_edit', targetId: goalId, status: 'pending' },
  });
  if (pending) throw conflict('An edit for this goal is already awaiting approval');

  const approverId = await pickApprover(user, opts.approverId);

  const approval = await prisma.approval.create({
    data: {
      requesterId: user.id,
      approverId,
      kind: 'goal_edit',
      targetId: goalId,
      reasonEnc: opts.reason ? encryptField(opts.reason) : null,
      proposedEnc: encryptField(JSON.stringify(proposal)),
    },
  });
  await audit('goal.edit.requested', user.id, `goal=${goalId} approver=${approverId}`);
  return approval;
}

/** Applies a goal-edit approval once it has been approved. */
export async function applyApprovedGoalEdit(approval: Approval): Promise<Goal> {
  if (approval.kind !== 'goal_edit') throw badRequest('Not a goal-edit approval');
  if (!approval.proposedEnc) throw badRequest('Approval has no proposed change');

  const goal = await prisma.goal.findFirst({
    where: { id: approval.targetId, userId: approval.requesterId },
  });
  if (!goal) throw notFound('Goal no longer exists');

  const proposal = JSON.parse(decryptField(approval.proposedEnc)) as GoalEditProposal;
  const updated = await prisma.goal.update({
    where: { id: goal.id },
    data: {
      title: proposal.title ?? goal.title,
      targetRwf: proposal.targetRwf ?? goal.targetRwf,
      deadline: proposal.deadline ? new Date(proposal.deadline) : goal.deadline,
      lastEditedAt: new Date(),
    },
  });
  await audit('goal.edited', approval.requesterId, `goal=${goal.id} by=${approval.approverId}`);
  await recomputeCurrentLimit(approval.requesterId);
  return updated;
}

/** Guard used by the approvals route: only the assigned approver may decide. */
export function assertIsApprover(approval: Approval, userId: string): void {
  if (approval.approverId !== userId) throw forbidden('Not your approval to decide');
}
