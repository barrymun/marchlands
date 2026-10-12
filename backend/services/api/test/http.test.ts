import { describe, expect, it } from 'vitest';
import Fastify, { type FastifyRequest } from 'fastify';
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { GameError, msg } from '@marchlands/core';
import { ErrorResponse } from '@marchlands/contracts';
import type { Db } from '@marchlands/db';
import { signToken } from '#/auth/jwt.ts';
import type { ApiConfig } from '#/config.ts';
import { authenticate, bearer, doc, installErrorHandler, secured, tags } from '#/http.ts';

const CONFIG: ApiConfig = {
  port: 0,
  host: '127.0.0.1',
  databaseUrl: 'unused',
  jwtSecret: 'fake-http-test-secret',
  jwtTtl: 3600,
  logLevel: 'silent',
  corsOrigin: true,
  adminUsernames: [],
};

/** A bare app with the API's error handling and a few routes that fail in each way. */
async function makeApp() {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  // authenticate reads the account's status: every account here is active (the ban is tested in the API tests)
  const db = { select: () => ({ from: () => ({ where: async () => [{ status: 0, banReason: '' }] }) }) } as unknown as Db;
  app.decorate('deps', { db, config: CONFIG, online: () => 0 });
  installErrorHandler(app);
  app.get('/game-error', async () => {
    throw new GameError(msg('hero.locked', { name: 'Arthur' }), -17, 409);
  });
  app.get('/game-error-default', async () => {
    throw new GameError(msg('common.adminsOnly'));
  });
  app.post('/validated', { schema: { body: z.object({ name: z.string().min(3), n: z.number().int() }) } }, async (req) => ({ ok: 1, data: req.body }));
  app.get('/teapot', async () => {
    throw Object.assign(new Error('short and stout'), { statusCode: 418 });
  });
  app.get('/crash', async () => {
    throw new Error('secret internals');
  });
  app.get('/bad-gateway', async () => {
    throw Object.assign(new Error('upstream'), { statusCode: 502 });
  });
  app.get('/whoami', { preHandler: authenticate }, async (req) => ({ ok: 1, data: req.claims }));
  app.get('/doc', doc(tags.player, 'A documented route', z.object({ a: z.number() })), async () => ({ ok: 1 as const, data: { a: 1, hidden: 'x' } }));
  app.get('/doc-wrong', doc(tags.player, 'Answers the wrong shape', z.object({ a: z.number() })), async () => ({ ok: 1 as const, data: { a: 'x' } }) as never);
  await app.ready();
  return app;
}

const json = async (
  app: Awaited<ReturnType<typeof makeApp>>,
  method: 'GET' | 'POST',
  url: string,
  opts: { payload?: object; headers?: Record<string, string> } = {},
) => {
  const res = await app.inject({ method, url, ...opts });
  return { status: res.statusCode, body: res.json() };
};

describe(installErrorHandler.name, () => {
  it('answers a GameError with its status, code and message', async () => {
    const app = await makeApp();
    expect(await json(app, 'GET', '/game-error')).toEqual({ status: 409, body: { ok: -17, error: { code: 'hero.locked', params: { name: 'Arthur' } } } });
    expect(await json(app, 'GET', '/game-error-default')).toEqual({ status: 400, body: { ok: -1, error: { code: 'common.adminsOnly' } } });
  });

  it('answers a validation failure with 400 common.invalidRequest and the issues', async () => {
    const app = await makeApp();
    const a = await json(app, 'POST', '/validated', { payload: { name: 'ab', n: 1.5 } });
    expect(a.status).toBe(400);
    expect(a.body).toMatchObject({ ok: -87, error: { code: 'common.invalidRequest' } });
    expect(a.body.issues).toEqual(
      expect.arrayContaining([
        { path: '/name', message: expect.any(String) },
        { path: '/n', message: expect.any(String) },
      ]),
    );
    expect(ErrorResponse.safeParse(a.body).success).toBe(true);
  });

  it('answers another 4xx with common.requestFailed and the status', async () => {
    const app = await makeApp();
    expect(await json(app, 'GET', '/teapot')).toEqual({ status: 418, body: { ok: -99, error: { code: 'common.requestFailed', params: { status: 418 } } } });
  });

  it('answers a 5xx with common.serverError, without the error text', async () => {
    const app = await makeApp();
    for (const [url, status] of [
      ['/crash', 500],
      ['/bad-gateway', 502],
    ] as const) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode).toBe(status);
      expect(res.json()).toEqual({ ok: -99, error: { code: 'common.serverError' } });
      expect(res.body).not.toContain('secret internals');
    }
  });

  it('answers an unknown route with 404 common.routeNotFound', async () => {
    const app = await makeApp();
    expect(await json(app, 'POST', '/nowhere?x=1')).toEqual({
      status: 404,
      body: { ok: -99, error: { code: 'common.routeNotFound', params: { method: 'POST', url: '/nowhere?x=1' } } },
    });
  });
});

describe(bearer.name, () => {
  const req = (headers: Record<string, string>, query?: Record<string, string>) => ({ headers, query }) as unknown as FastifyRequest;

  it('reads the Authorization: Bearer header', () => {
    expect(bearer(req({ authorization: 'Bearer abc.def.ghi' }))).toBe('abc.def.ghi');
  });
  it('falls back to ?token=, the header winning over it', () => {
    expect(bearer(req({}, { token: 'from-query' }))).toBe('from-query');
    expect(bearer(req({ authorization: 'Bearer from-header' }, { token: 'from-query' }))).toBe('from-header');
  });
  it('ignores other authorization schemes', () => {
    expect(bearer(req({ authorization: 'Basic dXNlcjpwdw==' }))).toBeNull();
    expect(bearer(req({ authorization: 'Basic dXNlcjpwdw==' }, { token: 'from-query' }))).toBe('from-query');
  });
  it('is null without a token', () => {
    expect(bearer(req({}))).toBeNull();
    expect(bearer(req({}, {}))).toBeNull();
  });
});

describe(authenticate.name, () => {
  it('sets the claims of a valid token, from the header or ?token=', async () => {
    const app = await makeApp();
    const token = signToken({ sub: 5, pid: 9 }, CONFIG.jwtSecret, 60);
    const viaHeader = await json(app, 'GET', '/whoami', { headers: { authorization: `Bearer ${token}` } });
    expect(viaHeader).toMatchObject({ status: 200, body: { ok: 1, data: { sub: 5, pid: 9 } } });
    const viaQuery = await json(app, 'GET', `/whoami?token=${token}`);
    expect(viaQuery).toMatchObject({ status: 200, body: { ok: 1, data: { sub: 5, pid: 9 } } });
  });

  it('answers 401 auth.notLoggedIn without a token, or with a bad one', async () => {
    const app = await makeApp();
    const refused = { status: 401, body: { ok: -2, error: { code: 'auth.notLoggedIn' } } };
    expect(await json(app, 'GET', '/whoami')).toEqual(refused);
    expect(await json(app, 'GET', '/whoami', { headers: { authorization: 'Bearer ' } })).toEqual(refused);
    expect(await json(app, 'GET', '/whoami', { headers: { authorization: 'Bearer not-a-token' } })).toEqual(refused);
    const otherSecret = signToken({ sub: 5 }, 'another-fake-secret', 60);
    expect(await json(app, 'GET', '/whoami', { headers: { authorization: `Bearer ${otherSecret}` } })).toEqual(refused);
    const expired = signToken({ sub: 5 }, CONFIG.jwtSecret, -1);
    expect(await json(app, 'GET', '/whoami', { headers: { authorization: `Bearer ${expired}` } })).toEqual(refused);
  });
});

describe(doc.name, () => {
  it('builds secured route options with the envelope as the responses', () => {
    const data = z.object({ a: z.number() });
    const { schema } = doc(tags.city, 'Summary', data, { params: z.object({ cityId: z.number() }) });
    expect(schema).toMatchObject({ tags: ['city'], security: secured, summary: 'Summary', params: expect.anything() });
    expect(schema.security).toEqual([{ bearerAuth: [] }]);
    expect(Object.keys(schema.response)).toEqual(['200', '4xx', '5xx']);
    expect(schema.response[200].parse({ ok: 1, data: { a: 1 } })).toEqual({ ok: 1, data: { a: 1 } });
    expect(schema.response[200].safeParse({ ok: 0, data: { a: 1 } }).success).toBe(false);
    expect(schema.response['4xx']).toBe(ErrorResponse);
  });

  it('strips unknown keys from the answer', async () => {
    const app = await makeApp();
    expect(await json(app, 'GET', '/doc')).toEqual({ status: 200, body: { ok: 1, data: { a: 1 } } });
  });

  it('answers a server error when the handler returns the wrong shape', async () => {
    const app = await makeApp();
    expect(await json(app, 'GET', '/doc-wrong')).toEqual({ status: 500, body: { ok: -99, error: { code: 'common.serverError' } } });
  });
});
