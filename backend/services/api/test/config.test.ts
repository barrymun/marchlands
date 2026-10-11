import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.ts';

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
