import {
  activityQuerySchema,
  createTaskSchema,
  idParamSchema,
  listTasksQuerySchema,
  updateTaskSchema,
} from '@tidyr/shared';
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import * as tasksController from './tasks.controller';

/** /api/tasks (API_CONTRACT §6, activity §8). `authenticate` runs before validation (D-031). */
export function createTasksRouter() {
  const router = Router();
  router.use(authenticate);

  router.get('/', validate({ query: listTasksQuerySchema }), tasksController.list);
  router.post('/', validate({ body: createTaskSchema }), tasksController.create);
  router.get('/:id', validate({ params: idParamSchema }), tasksController.get);
  router.put(
    '/:id',
    validate({ params: idParamSchema, body: updateTaskSchema }),
    tasksController.update,
  );
  router.delete('/:id', validate({ params: idParamSchema }), tasksController.remove);
  router.get(
    '/:id/activity',
    validate({ params: idParamSchema, query: activityQuerySchema }),
    tasksController.activity,
  );

  return router;
}
