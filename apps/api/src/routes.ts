import { Router } from 'express';
import { createAuthRouter } from './modules/auth/auth.routes';
import { createProjectsRouter } from './modules/projects/projects.routes';
import { createTasksRouter } from './modules/tasks/tasks.routes';

/** Mounts the feature routers under /api. The dashboard arrives in Phase 6. */
export function createApiRouter() {
  const router = Router();
  router.use('/auth', createAuthRouter());
  router.use('/projects', createProjectsRouter());
  router.use('/tasks', createTasksRouter());
  return router;
}
