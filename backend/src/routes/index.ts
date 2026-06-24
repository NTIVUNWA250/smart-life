import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.controller.js';
import { transactionsRouter } from '../modules/transactions/transactions.controller.js';
import { goalsRouter } from '../modules/goals/goals.controller.js';
import { financeRouter } from '../modules/finance/finance.controller.js';
import { limitsRouter } from '../modules/limits/limits.controller.js';
import { screentimeRouter } from '../modules/screentime/screentime.controller.js';
import { peersRouter } from '../modules/peers/peers.controller.js';
import { approvalsRouter } from '../modules/approvals/approvals.controller.js';
import { analyticsRouter } from '../modules/analytics/analytics.controller.js';
import { timetableRouter } from '../modules/timetable/timetable.controller.js';
import { notificationsRouter } from '../modules/notifications/notifications.controller.js';
import { adminRouter } from '../modules/admin/admin.controller.js';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/transactions', transactionsRouter);
apiRouter.use('/goals', goalsRouter);
apiRouter.use('/finance', financeRouter);
apiRouter.use('/limits', limitsRouter);
apiRouter.use('/screentime', screentimeRouter);
apiRouter.use('/peers', peersRouter);
apiRouter.use('/approvals', approvalsRouter);
apiRouter.use('/analytics', analyticsRouter);
apiRouter.use('/timetable', timetableRouter);
apiRouter.use('/notifications', notificationsRouter);
apiRouter.use('/admin', adminRouter);
