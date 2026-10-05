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
  };
}
