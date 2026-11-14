import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';

import { accounts, players } from '@marchlands/db';
import { admin } from '@marchlands/game';

import { buildApp } from '#/app.ts';
import { signToken, verifyToken } from '#/auth/jwt.ts';
import { apiTest, type Session, TEST_CONFIG, type TestApi } from '#test/support/api.ts';

type AuthSession = Omit<Session, 'username'> & { hasPlayer: boolean };
const claimsOf = (token: string) => verifyToken(token, TEST_CONFIG.jwtSecret);
const login = (api: TestApi, username: string, password = 'test-password') => api.ok<AuthSession>('POST', 'auth/login', { body: { username, password } });

/** The app on the test transaction with ADMIN_USERNAMES set. */
async function withAdminUsernames<T>(api: TestApi, adminUsernames: string[], fn: (call: (url: string, body: object) => Promise<AuthSession>) => Promise<T>) {
  const app = await buildApp({ db: api.db, config: { ...TEST_CONFIG, adminUsernames }, gateway: null, logger: false });
  try {
    return await fn(async (url, body) => {
      const res = await app.inject({ method: 'POST', url: `/api/v1/${url}`, payload: body });
      expect(res.statusCode, res.body).toBe(200);
      return res.json().data;
    });
  } finally {
    await app.close();
  }
}

describe('GET /auth/challenge', () => {
  it('gives a signed PBKDF2 puzzle at the configured cost, valid for 10 minutes and never cached', () =>
    apiTest(async (api) => {
      const res = await api.app.inject({ method: 'GET', url: '/api/v1/auth/challenge' });
      expect(res.statusCode).toBe(200);
      expect(res.headers['cache-control']).toBe('no-store');
      const { parameters, signature } = res.json().data;
      expect(parameters).toMatchObject({ algorithm: 'PBKDF2/SHA-256', cost: TEST_CONFIG.signUpProof.cost, keyLength: 32 });
      expect(parameters.expiresAt).toBeGreaterThan(Date.now() / 1000 + 9 * 60);
      expect(parameters.expiresAt).toBeLessThanOrEqual(Math.ceil(Date.now() / 1000) + 10 * 60);
      expect(signature).toMatch(/^[0-9a-f]{64}$/);
    }));
});

describe('the auth routes', () => {
  it('answer with cache-control: no-store, so a token or an email is never kept by a browser or a proxy', () =>
    apiTest(async (api) => {
      const s = await api.register('alice');
      const authorization = `Bearer ${s.token}`;
      const answers = [
        await api.app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { username: 'alice', password: 'test-password' } }),
        await api.app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { username: 'alice', password: 'wrong-password' } }),
        await api.app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { authorization } }),
        await api.app.inject({ method: 'POST', url: '/api/v1/auth/refresh', headers: { authorization } }),
        await api.app.inject({ method: 'GET', url: '/api/v1/auth/me' }),
      ];
      expect(answers.map((res) => res.statusCode)).toEqual([200, 401, 200, 200, 401]);
      for (const res of answers) expect(res.headers['cache-control']).toBe('no-store');
      // and only they: a game route says nothing about caching
      const other = await api.app.inject({ method: 'GET', url: '/api/v1/player', headers: { authorization } });
      expect(other.headers['cache-control']).toBeUndefined();
    }));
});

describe('POST /auth/register', () => {
  it('creates an account and a session; the first account is the operator', () =>
    apiTest(async (api) => {
      const first = await api.register('alice');
      expect(first).toMatchObject({ isAdmin: true, playerId: null, hasPlayer: false });
      expect(first.token).toEqual(expect.any(String));
      const second = await api.register('bob');
      expect(second.isAdmin).toBe(false);
      const [row] = await api.db.select().from(accounts).where(eq(accounts.id, second.accountId));
      expect(row).toMatchObject({ username: 'bob', email: 'bob@example.test', isAdmin: false });
      expect(row!.passwordHash).not.toContain('test-password');
    }));

  it('refuses a username or email already taken, in any case', () =>
    apiTest(async (api) => {
      await api.register('alice');
      await api.refused('POST', 'auth/register', 'auth.alreadyRegistered', {
        body: { username: 'ALICE', password: 'another-pass', email: 'new@example.test', proof: await api.signUpProof() },
        status: 409,
      });
      await api.refused('POST', 'auth/register', 'auth.alreadyRegistered', {
        body: { username: 'carol', password: 'another-pass', email: 'Alice@Example.test', proof: await api.signUpProof() },
        status: 409,
      });
    }));

  it('refuses a sign-up without a solved puzzle', () =>
    apiTest(async (api) => {
      const body = { username: 'mallory', password: 'test-password', email: 'mallory@example.test' };
      await api.refused('POST', 'auth/register', 'common.invalidRequest', { body, status: 400 });
      const { challenge, solution } = await api.signUpProof();
      const wrong = { challenge, solution: { ...solution, counter: solution.counter + 1 } };
      await api.refused('POST', 'auth/register', 'auth.signUpCheckFailed', { body: { ...body, proof: wrong }, status: 403 });
      // the server signed the puzzle, so it can't be made easier
      const easier = { challenge: { ...challenge, parameters: { ...challenge.parameters, cost: 1, keyPrefix: '00' } }, solution };
      await api.refused('POST', 'auth/register', 'auth.signUpCheckFailed', { body: { ...body, proof: easier }, status: 403 });
    }));

  it('accepts each solved puzzle once, but again after the username was taken', () =>
    apiTest(async (api) => {
      await api.register('alice');
      const proof = await api.signUpProof();
      const taken = { username: 'alice', password: 'test-password', email: 'other@example.test', proof };
      await api.refused('POST', 'auth/register', 'auth.alreadyRegistered', { body: taken, status: 409 });
      await api.ok('POST', 'auth/register', { body: { ...taken, username: 'alice2' } });
      await api.refused('POST', 'auth/register', 'auth.signUpCheckFailed', {
        body: { ...taken, username: 'alice3', email: 'third@example.test' },
        status: 403,
      });
    }));

  it('refuses a puzzle solved after it expired (10 minutes)', () =>
    apiTest(async (api) => {
      const proof = await api.signUpProof();
      const later = Date.now() + 10 * 60_000 + 1000;
      vi.spyOn(Date, 'now').mockReturnValue(later);
      try {
        await api.refused('POST', 'auth/register', 'auth.signUpCheckExpired', {
          body: { username: 'olivia', password: 'test-password', email: 'olivia@example.test', proof },
          status: 403,
        });
      } finally {
        vi.restoreAllMocks();
      }
    }));

  it('refuses a malformed body with the validation issues', () =>
    apiTest(async (api) => {
      const a = await api.refused('POST', 'auth/register', 'common.invalidRequest', { body: { username: 'x' }, status: 400 });
      expect(a.body.issues).toEqual(expect.any(Array));
    }));

  it('refuses usernames with other characters, short passwords and bad emails', () =>
    apiTest(async (api) => {
      const valid = { username: 'valid_name.1', password: 'long-enough', email: 'valid@example.test', proof: await api.signUpProof() };
      for (const body of [
        { ...valid, username: 'ab' },
        { ...valid, username: 'has space' },
        { ...valid, username: 'x'.repeat(31) },
        { ...valid, password: '12345' },
        { ...valid, email: 'not-an-email' },
      ]) {
        await api.refused('POST', 'auth/register', 'common.invalidRequest', { body, status: 400 });
      }
      expect(await api.ok('POST', 'auth/register', { body: valid })).toMatchObject({ isAdmin: true });
    }));

  it('trims the username', () =>
    apiTest(async (api) => {
      const s = await api.ok<AuthSession>('POST', 'auth/register', {
        body: { username: '  dave  ', password: 'test-password', email: 'dave@example.test', proof: await api.signUpProof() },
      });
      const [row] = await api.db.select().from(accounts).where(eq(accounts.id, s.accountId));
      expect(row!.username).toBe('dave');
    }));

  it('issues a token naming the account, marked for operators only', () =>
    apiTest(async (api) => {
      const op = await api.operator();
      const s = await api.register('erin');
      expect(claimsOf(op.token)).toMatchObject({ sub: op.accountId, adm: true });
      expect(claimsOf(s.token)).toMatchObject({ sub: s.accountId });
      expect(claimsOf(s.token)).not.toHaveProperty('adm');
      expect(claimsOf(s.token)).not.toHaveProperty('pid');
      expect(claimsOf(s.token)!.exp - claimsOf(s.token)!.iat).toBe(TEST_CONFIG.jwtTtl);
    }));

  it('makes the accounts listed in ADMIN_USERNAMES operators, in any case', () =>
    apiTest(async (api) => {
      await api.operator();
      await withAdminUsernames(api, ['boss'], async (post) => {
        const boss = { username: 'Boss', password: 'test-password', email: 'boss@example.test', proof: await api.signUpProof() };
        expect(await post('auth/register', boss)).toMatchObject({ isAdmin: true });
        const worker = { username: 'worker', password: 'test-password', email: 'worker@example.test', proof: await api.signUpProof() };
        expect(await post('auth/register', worker)).toMatchObject({
          isAdmin: false,
        });
      });
    }));
});

describe('POST /auth/login', () => {
  it('logs in by username, in any case, and records the login', () =>
    apiTest(async (api) => {
      const s = await api.register('frank');
      await api.db.update(accounts).set({ lastLoginAt: 0 }).where(eq(accounts.id, s.accountId));
      const session = await login(api, 'FRANK');
      expect(session).toMatchObject({ accountId: s.accountId, playerId: null, hasPlayer: false, isAdmin: true });
      expect(claimsOf(session.token)).toMatchObject({ sub: s.accountId });
      const [row] = await api.db.select().from(accounts).where(eq(accounts.id, s.accountId));
      expect(row!.lastLoginAt).toBeGreaterThan(0);
    }));

  it('names the player in the session and the token once there is one', () =>
    apiTest(async (api) => {
      await api.operator();
      const p = await api.player('Grace');
      await api.db.update(players).set({ lastLoginAt: 0 }).where(eq(players.id, p.playerId));
      const session = await login(api, p.username);
      expect(session).toMatchObject({ accountId: p.accountId, playerId: p.playerId, hasPlayer: true, isAdmin: false });
      expect(claimsOf(session.token)).toMatchObject({ sub: p.accountId, pid: p.playerId });
      const [row] = await api.db.select({ lastLoginAt: players.lastLoginAt }).from(players).where(eq(players.id, p.playerId));
      expect(row!.lastLoginAt).toBeGreaterThan(0);
    }));

  it('refuses a wrong password and an unknown username alike, with 401 auth.wrongPassword', () =>
    apiTest(async (api) => {
      await api.register('heidi');
      const wrong = await api.refused('POST', 'auth/login', 'auth.wrongPassword', { body: { username: 'heidi', password: 'wrong-password' }, status: 401 });
      const unknown = await api.refused('POST', 'auth/login', 'auth.wrongPassword', { body: { username: 'nobody', password: 'test-password' }, status: 401 });
      expect(unknown.body).toEqual(wrong.body);
    }));

  it('after 5 wrong passwords, refuses with 429 auth.tooManyTries until the wait is over, the right password included', () =>
    apiTest(async (api) => {
      await api.register('judy');
      const wrong = { username: 'judy', password: 'wrong-password' };
      for (let i = 0; i < 5; i++) await api.refused('POST', 'auth/login', 'auth.wrongPassword', { body: wrong, status: 401 });
      const a = await api.refused('POST', 'auth/login', 'auth.tooManyTries', { body: { username: 'JUDY', password: 'test-password' }, status: 429 });
      expect(a.body.error).toEqual({ code: 'auth.tooManyTries', params: { wait: { duration: 1000 } } });
      const res = await api.app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: wrong });
      expect(res.headers['retry-after']).toBe('1');
      // other usernames are not held up
      await api.register('ken');
      await login(api, 'ken');
    }));

  it('counts wrong passwords for a username with no account alike, so the wait never tells whether it exists', () =>
    apiTest(async (api) => {
      const body = { username: 'nobody', password: 'test-password' };
      for (let i = 0; i < 5; i++) await api.refused('POST', 'auth/login', 'auth.wrongPassword', { body, status: 401 });
      await api.refused('POST', 'auth/login', 'auth.tooManyTries', { body, status: 429 });
    }));

  it('refuses a banned account with 403 and the reason, only once the password is right', () =>
    apiTest(async (api) => {
      await api.operator();
      const s = await api.register('ivan');
      await api.game((ctx) => admin.setBan(ctx, s.accountId, true, 'botting'));
      await api.refused('POST', 'auth/login', 'auth.wrongPassword', { body: { username: 'ivan', password: 'wrong-password' }, status: 401 });
      const a = await api.refused('POST', 'auth/login', 'auth.banned', { body: { username: 'ivan', password: 'test-password' }, status: 403 });
      expect(a.body.error).toEqual({ code: 'auth.banned', params: { reason: 'botting' } });
      await api.game((ctx) => admin.setBan(ctx, s.accountId, false));
      await login(api, 'ivan');
    }));

  it('refuses a malformed body', () =>
    apiTest(async (api) => {
      await api.refused('POST', 'auth/login', 'common.invalidRequest', { body: { username: 'judy' }, status: 400 });
      await api.refused('POST', 'auth/login', 'common.invalidRequest', { body: { username: 'judy', password: 'short' }, status: 400 });
    }));

  it('promotes an account listed in ADMIN_USERNAMES, and keeps it an operator', () =>
    apiTest(async (api) => {
      await api.operator();
      const s = await api.register('kim');
      expect(s.isAdmin).toBe(false);
      await withAdminUsernames(api, ['kim'], async (post) => {
        expect(await post('auth/login', { username: 'kim', password: 'test-password' })).toMatchObject({ isAdmin: true });
      });
      const [row] = await api.db.select().from(accounts).where(eq(accounts.id, s.accountId));
      expect(row!.isAdmin).toBe(true);
      expect(await login(api, 'kim')).toMatchObject({ isAdmin: true });
    }));
});

describe('GET /auth/me', () => {
  it('answers the account and its player, without the password hash', () =>
    apiTest(async (api) => {
      await api.operator();
      const s = await api.register('leo');
      const before = await api.ok<Record<string, unknown>>('GET', 'auth/me', { token: s.token });
      expect(before).toEqual({ id: s.accountId, username: 'leo', email: 'leo@example.test', isAdmin: false, createdAt: expect.any(Number), player: null });
      const p = await api.player('Mia');
      expect(await api.ok('GET', 'auth/me', { token: p.token })).toMatchObject({ id: p.accountId, player: { id: p.playerId, name: 'Mia' } });
    }));

  it('needs a valid token', () =>
    apiTest(async (api) => {
      await api.refused('GET', 'auth/me', 'auth.notLoggedIn', { status: 401 });
      await api.refused('GET', 'auth/me', 'auth.notLoggedIn', { token: 'garbage', status: 401 });
    }));

  it('refuses a token for an account that does not exist with 401 auth.accountNotFound', () =>
    apiTest(async (api) => {
      const token = signToken({ sub: 999_999 }, TEST_CONFIG.jwtSecret, 60);
      await api.refused('GET', 'auth/me', 'auth.accountNotFound', { token, status: 401 });
    }));
});

describe('POST /auth/refresh', () => {
  it('issues a fresh token that names the player created since', () =>
    apiTest(async (api) => {
      await api.operator();
      const s = await api.register('nina');
      await api.ok('POST', 'player', { token: s.token, body: { userName: 'Nina', castleName: 'Nina City', flag: 'N', sex: 1 } });
      expect(claimsOf(s.token)).not.toHaveProperty('pid');
      const fresh = await api.ok<AuthSession>('POST', 'auth/refresh', { token: s.token });
      const [p] = await api.db.select({ id: players.id }).from(players).where(eq(players.accountId, s.accountId));
      expect(fresh).toMatchObject({ accountId: s.accountId, playerId: p!.id, hasPlayer: true, isAdmin: false });
      expect(claimsOf(fresh.token)).toMatchObject({ sub: s.accountId, pid: p!.id });
    }));

  it('marks the token of an operator', () =>
    apiTest(async (api) => {
      const op = await api.operator();
      const fresh = await api.ok<AuthSession>('POST', 'auth/refresh', { token: op.token });
      expect(fresh.isAdmin).toBe(true);
      expect(claimsOf(fresh.token)).toMatchObject({ adm: true });
    }));

  it('refuses a banned account (403 auth.banned), an unknown account and a missing token (401)', () =>
    apiTest(async (api) => {
      await api.operator();
      const s = await api.register('oscar');
      await api.game((ctx) => admin.setBan(ctx, s.accountId, true, 'spam'));
      await api.refused('POST', 'auth/refresh', 'auth.banned', { token: s.token, status: 403 });
      await api.refused('POST', 'auth/refresh', 'auth.accountNotFound', { token: signToken({ sub: 999_999 }, TEST_CONFIG.jwtSecret, 60), status: 401 });
      await api.refused('POST', 'auth/refresh', 'auth.notLoggedIn', { status: 401 });
    }));
});

describe('a new player', () => {
  it('logs in, creates a player and sees their city', () =>
    apiTest(async (api) => {
      await api.operator();
      const p = await api.player('Tester');
      expect(p.playerId).toEqual(expect.any(Number));
      const state = await api.ok<{ playerInfo: { userName: string }; castles: { id: number; name: string }[] }>('GET', 'player', { token: p.token });
      expect(state.playerInfo.userName).toBe('Tester');
      expect(state.castles).toEqual([expect.objectContaining({ id: p.cityId, name: 'Tester City' })]);
    }));

  it('needs a token', () =>
    apiTest(async (api) => {
      const a = await api.call('GET', 'player');
      expect(a.status).toBe(401);
      expect(a.body.ok).not.toBe(1);
    }));
});
