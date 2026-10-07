import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { buildOpenApiDocument } from './openapi';

const SPEC_PATH = 'openapi.json';

/** /api/docs: Swagger UI, and the OpenAPI document it loads from /api/docs/openapi.json. */
export function createDocsRouter() {
  const router = Router();

  router.get(`/${SPEC_PATH}`, (_req, res) => {
    res.json(buildOpenApiDocument());
  });

  // The UI loads its assets with relative URLs, which only resolve under a trailing slash.
  router.get('/', (req, res, next) => {
    const [path = '', query] = req.originalUrl.split('?');
    if (path.endsWith('/')) return next();
    res.redirect(301, `${path}/${query === undefined ? '' : `?${query}`}`);
  });
  router.use(swaggerUi.serve);
  router.get(
    '/',
    swaggerUi.setup(null, {
      customSiteTitle: 'Tidyr API',
      swaggerOptions: { url: SPEC_PATH },
    }),
  );

  return router;
}
