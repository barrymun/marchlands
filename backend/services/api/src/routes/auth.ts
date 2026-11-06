import { eq, sql } from 'drizzle-orm';
import type { z } from 'zod';

import { AuthAccount, AuthSession, ErrorResponse, LoginBody, Ok, RegisterBody, SignUpChallenge } from '@marchlands/contracts';
import { dur, GameError, msg } from '@marchlands/core';
import { accounts, one, players } from '@marchlands/db';

import { signToken } from '#/auth/jwt.ts';
import { LoginBackoff } from '#/auth/login-backoff.ts';
import { hashPassword, verifyPassword } from '#/auth/password.ts';
import { ProofCheck, SignUpProofs } from '#/auth/signup-proof.ts';
import { authenticate, claimsOf, secured, tags, type ZApp } from '#/http.ts';

/** Public routes cannot use doc(): same envelope, no `security`. */
const responses = <T extends z.ZodType>(data: T) => ({ 200: Ok(data), '4xx': ErrorResponse, '5xx': ErrorResponse });

export default async function authRoutes(app: ZApp) {
  const { db, config } = app.deps;
  const backoff = new LoginBackoff(config.loginBackoff);
  const proofs = new SignUpProofs(config.signUpProof, config.jwtSecret);

  const issue = async (accountId: number, isAdmin: boolean) => {
    const [p] = await db.select({ id: players.id }).from(players).where(eq(players.accountId, accountId));
    return {
      token: signToken({ sub: accountId, pid: p?.id, adm: isAdmin || undefined }, config.jwtSecret, config.jwtTtl),
      accountId,
      playerId: p?.id ?? null,
      hasPlayer: !!p,
      isAdmin,
    };
  };

  app.get(
    '/auth/challenge',
    { schema: { tags: tags.auth, summary: 'A proof-of-work puzzle to solve before signing up', response: responses(SignUpChallenge) } },
    async (_req, reply) => {
      reply.header('cache-control', 'no-store');
      return { ok: 1 as const, data: await proofs.challenge() };
    },
  );

  app.post(
    '/auth/register',
    { schema: { tags: tags.auth, summary: 'Create an account (with a solved GET /auth/challenge)', body: RegisterBody, response: responses(AuthSession) } },
    async (req) => {
      const { username, password, email, proof } = req.body;
      const check = await proofs.check(proof);
      if (check === ProofCheck.EXPIRED) throw new GameError(msg('auth.signUpCheckExpired'), -12, 403);
      if (check !== ProofCheck.OK) throw new GameError(msg('auth.signUpCheckFailed'), -12, 403);
      const [dupe] = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(sql`lower(${accounts.username}) = lower(${username}) or lower(${accounts.email}) = lower(${email})`);
      if (dupe) {
        // the player picks another name and sends the same proof
        proofs.release(proof);
        throw new GameError(msg('auth.alreadyRegistered'), -12, 409);
      }
      // the very first account, and any listed in ADMIN_USERNAMES, are server operators
      const { n } = one(await db.select({ n: sql<number>`count(*)` }).from(accounts));
      const isAdmin = Number(n) === 0 || config.adminUsernames.includes(username.toLowerCase());
      const row = one(
        await db
          .insert(accounts)
          .values({ username, email, passwordHash: await hashPassword(password), isAdmin, createdAt: Date.now(), lastLoginAt: Date.now(), lastLoginIp: req.ip })
          .returning(),
      );
      return { ok: 1 as const, data: await issue(row.id, row.isAdmin) };
    },
  );

  app.post(
    '/auth/login',
    { schema: { tags: tags.auth, summary: 'Log in (orig `login`)', body: LoginBody, response: responses(AuthSession) } },
    async (req, reply) => {
      const { username, password } = req.body;
      // after repeated wrong passwords for this username, no password is checked until the wait is over (the right one included)
      const wait = backoff.waitFor(username);
      if (wait > 0) {
        return reply
          .status(429)
          .header('retry-after', String(Math.ceil(wait / 1000)))
          .send({ ok: -2, error: msg('auth.tooManyTries', { wait: dur(Math.ceil(wait / 1000) * 1000) }) });
      }
      const [acc] = await db
        .select()
        .from(accounts)
        .where(sql`lower(${accounts.username}) = lower(${username})`);
      if (!acc || !(await verifyPassword(password, acc.passwordHash))) {
        backoff.failed(username);
        return reply.status(401).send({ ok: -2, error: msg('auth.wrongPassword') });
      }
      backoff.succeeded(username);
      if (acc.status !== 0) return reply.status(403).send({ ok: -99, error: msg('auth.banned', { reason: acc.banReason }) });
      const isAdmin = acc.isAdmin || config.adminUsernames.includes(acc.username.toLowerCase());
      await db.update(accounts).set({ lastLoginAt: Date.now(), lastLoginIp: req.ip, isAdmin }).where(eq(accounts.id, acc.id));
      await db.update(players).set({ lastLoginAt: Date.now(), lastSeenAt: Date.now() }).where(eq(players.accountId, acc.id));
      return { ok: 1 as const, data: await issue(acc.id, isAdmin) };
    },
  );

  app.get(
    '/auth/me',
    { onRequest: authenticate, schema: { tags: tags.auth, security: secured, summary: 'Current account and its lord', response: responses(AuthAccount) } },
    async (req) => {
      const [acc] = await db
        .select({ id: accounts.id, username: accounts.username, email: accounts.email, isAdmin: accounts.isAdmin, createdAt: accounts.createdAt })
        .from(accounts)
        .where(eq(accounts.id, claimsOf(req).sub));
      if (!acc) throw new GameError(msg('auth.accountNotFound'), -2, 401);
      const [p] = await db.select({ id: players.id, name: players.name }).from(players).where(eq(players.accountId, acc.id));
      return { ok: 1 as const, data: { ...acc, player: p ?? null } };
    },
  );

  app.post(
    '/auth/refresh',
    { onRequest: authenticate, schema: { tags: tags.auth, security: secured, summary: 'Issue a fresh token', response: responses(AuthSession) } },
    async (req) => {
      const [acc] = await db
        .select({ id: accounts.id, isAdmin: accounts.isAdmin, status: accounts.status })
        .from(accounts)
        .where(eq(accounts.id, claimsOf(req).sub));
      if (!acc || acc.status !== 0) throw new GameError(msg('auth.notLoggedIn'), -2, 401);
      return { ok: 1 as const, data: await issue(acc.id, acc.isAdmin) };
    },
  );
}
