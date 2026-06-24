import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireAuth } from '../../middleware/auth.js';
import { buildFeed } from './notifications.service.js';
import { MINUTES_PER_DAY } from '../timetable/timetable.schedule.js';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    // Optional client local time enables timetable reminders.
    const dow = Number(req.query.dow);
    const min = Number(req.query.min);
    const clock =
      Number.isInteger(dow) && Number.isInteger(min) && dow >= 0 && dow <= 6 && min >= 0 && min < MINUTES_PER_DAY
        ? { dow, min }
        : undefined;
    const items = await buildFeed(req.user!.id, clock);
    res.json({ items });
  }),
);
