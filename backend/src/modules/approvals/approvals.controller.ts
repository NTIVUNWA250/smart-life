import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireAuth } from '../../middleware/auth.js';
import { prisma } from '../../lib/prisma.js';
import { badRequest, forbidden, notFound } from '../../lib/http-error.js';
import { encryptField, decryptField } from '../../lib/crypto.js';
import { audit } from '../../lib/audit.js';
import { unblock as unblockSpending } from '../limits/limits.service.js';
import { setPolicyBlocked } from '../screentime/screentime.service.js';
import { applyApprovedGoalEdit } from '../goals/goals.service.js';

export const approvalsRouter = Router();
approvalsRouter.use(requireAuth);

const createSchema = z.object({
  approverId: z.string().uuid(),
  kind: z.enum(['spending', 'screentime']),
  targetId: z.string().min(1),
  reason: z.string().max(500).optional(),
});

// Student requests an override from a linked, accepted approver.
approvalsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = createSchema.parse(req.body);
    const link = await prisma.peerLink.findUnique({
      where: { studentId_approverId: { studentId: req.user!.id, approverId: input.approverId } },
    });
    if (!link || link.status !== 'accepted') {
      throw badRequest('That approver is not linked to your account');
    }
    const approval = await prisma.approval.create({
      data: {
        requesterId: req.user!.id,
        approverId: input.approverId,
        kind: input.kind,
        targetId: input.targetId,
        reasonEnc: input.reason ? encryptField(input.reason) : null,
      },
    });
    await audit('approval.created', req.user!.id, `kind=${approval.kind} approver=${input.approverId}`);
    res.status(201).json({ approval: { ...approval, reasonEnc: undefined } });
  }),
);

// Pending requests routed to me as an approver.
approvalsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const role = req.query.role === 'requester' ? 'requester' : 'approver';
    const where =
      role === 'approver'
        ? { approverId: req.user!.id }
        : { requesterId: req.user!.id };
    const items = await prisma.approval.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        requester: { select: { id: true, name: true, email: true } },
        approver: { select: { id: true, name: true, email: true } },
      },
    });
    res.json({
      items: items.map((a) => ({
        ...a,
        reason: a.reasonEnc ? decryptField(a.reasonEnc) : null,
        reasonEnc: undefined,
        proposedEnc: undefined,
      })),
    });
  }),
);

const decideSchema = z.object({ status: z.enum(['approved', 'denied']) });

// Approver approves/denies. Approval of a spending request unblocks payments;
// approval of a screentime request unblocks that policy.
approvalsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { status } = decideSchema.parse(req.body);
    const approval = await prisma.approval.findUnique({ where: { id: req.params.id } });
    if (!approval) throw notFound('Approval not found');
    if (approval.approverId !== req.user!.id) throw forbidden('Not your approval to decide');
    if (approval.status !== 'pending') throw badRequest('Already decided');

    const updated = await prisma.approval.update({
      where: { id: approval.id },
      data: { status, decidedAt: new Date() },
    });

    if (status === 'approved') {
      if (approval.kind === 'spending') {
        await unblockSpending(approval.requesterId);
      } else if (approval.kind === 'screentime') {
        await setPolicyBlocked(approval.requesterId, approval.targetId, false);
      } else if (approval.kind === 'goal_edit') {
        await applyApprovedGoalEdit(approval);
      }
    }

    await audit('approval.decided', req.user!.id, `kind=${approval.kind} status=${status} requester=${approval.requesterId}`);
    res.json({ approval: { ...updated, reasonEnc: undefined } });
  }),
);
