import { loginSchema, refreshSchema, registerSchema } from '@tidyr/shared';
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import {
  createLoginLimiter,
  createRefreshLimiter,
  createRegisterLimiter,
} from '../../middleware/rateLimit';
import { validate } from '../../middleware/validate';
import * as authController from './auth.controller';

/**
 * /api/auth (API_CONTRACT §4). A factory, so each app gets fresh limiter stores. Limiters run
 * before validation, so malformed attempts count against the limit too.
 */
export function createAuthRouter() {
  const router = Router();

  router.post(
    '/register',
    createRegisterLimiter(),
    validate({ body: registerSchema }),
    authController.register,
  );
  router.post(
    '/login',
    createLoginLimiter(),
    validate({ body: loginSchema }),
    authController.login,
  );
  router.post(
    '/refresh',
    createRefreshLimiter(),
    validate({ body: refreshSchema }),
    authController.refresh,
  );
  router.post('/logout', authenticate, authController.logout);
  router.get('/me', authenticate, authController.me);

  return router;
}
