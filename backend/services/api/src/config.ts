import type { LoginBackoffConfig } from '#/auth/login-backoff.ts';
import type { SignUpProofConfig } from '#/auth/signup-proof.ts';

export interface ApiConfig {
  port: number;
  host: string;
  databaseUrl: string;
  jwtSecret: string;
  /** access token lifetime, seconds */
  jwtTtl: number;
  logLevel: string;
  corsOrigin: string | boolean;
  /** usernames that are always operators (comma separated ADMIN_USERNAMES) */
  adminUsernames: string[];
  /** the wait after repeated wrong passwords for a username (LOGIN_FREE_TRIES, LOGIN_FIRST_WAIT …, in seconds) */
  loginBackoff: LoginBackoffConfig;
  /** the proof of work asked for on sign-up (SIGNUP_POW_COST, SIGNUP_POW_COUNTER_MIN …, the expiry in seconds) */
  signUpProof: SignUpProofConfig;
}

export function loadConfig(env = process.env): ApiConfig {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const jwtSecret = env.JWT_SECRET ?? '';
  if (jwtSecret.length < 8) throw new Error('JWT_SECRET must be at least 8 characters');
  return {
    port: Number(env.PORT ?? 3000),
    host: env.HOST ?? '0.0.0.0',
    databaseUrl,
    jwtSecret,
    jwtTtl: Number(env.JWT_TTL ?? 7 * 24 * 3600),
    logLevel: env.LOG_LEVEL ?? 'info',
    corsOrigin: env.CORS_ORIGIN ? env.CORS_ORIGIN : true,
    adminUsernames: (env.ADMIN_USERNAMES ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    loginBackoff: {
      freeTries: Number(env.LOGIN_FREE_TRIES ?? 5),
      firstWaitMs: Number(env.LOGIN_FIRST_WAIT ?? 1) * 1000,
      maxWaitMs: Number(env.LOGIN_MAX_WAIT ?? 5 * 60) * 1000,
      forgetAfterMs: Number(env.LOGIN_RESET_AFTER ?? 15 * 60) * 1000,
    },
    signUpProof: {
      cost: Number(env.SIGNUP_POW_COST ?? 1000),
      counterMin: Number(env.SIGNUP_POW_COUNTER_MIN ?? 5000),
      counterMax: Number(env.SIGNUP_POW_COUNTER_MAX ?? 10_000),
      expiresAfterMs: Number(env.SIGNUP_POW_EXPIRES ?? 10 * 60) * 1000,
    },
  };
}
