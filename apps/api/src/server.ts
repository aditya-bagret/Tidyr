import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './lib/prisma';

const SHUTDOWN_TIMEOUT_MS = 10_000;

const server = createApp().listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'server.start');
});

let shuttingDown = false;

function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'server.shutdown');

  // Stop accepting connections, let in-flight requests finish, then release the DB pool.
  // A stuck keep-alive connection must not block a redeploy forever.
  const forceExit = setTimeout(() => {
    logger.error('server.shutdown_timeout');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  server.close(() => {
    prisma
      .$disconnect()
      .then(() => process.exit(0))
      .catch((err: unknown) => {
        logger.error({ err }, 'server.shutdown_failed');
        process.exit(1);
      });
  });
  server.closeIdleConnections();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
