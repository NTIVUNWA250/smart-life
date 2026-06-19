import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireAuth } from '../../middleware/auth.js';
import * as screentime from './screentime.service.js';

export const screentimeRouter = Router();
screentimeRouter.use(requireAuth);

screentimeRouter.get(
  '/policies',
  asyncHandler(async (req, res) => {
    res.json({ items: await screentime.listPolicies(req.user!.id) });
  }),
);

const upsertSchema = z.object({
  appOrSite: z.string().min(1).max(120),
  dailyLimitMin: z.number().int().min(0).max(1440),
});

screentimeRouter.post(
  '/policies',
  asyncHandler(async (req, res) => {
    const input = upsertSchema.parse(req.body);
    const policy = await screentime.upsertPolicy(req.user!.id, input.appOrSite, input.dailyLimitMin);
    res.status(201).json({ policy });
  }),
);

const usageSchema = z.object({
  usage: z
    .array(z.object({ appOrSite: z.string().min(1), usedMin: z.number().int().min(0) }))
    .min(1),
});

screentimeRouter.post(
  '/usage',
  asyncHandler(async (req, res) => {
    const { usage } = usageSchema.parse(req.body);
    res.json({ items: await screentime.reportUsage(req.user!.id, usage) });
  }),
);
