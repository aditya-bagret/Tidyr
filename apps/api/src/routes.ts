import { Router } from 'express';
import { createAuthRouter } from './modules/auth/auth.routes';
import { createDashboardRouter } from './modules/dashboard/dashboard.routes';
import { createDocsRouter } from './modules/docs/docs.routes';
import { createProjectsRouter } from './modules/projects/projects.routes';
import { createTasksRouter } from './modules/tasks/tasks.routes';

/** Mounts the feature routers under /api. */
export function createApiRouter() {
  const router = Router();
  router.use('/auth', createAuthRouter());
  router.use('/projects', createProjectsRouter());
  router.use('/tasks', createTasksRouter());
  router.use('/dashboard', createDashboardRouter());
  router.use('/docs', createDocsRouter());
  return router;
}
