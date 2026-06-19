import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireAuth } from '../../middleware/auth.js';
import { prisma } from '../../lib/prisma.js';
import { badRequest, notFound } from '../../lib/http-error.js';

export const peersRouter = Router();
peersRouter.use(requireAuth);

const linkSchema = z.object({
  approverEmail: z.string().email(),
  relationship: z.enum(['peer', 'parent']).optional(),
});

// Student requests to link an approver (friend/parent).
peersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { approverEmail, relationship } = linkSchema.parse(req.body);
    const approver = await prisma.user.findUnique({ where: { email: approverEmail } });
    if (!approver) throw notFound('No user with that email');
    if (approver.id === req.user!.id) throw badRequest('You cannot link to yourself');

    const link = await prisma.peerLink.upsert({
      where: { studentId_approverId: { studentId: req.user!.id, approverId: approver.id } },
      update: { relationship: relationship ?? 'peer' },
      create: {
        studentId: req.user!.id,
        approverId: approver.id,
        relationship: relationship ?? 'peer',
      },
    });
    res.status(201).json({ link });
  }),
);

// Links where I am the student, plus incoming requests where I am the approver.
peersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const [asStudent, asApprover] = await Promise.all([
      prisma.peerLink.findMany({
        where: { studentId: req.user!.id },
        include: { approver: { select: { id: true, name: true, email: true } } },
      }),
      prisma.peerLink.findMany({
        where: { approverId: req.user!.id },
        include: { student: { select: { id: true, name: true, email: true } } },
      }),
    ]);
    res.json({ asStudent, asApprover });
  }),
);

const decideSchema = z.object({ status: z.enum(['accepted', 'rejected']) });

// Approver accepts/rejects a link request.
peersRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { status } = decideSchema.parse(req.body);
    const link = await prisma.peerLink.findFirst({
      where: { id: req.params.id, approverId: req.user!.id },
    });
    if (!link) throw notFound('Link request not found');
    const updated = await prisma.peerLink.update({ where: { id: link.id }, data: { status } });
    res.json({ link: updated });
  }),
);
