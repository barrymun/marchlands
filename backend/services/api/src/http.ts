// Shared HTTP plumbing: auth, the game transaction runner, error mapping, route helpers.

import type { FastifyBaseLogger, FastifyInstance, FastifyReply, FastifyRequest, RawServerDefault } from 'fastify';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { GameError, msg } from '@marchlands/core';
import { ErrorResponse, Ok } from '@marchlands/contracts';
import { accounts, players, type Db } from '@marchlands/db';
import { runGame, type Ctx } from '@marchlands/game';
import { verifyToken, type TokenClaims } from './auth/jwt.ts';
import type { ApiConfig } from './config.ts';

export interface AppDeps {
  db: Db;
  config: ApiConfig;
  online: () => number;
}

declare module 'fastify' {
  interface FastifyInstance {
    deps: AppDeps;
  }
  interface FastifyRequest {
    claims?: TokenClaims;
  }
}

export type ZApp = FastifyInstance<RawServerDefault, IncomingMessage, ServerResponse, FastifyBaseLogger, ZodTypeProvider>;

/** `{ ok: 1, data }` on success; failures `{ ok: <code>, error: <message> }` (a message code + params, worded by the client) with a 4xx/5xx status. */
export function installErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof GameError) return reply.status(err.status).send({ ok: err.code, error: err.msg });
    if (hasZodFastifySchemaValidationErrors(err)) {
      return reply.status(400).send({
        ok: -87,
        error: msg('common.invalidRequest'),
        issues: err.validation.map((v) => ({ path: v.instancePath, message: v.message })),
      });
    }
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) req.log.error(err);
    return reply.status(status).send({ ok: -99, error: status >= 500 ? msg('common.serverError') : msg('common.requestFailed', { status }) });
  });
  app.setNotFoundHandler((req, reply) => reply.status(404).send({ ok: -99, error: msg('common.routeNotFound', { method: req.method, url: req.url }) }));
}

export function bearer(req: FastifyRequest): string | null {
  const h = req.headers.authorization;
  if (h?.startsWith('Bearer ')) return h.slice(7);
  const q = (req.query as Record<string, string> | undefined)?.token;
  return q ?? null;
}

/**
 * Route hook (onRequest, so it runs before the body is read and validated): a valid token of an account that
 * is not banned. A ban takes effect at once, not when the token expires.
 */
export async function authenticate(req: FastifyRequest, reply: FastifyReply) {
  const token = bearer(req);
  const claims = token ? verifyToken(token, req.server.deps.config.jwtSecret) : null;
  if (!claims) return reply.status(401).send({ ok: -2, error: msg('auth.notLoggedIn') });
  const refusal = await accountRefusal(req.server.deps.db, claims.sub);
  if (refusal) return reply.status(refusal.status).send({ ok: refusal.ok, error: refusal.error });
  req.claims = claims;
}

/** Why an account may not play now (gone, or banned), or null. */
export async function accountRefusal(db: Db, accountId: number) {
  const [acc] = await db.select({ status: accounts.status, banReason: accounts.banReason }).from(accounts).where(eq(accounts.id, accountId));
  if (!acc) return { status: 401, ok: -2, error: msg('auth.accountNotFound') };
  if (acc.status !== 0) return { status: 403, ok: -99, error: msg('auth.banned', { reason: acc.banReason ?? '' }) };
  return null;
}

/** Resolve the lord of the authenticated account (404 until common.createNewPlayer). */
export async function playerIdOf(db: Db, req: FastifyRequest): Promise<number> {
  const accountId = req.claims!.sub;
  const [row] = await db.select({ id: players.id }).from(players).where(eq(players.accountId, accountId));
  if (!row) throw new GameError(msg('auth.needPlayer'), -4, 404);
  return row.id;
}

export async function requireAdmin(req: FastifyRequest) {
  const [row] = await req.server.deps.db.select({ admin: accounts.isAdmin }).from(accounts).where(eq(accounts.id, req.claims!.sub));
  if (!row?.admin) throw new GameError(msg('common.adminsOnly'), -42, 403);
}

/** `void` commands answer `data: null`. */
export type Data<T> = [T] extends [void] ? null : T;

/** Run a game operation for the authenticated lord in one transaction. */
export async function game<T>(req: FastifyRequest, fn: (ctx: Ctx, playerId: number) => Promise<T>): Promise<{ ok: 1; data: Data<T> }> {
  const db = req.server.deps.db;
  const playerId = await playerIdOf(db, req);
  const data = await runGame(db, (ctx) => fn(ctx, playerId));
  return { ok: 1, data: (data ?? null) as Data<T> };
}

/** Run a world-level operation (no lord required). */
export async function anon<T>(req: FastifyRequest, fn: (ctx: Ctx) => Promise<T>): Promise<{ ok: 1; data: Data<T> }> {
  const data = await runGame(req.server.deps.db, fn);
  return { ok: 1, data: (data ?? null) as Data<T> };
}

// ---- common request schemas (defined in @marchlands/contracts) ----

export { zCityParams, zId, zIds, zPaging, zResources, zTroops } from '@marchlands/contracts';

export const tags = {
  auth: ['auth'],
  player: ['player'],
  city: ['city'],
  buildings: ['buildings'],
  research: ['research'],
  troops: ['troops'],
  heroes: ['heroes'],
  armies: ['armies'],
  map: ['map'],
  mail: ['mail'],
  reports: ['reports'],
  chat: ['chat'],
  social: ['friends'],
  alliance: ['alliance'],
  market: ['market'],
  shop: ['shop'],
  quests: ['quests'],
  rankings: ['rankings'],
  admin: ['admin'],
  config: ['config'],
};

export const secured = [{ bearerAuth: [] }];

/**
 * Route options with OpenAPI metadata. `data` is the schema of the `data` field of a successful
 * answer (from @marchlands/contracts); it is wrapped in the `{ ok: 1, data }` envelope, validated on
 * the way out (unknown keys are stripped) and type-checked against the handler's return value.
 */
export function doc<R extends z.ZodType, T extends object = object>(tag: string[], summary: string, data: R, extra?: T) {
  return {
    schema: {
      tags: tag,
      security: secured,
      summary,
      ...((extra ?? {}) as T),
      response: { 200: Ok(data), '4xx': ErrorResponse, '5xx': ErrorResponse },
    },
  };
}
