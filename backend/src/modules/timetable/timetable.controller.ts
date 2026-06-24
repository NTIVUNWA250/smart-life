import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireAuth } from '../../middleware/auth.js';
import { audit } from '../../lib/audit.js';
import * as timetable from './timetable.service.js';
import { clockFromDate, MINUTES_PER_DAY } from './timetable.schedule.js';

export const timetableRouter = Router();
timetableRouter.use(requireAuth);

const targetSchema = z.object({
  appOrSite: z.string().min(1).max(2048),
  kind: z.enum(['app', 'url']).default('url'),
  label: z.string().max(120).optional(),
});

const entrySchema = z.object({
  title: z.string().min(1).max(120),
  category: z
    .enum(['study', 'work', 'exercise', 'meal', 'sleep', 'leisure', 'chore', 'social', 'other'])
    .optional(),
  notes: z.string().max(500).optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
  startMin: z.number().int().min(0).max(MINUTES_PER_DAY - 1),
  endMin: z.number().int().min(1).max(MINUTES_PER_DAY),
  isolation: z.boolean().optional(),
  reminderEnabled: z.boolean().optional(),
  reminderLeadMin: z.number().int().min(5).max(720).optional(),
  color: z.string().max(20).optional(),
  allowedTargets: z.array(targetSchema).max(50).optional(),
});

timetableRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ items: await timetable.listEntries(req.user!.id) });
  }),
);

// Live agenda: pass the client's local time via ?dow=&min= (else server UTC).
timetableRouter.get(
  '/agenda',
  asyncHandler(async (req, res) => {
    const dow = req.query.dow !== undefined ? Number(req.query.dow) : undefined;
    const min = req.query.min !== undefined ? Number(req.query.min) : undefined;
    const clock =
      Number.isInteger(dow) && Number.isInteger(min) && dow! >= 0 && dow! <= 6 && min! >= 0 && min! < MINUTES_PER_DAY
        ? { dow: dow!, min: min! }
        : clockFromDate(new Date());
    res.json({ agenda: await timetable.buildAgenda(req.user!.id, clock) });
  }),
);

timetableRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = entrySchema.parse(req.body);
    const entry = await timetable.createEntry(req.user!.id, input);
    await audit('timetable.entry.created', req.user!.id, `title=${entry.title}`);
    res.status(201).json({ entry });
  }),
);

timetableRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const input = entrySchema.parse(req.body);
    const entry = await timetable.updateEntry(req.user!.id, req.params.id, input);
    await audit('timetable.entry.updated', req.user!.id, `title=${entry.title}`);
    res.json({ entry });
  }),
);

timetableRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await timetable.deleteEntry(req.user!.id, req.params.id);
    await audit('timetable.entry.deleted', req.user!.id, `id=${req.params.id}`);
    res.status(204).end();
  }),
);
