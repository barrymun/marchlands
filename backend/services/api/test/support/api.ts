// Runs a test against the real API app (buildApp) without a network: requests go through Fastify's inject. The app
// is given the open test transaction as its database, so every route's game transaction becomes a savepoint and
// the whole test is rolled back at the end, like the game service tests (backend/packages/game/test/support).

import type { Db } from '@marchlands/db';
import { runGame, type Ctx } from '@marchlands/game';
import { buildApp } from '../../src/app.ts';
import type { ApiConfig } from '../../src/config.ts';
import { testDb } from '../../../../packages/game/test/support/db.ts';

export const TEST_CONFIG: ApiConfig = {
  port: 0,
  host: '127.0.0.1',
  databaseUrl: 'unused: the app is given the test transaction',
  jwtSecret: 'test-secret-not-for-production',
  jwtTtl: 3600,
  logLevel: 'silent',
  corsOrigin: true,
  adminUsernames: [],
};

/** What a request answered: the HTTP status and the parsed JSON body. */
export interface Answer<T = unknown> {
  status: number;
  body: { ok: number; data?: T; error?: { code: string; params?: Record<string, unknown> }; [k: string]: unknown };
}

export interface Session {
  token: string;
  accountId: number;
  playerId: number | null;
  isAdmin: boolean;
  username: string;
}

export interface TestApi {
  app: Awaited<ReturnType<typeof buildApp>>;
  /** the test transaction (the app's database): read what a request stored */
  db: Db;
  /** any request; `token` sends `Authorization: Bearer` */
  call<T = unknown>(method: string, url: string, opts?: { body?: unknown; token?: string; query?: Record<string, string> }): Promise<Answer<T>>;
  /** a request that must succeed (ok: 1); returns its data */
  ok<T = unknown>(method: string, url: string, opts?: { body?: unknown; token?: string; query?: Record<string, string> }): Promise<T>;
  /** a request that must fail with this message code (and status, if given); returns the answer */
  refused(method: string, url: string, code: string, opts?: { body?: unknown; token?: string; status?: number }): Promise<Answer>;
  /**
   * Register an account. The database is empty in every test, so the first account is the server operator
   * (auth.ts): call `operator()` first when a test needs ordinary players only.
   */
  register(username?: string): Promise<Session>;
  /** Register the operator account (the first one). */
  operator(): Promise<Session>;
  /** Register an account and create its player and starting city; returns the session with a token naming the player. */
  player(name?: string): Promise<Session & { playerId: number; cityId: number }>;
  /** Run game code directly (a savepoint of the test transaction), e.g. to set up state with the admin service. */
  game<T>(fn: (ctx: Ctx) => Promise<T>): Promise<T>;
}

const ROLLBACK = Symbol('rollback');
let serial = 0;

/** Run `fn` with the API app on a test transaction that is rolled back afterwards. */
export async function apiTest<T>(fn: (api: TestApi) => Promise<T>): Promise<T> {
  let result: T | undefined;
  try {
    await testDb().transaction(async (tx) => {
      const db = tx as unknown as Db;
      const app = await buildApp({ db, config: TEST_CONFIG, gateway: null, logger: false });
      try {
        result = await fn(makeApi(app, db));
      } finally {
        await app.close();
      }
      throw ROLLBACK;
    });
  } catch (err) {
    if (err !== ROLLBACK) throw err;
  }
  return result as T;
}

function makeApi(app: TestApi['app'], db: Db): TestApi {
  const call: TestApi['call'] = async (method, url, opts = {}) => {
    const res = await app.inject({
      method: method as 'GET',
      url: url.startsWith('/') ? url : `/api/v1/${url}`,
      query: opts.query,
      headers: opts.token ? { authorization: `Bearer ${opts.token}` } : undefined,
      ...(opts.body !== undefined ? { payload: opts.body as object } : {}),
    });
    return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : {} } as Answer<never>;
  };
  const api: TestApi = {
    app,
    db,
    call,
    async ok(method, url, opts) {
      const a = await call(method, url, opts);
      if (a.status !== 200 || a.body.ok !== 1) throw new Error(`${method} ${url} answered ${a.status} ${JSON.stringify(a.body)}`);
      return a.body.data as never;
    },
    async refused(method, url, code, opts = {}) {
      const a = await call(method, url, opts);
      if (a.body.ok === 1 || a.body.error?.code !== code || (opts.status != null && a.status !== opts.status)) {
        throw new Error(`${method} ${url}: expected ${code}${opts.status ? ` (${opts.status})` : ''}, got ${a.status} ${JSON.stringify(a.body)}`);
      }
      return a;
    },
    async register(username = `user${++serial}`) {
      const data = await api.ok<Omit<Session, 'username'>>('POST', 'auth/register', {
        body: { username, password: 'test-password', email: `${username}@example.test` },
      });
      return { ...data, username };
    },
    operator: () => api.register(`operator${++serial}`),
    async player(name = `Player${++serial}`) {
      const s = await api.register(name.toLowerCase());
      await api.ok('POST', 'player', { token: s.token, body: { userName: name, castleName: `${name} City`, flag: 'T', sex: 0 } });
      // a fresh token names the player (the API reads it from the token, or looks it up)
      const relog = await api.ok<Omit<Session, 'username'>>('POST', 'auth/login', { body: { username: s.username, password: 'test-password' } });
      const state = await api.ok<{ castles: { id: number }[] }>('GET', 'player', { token: relog.token });
      return { ...relog, username: s.username, playerId: relog.playerId!, cityId: state.castles[0].id };
    },
    game: (fn) => runGame(db, fn, { retries: 0 }),
  };
  return api;
}
