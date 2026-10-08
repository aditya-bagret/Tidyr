import { z } from 'zod';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

const UNIT_SECONDS = { s: 1, m: 60, h: 3600, d: 86_400 } as const;
const DURATION = /^([1-9]\d*)([smhd])$/;

/** "15m" → 900. Parsed here so a typo fails at boot, not at the first login. */
const durationInSeconds = z
  .string()
  .regex(DURATION, 'must be a duration like 900s, 15m, 1h or 1d')
  .transform((value) => {
    const [, amount, unit] = DURATION.exec(value) ?? [];
    return Number(amount) * UNIT_SECONDS[unit as keyof typeof UNIT_SECONDS];
  });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  JWT_SECRET: z.string().min(32, 'must be at least 32 characters'),
  /** Access-token lifetime in seconds. `prefault` runs the default through the parser. */
  JWT_ACCESS_TTL: durationInSeconds.prefault('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  REFRESH_REUSE_GRACE_SECONDS: z.coerce.number().int().nonnegative().default(30),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  WEB_ORIGINS: z
    .string()
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.url()).min(1, 'must list at least one origin')),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_REGISTER_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_API_MAX: z.coerce.number().int().positive().default(300),
  /** Trusted proxies in front of the API: 0 locally, 3 on Render (D-035). */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
});

export type Env = z.infer<typeof envSchema>;

/** Throws a readable error listing every invalid variable (never their values). */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return result.data;
}

function loadEnv(): Env {
  try {
    return parseEnv(process.env);
  } catch (error) {
    // Fail fast at boot. The logger isn't available yet because it depends on this config.
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

export const env = loadEnv();
