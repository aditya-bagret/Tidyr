import { Router } from 'express';
import { createAuthRouter } from './modules/auth/auth.routes';

/** Mounts the feature routers under /api. Projects, tasks and dashboard arrive in Phases 4–6. */
export function createApiRouter() {
  const router = Router();
  router.use('/auth', createAuthRouter());
  return router;
}
