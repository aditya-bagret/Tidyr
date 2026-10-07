import type { z } from 'zod';
import { paginationSchema } from './common';

// `GET /projects/:id/activity` and `GET /tasks/:id/activity` take only pagination (API_CONTRACT §8).
export const activityQuerySchema = paginationSchema;
export type ActivityQuery = z.infer<typeof activityQuerySchema>;
