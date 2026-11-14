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

/** The secret docker-compose.yml and .env.example give a development stack: it's public, so it signs nothing in production. */
const DEV_JWT_SECRET = 'change-me-in-production';
/** The shortest secret a production server starts with: `openssl rand -hex 32` gives 64 characters. */
const PRODUCTION_SECRET_LENGTH = 32;

/**
 * Refuses a JWT secret anyone could guess. Whoever knows the secret can sign a token for any account, the operator's
 * included, so a production server (NODE_ENV, set by the backend image) needs a long one that isn't the development
 * default. A development stack runs the same image: its compose file says so with ALLOW_WEAK_JWT_SECRET=true.
 */
function checkJwtSecret(secret: string, env: NodeJS.ProcessEnv): void {
  if (secret.length < 8) throw new Error('JWT_SECRET must be at least 8 characters');
  const allowWeak = env.ALLOW_WEAK_JWT_SECRET ?? 'false';
  // eslint-disable-next-line marchlands/no-string-compare -- the setting's own spelling, read from the environment
  if (allowWeak !== 'true' && allowWeak !== 'false') throw new Error(`ALLOW_WEAK_JWT_SECRET must be true or false, not ${allowWeak}`);
  // eslint-disable-next-line marchlands/no-string-compare -- as above
  if (env.NODE_ENV !== 'production' || allowWeak === 'true') return;
  if (secret === DEV_JWT_SECRET) throw new Error('JWT_SECRET is the development default: generate one with openssl rand -hex 32');
  if (secret.length < PRODUCTION_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must be at least ${PRODUCTION_SECRET_LENGTH} characters in production: generate one with openssl rand -hex 32`);
  }
}

export function loadConfig(env = process.env): ApiConfig {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const jwtSecret = env.JWT_SECRET ?? '';
  checkJwtSecret(jwtSecret, env);
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
