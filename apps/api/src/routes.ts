import { Router } from 'express';
import { createAuthRouter } from './modules/auth/auth.routes';
import { createProjectsRouter } from './modules/projects/projects.routes';

/** Mounts the feature routers under /api. Tasks and dashboard arrive in Phases 5–6. */
export function createApiRouter() {
  const router = Router();
  router.use('/auth', createAuthRouter());
  router.use('/projects', createProjectsRouter());
  return router;
}
