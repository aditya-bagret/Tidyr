import { dashboardQuerySchema } from '@tidyr/shared';
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import * as dashboardController from './dashboard.controller';

/** /api/dashboard (API_CONTRACT §7). `authenticate` runs before validation (D-031). */
export function createDashboardRouter() {
  const router = Router();
  router.use(authenticate);

  router.get('/', validate({ query: dashboardQuerySchema }), dashboardController.get);

  return router;
}
