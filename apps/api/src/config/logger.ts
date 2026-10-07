import { pino } from 'pino';
import { env } from './env';

/** Never log credentials, tokens or password hashes (SEC-08). */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.body.password',
  'req.body.refreshToken',
  '*.passwordHash',
];

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
  redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
  ...(env.NODE_ENV === 'development' && {
    transport: { target: 'pino-pretty', options: { translateTime: 'SYS:HH:MM:ss' } },
  }),
});
