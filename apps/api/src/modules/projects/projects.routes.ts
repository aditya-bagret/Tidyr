import {
  createProjectSchema,
  idParamSchema,
  listProjectsQuerySchema,
  updateProjectSchema,
} from '@tidyr/shared';
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import * as projectsController from './projects.controller';

/** /api/projects (API_CONTRACT §5). `authenticate` runs before validation (D-031). */
export function createProjectsRouter() {
  const router = Router();
  router.use(authenticate);

  router.get('/', validate({ query: listProjectsQuerySchema }), projectsController.list);
  router.post('/', validate({ body: createProjectSchema }), projectsController.create);
  router.get('/:id', validate({ params: idParamSchema }), projectsController.get);
  router.put(
    '/:id',
    validate({ params: idParamSchema, body: updateProjectSchema }),
    projectsController.update,
  );
  router.delete('/:id', validate({ params: idParamSchema }), projectsController.remove);

  return router;
}
