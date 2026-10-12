// Checks shared by the route tests: who may call a route. Each route is given with a valid body, because Fastify
// validates the request before the auth hooks (preHandler) run, so a bad body would answer 400 first.

import { expect } from 'vitest';
import type { TestApi } from '#test/support/api.ts';

export interface RouteCall {
  method: string;
  url: string;
  body?: unknown;
}

/** Each route answers 401 auth.notLoggedIn without a token, and with a token that does not verify. */
export async function expectNeedsToken(api: TestApi, routes: RouteCall[]) {
  for (const r of routes) {
    await api.refused(r.method, r.url, 'auth.notLoggedIn', { body: r.body, status: 401 });
    await api.refused(r.method, r.url, 'auth.notLoggedIn', { body: r.body, token: 'not-a-token', status: 401 });
  }
}

/** Each route answers 404 auth.needPlayer for an account that has not created its player yet. */
export async function expectNeedsPlayer(api: TestApi, token: string, routes: RouteCall[]) {
  for (const r of routes) await api.refused(r.method, r.url, 'auth.needPlayer', { body: r.body, token, status: 404 });
}

/** Each route answers 403 common.adminsOnly for an ordinary account. */
export async function expectAdminsOnly(api: TestApi, token: string, routes: RouteCall[]) {
  for (const r of routes) await api.refused(r.method, r.url, 'common.adminsOnly', { body: r.body, token, status: 403 });
}

/** Each request answers 400 common.invalidRequest with the validation issues. */
export async function expectInvalid(api: TestApi, token: string, routes: RouteCall[]) {
  for (const r of routes) {
    const a = await api.refused(r.method, r.url, 'common.invalidRequest', { body: r.body, token, status: 400 });
    expect(a.body.issues, `${r.method} ${r.url}`).toEqual(expect.arrayContaining([expect.objectContaining({ path: expect.any(String) })]));
  }
}

/** An ordinary account without a player (the operator, the first account of a test, is registered first). */
export async function accountWithoutPlayer(api: TestApi) {
  await api.operator();
  return api.register();
}
