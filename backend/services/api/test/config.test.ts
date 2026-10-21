import { describe, expect, it } from 'vitest';
import { loadConfig } from '#/config.ts';

const BASE = { DATABASE_URL: 'postgres://user:pw@localhost:5432/test', JWT_SECRET: 'fake-test-secret' };

describe(loadConfig.name, () => {
  it('needs DATABASE_URL', () => {
    expect(() => loadConfig({ JWT_SECRET: BASE.JWT_SECRET })).toThrow('DATABASE_URL is required');
    expect(() => loadConfig({ ...BASE, DATABASE_URL: '' })).toThrow('DATABASE_URL is required');
  });

  it('needs a JWT_SECRET of at least 8 characters', () => {
    expect(() => loadConfig({ DATABASE_URL: BASE.DATABASE_URL })).toThrow('JWT_SECRET must be at least 8 characters');
    expect(() => loadConfig({ ...BASE, JWT_SECRET: '1234567' })).toThrow('JWT_SECRET must be at least 8 characters');
    expect(loadConfig({ ...BASE, JWT_SECRET: '12345678' }).jwtSecret).toBe('12345678');
  });

  it('fills in the defaults', () => {
    expect(loadConfig(BASE)).toEqual({
      port: 3000,
      host: '0.0.0.0',
      databaseUrl: BASE.DATABASE_URL,
      jwtSecret: BASE.JWT_SECRET,
      jwtTtl: 7 * 24 * 3600,
      logLevel: 'info',
      corsOrigin: true,
      adminUsernames: [],
      loginBackoff: { freeTries: 5, firstWaitMs: 1000, maxWaitMs: 300_000, forgetAfterMs: 900_000 },
      signUpProof: { cost: 1000, counterMin: 5000, counterMax: 10_000, expiresAfterMs: 600_000 },
    });
  });

  it('reads the optional settings', () => {
    const config = loadConfig({ ...BASE, PORT: '3100', HOST: '127.0.0.1', JWT_TTL: '60', LOG_LEVEL: 'debug', CORS_ORIGIN: 'http://localhost:5173' });
    expect(config).toMatchObject({ port: 3100, host: '127.0.0.1', jwtTtl: 60, logLevel: 'debug', corsOrigin: 'http://localhost:5173' });
  });

  it('allows every origin when CORS_ORIGIN is empty', () => {
    expect(loadConfig({ ...BASE, CORS_ORIGIN: '' }).corsOrigin).toBe(true);
  });

  it('parses ADMIN_USERNAMES: comma separated, trimmed, lower case, blanks dropped', () => {
    expect(loadConfig({ ...BASE, ADMIN_USERNAMES: ' Alice, BOB ,,carol, ' }).adminUsernames).toEqual(['alice', 'bob', 'carol']);
    expect(loadConfig({ ...BASE, ADMIN_USERNAMES: '' }).adminUsernames).toEqual([]);
  });

  it('reads the sign-up proof settings, its expiry in seconds', () => {
    const config = loadConfig({ ...BASE, SIGNUP_POW_COST: '500', SIGNUP_POW_COUNTER_MIN: '100', SIGNUP_POW_COUNTER_MAX: '200', SIGNUP_POW_EXPIRES: '60' });
    expect(config.signUpProof).toEqual({ cost: 500, counterMin: 100, counterMax: 200, expiresAfterMs: 60_000 });
  });

  it('reads the login backoff settings in seconds', () => {
    const config = loadConfig({ ...BASE, LOGIN_FREE_TRIES: '3', LOGIN_FIRST_WAIT: '2', LOGIN_MAX_WAIT: '60', LOGIN_RESET_AFTER: '600' });
    expect(config.loginBackoff).toEqual({ freeTries: 3, firstWaitMs: 2000, maxWaitMs: 60_000, forgetAfterMs: 600_000 });
  });

  it('reads process.env by default', () => {
    const saved = { ...process.env };
    try {
      Object.assign(process.env, BASE, { PORT: '4321' });
      expect(loadConfig()).toMatchObject({ databaseUrl: BASE.DATABASE_URL, port: 4321 });
    } finally {
      for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
      Object.assign(process.env, saved);
    }
  });
});
