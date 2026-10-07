import type { DataResponse, HealthStatus } from '@tidyr/shared';
import { Router } from 'express';

/** Liveness only: no auth and no database, so Render's frequent checks stay cheap. */
export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  const body: DataResponse<HealthStatus> = { data: { status: 'ok', uptime: process.uptime() } };
  res.json(body);
});
