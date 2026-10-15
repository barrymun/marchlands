// The app's plumbing that answers without touching the database (the app gets no database here, like openapi.ts).

import { afterEach, describe, expect, it } from 'vitest';

import { PushCmd } from '@marchlands/contracts';
import type { Db } from '@marchlands/db';

import { buildApp } from '#/app.ts';
import { signToken } from '#/auth/jwt.ts';
import type { ApiConfig } from '#/config.ts';
import { operationIdOf } from '#/operation-id.ts';
import { openSocket } from '#test/support/ws-client.ts';

const CONFIG: ApiConfig = {
  port: 0,
  host: '127.0.0.1',
  databaseUrl: 'unused',
  jwtSecret: 'fake-app-test-secret',
  jwtTtl: 3600,
  logLevel: 'silent',
  corsOrigin: true,
  adminUsernames: [],
};

let app: Awaited<ReturnType<typeof buildApp>> | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function build(config: Partial<ApiConfig> = {}) {
  app = await buildApp({ db: {} as Db, config: { ...CONFIG, ...config }, gateway: null, logger: false });
  await app.ready();
  return app;
}

const METHODS = ['get', 'put', 'post', 'delete', 'patch'] as const;
type Operation = { operationId?: string; security?: unknown[] };
type Spec = { openapi: string; paths: Record<string, Partial<Record<(typeof METHODS)[number], Operation>>>; components: { securitySchemes: object } };

describe('the JSON body parser', () => {
  it('takes an empty JSON body as {}', async () => {
    const app = await build();
    const res = await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: { 'content-type': 'application/json' }, payload: '' });
    // {} reaches validation (the fields are missing), not a parser error
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ ok: -87, error: { code: 'common.invalidRequest' }, issues: expect.any(Array) });
  });

  it('refuses malformed JSON with 400', async () => {
    const app = await build();
    const res = await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: { 'content-type': 'application/json' }, payload: '{"username":' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ ok: -99, error: { code: 'common.requestFailed', params: { status: 400 } } });
  });

  it('refuses a body over 256 KiB with 413', async () => {
    const app = await build();
    const payload = JSON.stringify({ username: 'someone', password: 'x'.repeat(256 * 1024) });
    const res = await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: { 'content-type': 'application/json' }, payload });
    expect(res.statusCode).toBe(413);
    expect(res.json()).toEqual({ ok: -99, error: { code: 'common.requestFailed', params: { status: 413 } } });
  });
});

describe('unknown routes', () => {
  it('answer 404 common.routeNotFound', async () => {
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/api/v1/nowhere' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ ok: -99, error: { code: 'common.routeNotFound', params: { method: 'GET', url: '/api/v1/nowhere' } } });
  });
});

describe('CORS', () => {
  const preflight = (app: Awaited<ReturnType<typeof build>>, origin: string) =>
    app.inject({
      method: 'OPTIONS',
      url: '/api/v1/auth/login',
      headers: { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization,content-type' },
    });

  it('allows any origin, with credentials, by default', async () => {
    const res = await preflight(await build(), 'http://game.example.test');
    expect(res.statusCode).toBe(204);
    expect(res.headers).toMatchObject({ 'access-control-allow-origin': 'http://game.example.test', 'access-control-allow-credentials': 'true' });
  });

  it('allows only CORS_ORIGIN when it is set', async () => {
    const app = await build({ corsOrigin: 'http://game.example.test' });
    expect((await preflight(app, 'http://game.example.test')).headers['access-control-allow-origin']).toBe('http://game.example.test');
    // a fixed origin is always answered as itself: the browser refuses the others
    expect((await preflight(app, 'http://evil.example.test')).headers['access-control-allow-origin']).toBe('http://game.example.test');
  });
});

describe('API docs', () => {
  it('serves Swagger UI at /docs and the document at /docs/json', async () => {
    const app = await build();
    const ui = await app.inject({ method: 'GET', url: '/docs/' });
    expect(ui.statusCode).toBe(200);
    expect(ui.headers['content-type']).toContain('text/html');
    const json = await app.inject({ method: 'GET', url: '/docs/json' });
    expect(json.statusCode).toBe(200);
    expect(json.json()).toEqual(JSON.parse(JSON.stringify(app.swagger())));
  });

  it('documents the API as OpenAPI 3.1 with a bearer scheme, hiding /health and /ws', async () => {
    const spec = (await build()).swagger() as unknown as Spec;
    expect(spec.openapi).toBe('3.1.0');
    expect(spec.components.securitySchemes).toEqual({ bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } });
    expect(Object.keys(spec.paths).length).toBeGreaterThan(50);
    expect(spec.paths['/health']).toBeUndefined();
    expect(spec.paths['/ws']).toBeUndefined();
    expect(Object.keys(spec.paths).every((p) => p.startsWith('/api/v1/'))).toBe(true);
  });

  it('gives every operation a unique operationId from its method and path', async () => {
    const spec = (await build()).swagger() as unknown as Spec;
    const ids: string[] = [];
    for (const [path, ops] of Object.entries(spec.paths)) {
      for (const method of METHODS) {
        const op = ops[method];
        if (!op) continue;
        expect(op.operationId, `${method} ${path}`).toBe(operationIdOf(method.toUpperCase(), path));
        ids.push(op.operationId!);
      }
    }
    expect(ids.length).toBeGreaterThan(50);
    expect(new Set(ids).size).toBe(ids.length);
    expect(spec.paths['/api/v1/auth/login'].post?.operationId).toBe('postAuthLogin');
  });

  it('marks the secured operations, and leaves registering and logging in public', async () => {
    const spec = (await build()).swagger() as unknown as Spec;
    expect(spec.paths['/api/v1/auth/register'].post?.security).toBeUndefined();
    expect(spec.paths['/api/v1/auth/login'].post?.security).toBeUndefined();
    expect(spec.paths['/api/v1/auth/me'].get?.security).toEqual([{ bearerAuth: [] }]);
    expect(spec.paths['/api/v1/player'].get?.security).toEqual([{ bearerAuth: [] }]);
  });
});

describe('the /ws socket without a push gateway', () => {
  it('refuses a connection without a token: CONNECTION_LOST, then close 4001', async () => {
    const ws = await openSocket(await build(), '/ws');
    expect(await ws.next()).toEqual({ cmd: PushCmd.CONNECTION_LOST, data: { reasonCode: 5, msg: { code: 'auth.notLoggedIn' } } });
    expect(await ws.closed).toEqual({ code: 4001, reason: 'unauthorized' });
  });

  it('refuses a bad token the same way', async () => {
    const ws = await openSocket(await build(), '/ws?token=not-a-token');
    expect((await ws.next()).cmd).toBe(PushCmd.CONNECTION_LOST);
    expect((await ws.closed).code).toBe(4001);
  });

  it('refuses even a valid token when the app has no gateway', async () => {
    const token = signToken({ sub: 1 }, CONFIG.jwtSecret, 60);
    const ws = await openSocket(await build(), `/ws?token=${token}`);
    expect((await ws.next()).cmd).toBe(PushCmd.CONNECTION_LOST);
    expect((await ws.closed).code).toBe(4001);
  });
});
