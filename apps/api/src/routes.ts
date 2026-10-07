import { Router } from 'express';

/** Mounts the feature routers under /api. Auth, projects, tasks and dashboard arrive in Phases 3–6. */
export function createApiRouter() {
  return Router();
}
