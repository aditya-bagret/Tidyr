import cors, { type CorsOptions } from 'cors';
import express, { type Request, type Response } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env';
import { logger } from './config/logger';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { createApiLimiter } from './middleware/rateLimit';
import { requestId } from './middleware/requestId';
import { healthRouter } from './modules/health/health.routes';
import { createApiRouter } from './routes';

const corsOptions: CorsOptions = {
  // No Origin header (mobile app, curl) is allowed. An unlisted origin gets no CORS headers, so the
  // browser blocks it. Passing an Error here would turn the request into a 500.
  origin: (origin, callback) => {
    callback(null, origin === undefined || env.WEB_ORIGINS.includes(origin));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  // Browsers hide non-safelisted response headers cross-origin; the web client reads these (D-026).
  exposedHeaders: ['Retry-After', 'X-Request-Id'],
  maxAge: 600,
};

/** Builds the Express app without listening, so server.ts and the tests share it. Order: §4.3. */
export function createApp() {
  const app = express();

  // req.ip (and so every rate-limit key) must be the client, not a proxy. Each trusted hop is one
  // right-most X-Forwarded-For entry; Render puts three proxies in front of us, and entries a client
  // prepends itself stay untrusted (D-035).
  app.set('trust proxy', env.TRUST_PROXY_HOPS);

  app.use(requestId);
  app.use(
    pinoHttp<Request, Response>({
      logger,
      genReqId: (req) => req.requestId,
      customProps: (req) => (req.user ? { userId: req.user.id } : {}),
    }),
  );
  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '100kb' }));

  // Before the limiter so health checks can never get a 429.
  app.use('/api/health', healthRouter);

  app.use('/api', createApiLimiter());
  app.use('/api', createApiRouter());

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
