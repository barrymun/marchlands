// Shared HTTP plumbing: auth, the game transaction runner, error mapping, route helpers.

import type { FastifyBaseLogger, FastifyInstance, FastifyReply, FastifyRequest, RawServerDefault } from 'fastify';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { GameError } from '@evony/core';
import { accounts, players, type Db } from '@evony/db';
import { runGame, type Ctx } from '@evony/game';
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

/** `{ ok: 1, data }` on success; GameErrors become `{ ok: <code>, errorMsg }` with a 4xx status. */
export function installErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof GameError) return reply.status(err.status).send({ ok: err.code, errorMsg: err.message });
    if (hasZodFastifySchemaValidationErrors(err)) {
      return reply.status(400).send({
        ok: -87,
        errorMsg: 'Invalid data sent.',
        issues: err.validation.map((v) => ({ path: v.instancePath, message: v.message })),
      });
    }
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) req.log.error(err);
    return reply.status(status).send({ ok: -99, errorMsg: status >= 500 ? 'Internal server error.' : (err as Error).message });
  });
  app.setNotFoundHandler((req, reply) => reply.status(404).send({ ok: -99, errorMsg: `Route ${req.method} ${req.url} not found.` }));
}

export function bearer(req: FastifyRequest): string | null {
  const h = req.headers.authorization;
  if (h?.startsWith('Bearer ')) return h.slice(7);
  const q = (req.query as Record<string, string> | undefined)?.token;
  return q ?? null;
}

export async function authenticate(req: FastifyRequest, reply: FastifyReply) {
  const token = bearer(req);
  const claims = token ? verifyToken(token, req.server.deps.config.jwtSecret) : null;
  if (!claims) return reply.status(401).send({ ok: -2, errorMsg: 'Not logged in.' });
  req.claims = claims;
}

/** Resolve the lord of the authenticated account (404 until common.createNewPlayer). */
export async function playerIdOf(db: Db, req: FastifyRequest): Promise<number> {
  const accountId = req.claims!.sub;
  const [row] = await db.select({ id: players.id }).from(players).where(eq(players.accountId, accountId));
  if (!row) throw new GameError('need create player', -4, 404);
  return row.id;
}

export async function requireAdmin(req: FastifyRequest) {
  const [row] = await req.server.deps.db.select({ admin: accounts.isAdmin }).from(accounts).where(eq(accounts.id, req.claims!.sub));
  if (!row?.admin) throw new GameError('Administrators only.', -42, 403);
}

/** Run a game operation for the authenticated lord in one transaction. */
export async function game<T>(req: FastifyRequest, fn: (ctx: Ctx, playerId: number) => Promise<T>): Promise<{ ok: 1; data: T }> {
  const db = req.server.deps.db;
  const playerId = await playerIdOf(db, req);
  const data = await runGame(db, (ctx) => fn(ctx, playerId));
  return { ok: 1, data: data ?? (null as T) };
}

/** Run a world-level operation (no lord required). */
export async function anon<T>(req: FastifyRequest, fn: (ctx: Ctx) => Promise<T>): Promise<{ ok: 1; data: T }> {
  const data = await runGame(req.server.deps.db, fn);
  return { ok: 1, data };
}

// ---- common schemas ----

export const zId = z.coerce.number().int().nonnegative();
export const zCityParams = z.object({ cityId: zId });
export const zPaging = z.object({
  pageNo: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});
export const zIds = z.object({ ids: z.array(z.number().int()).max(500) });
export const zTroops = z.record(z.string(), z.number().int().nonnegative());
export const zResources = z
  .object({ gold: z.number().nonnegative(), food: z.number().nonnegative(), wood: z.number().nonnegative(), stone: z.number().nonnegative(), iron: z.number().nonnegative() })
  .partial();

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

/** Route options with OpenAPI metadata; keeps the zod schema types for request inference. */
export function doc<T extends object = {}>(tag: string[], summary: string, extra?: T) {
  return { schema: { tags: tag, security: secured, summary, ...((extra ?? {}) as T) } };
}
