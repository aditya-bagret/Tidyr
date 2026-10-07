import type { Dashboard, DashboardQuery, DataResponse } from '@tidyr/shared';
import type { RequestHandler } from 'express';
import { currentUser } from '../../middleware/authenticate';
import * as dashboardService from './dashboard.service';

export const get: RequestHandler = async (req, res) => {
  const { today } = req.validated.query as DashboardQuery;
  const body: DataResponse<Dashboard> = {
    data: await dashboardService.get(currentUser(req).id, today),
  };
  res.json(body);
};
