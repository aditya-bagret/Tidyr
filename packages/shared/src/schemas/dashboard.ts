import { z } from 'zod';
import { todayUtc } from '../utils/dates';
import { dateOnly } from './common';

export const dashboardQuerySchema = z.object({
  today: dateOnly.default(() => todayUtc()),
});
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
