import { describe, expect, it } from 'vitest';
import type { FastifyRequest } from 'fastify';
import { eq } from 'drizzle-orm';
import { GameError, msg } from '@marchlands/core';
import { PushCmd } from '@marchlands/contracts';
import { accounts, pushMessages, type Db } from '@marchlands/db';
import { signToken } from '#/auth/jwt.ts';
import { anon, game, playerIdOf, requireAdmin } from '#/http.ts';
import { apiTest, TEST_CONFIG } from '#test/support/api.ts';

/** A request as the route helpers see it: the app's database and the token's claims. */
const request = (db: Db, sub: number) => ({ server: { deps: { db, config: TEST_CONFIG } }, claims: { sub, iat: 0, exp: 0 } }) as unknown as FastifyRequest;

const refusal = (code: string, legacy: number, status: number) => expect.objectContaining({ msg: { code }, code: legacy, status });

describe(playerIdOf.name, () => {
  it('finds the player of the account', () =>
    apiTest(async (api) => {
      await api.operator();
      const p = await api.player('Finder');
      expect(await playerIdOf(api.db, request(api.db, p.accountId))).toBe(p.playerId);
    }));

  it('refuses an account without a player with 404 auth.needPlayer', () =>
    apiTest(async (api) => {
      const s = await api.register('nobody');
      await expect(playerIdOf(api.db, request(api.db, s.accountId))).rejects.toEqual(refusal('auth.needPlayer', -4, 404));
    }));
});

describe(game.name, () => {
  it('runs the operation for the player in one transaction and wraps the result', () =>
    apiTest(async (api) => {
      await api.operator();
      const p = await api.player('Runner');
      const seen: number[] = [];
      const answer = await game(request(api.db, p.accountId), async (ctx, playerId) => {
        seen.push(playerId);
        ctx.push(playerId, PushCmd.ITEM_UPDATE, { items: [] });
        return { n: 1 };
      });
      expect(answer).toEqual({ ok: 1, data: { n: 1 } });
      expect(seen).toEqual([p.playerId]);
      // the push was flushed with the transaction
      const rows = await api.db.select().from(pushMessages).where(eq(pushMessages.cmd, PushCmd.ITEM_UPDATE));
      expect(rows.map((r) => r.playerIds)).toContainEqual([p.playerId]);
    }));

  it('answers data: null for an operation with no result', () =>
    apiTest(async (api) => {
      await api.operator();
      const p = await api.player('Voider');
      expect(await game(request(api.db, p.accountId), async () => {})).toEqual({ ok: 1, data: null });
    }));

  it('needs a player', () =>
    apiTest(async (api) => {
      const s = await api.register('nobody');
      let ran = false;
      await expect(game(request(api.db, s.accountId), async () => (ran = true))).rejects.toEqual(refusal('auth.needPlayer', -4, 404));
      expect(ran).toBe(false);
    }));

  it('rolls back the writes of a refused operation', () =>
    apiTest(async (api) => {
      await api.operator();
      const p = await api.player('Undone');
      const refused = game(request(api.db, p.accountId), async (ctx) => {
        await ctx.tx.update(accounts).set({ banReason: 'written then undone' }).where(eq(accounts.id, p.accountId));
        throw new GameError(msg('common.adminsOnly'), -42, 403);
      });
      await expect(refused).rejects.toBeInstanceOf(GameError);
      const [row] = await api.db.select({ banReason: accounts.banReason }).from(accounts).where(eq(accounts.id, p.accountId));
      expect(row.banReason).toBe('');
    }));
});

describe(anon.name, () => {
  it('runs a world-level operation without a player', () =>
    apiTest(async (api) => {
      const s = await api.register('visitor');
      expect(await anon(request(api.db, s.accountId), async () => 'world')).toEqual({ ok: 1, data: 'world' });
      expect(await anon(request(api.db, s.accountId), async () => undefined)).toEqual({ ok: 1, data: null });
    }));
});

describe(requireAdmin.name, () => {
  it('lets an operator through', () =>
    apiTest(async (api) => {
      const op = await api.operator();
      await expect(requireAdmin(request(api.db, op.accountId))).resolves.toBeUndefined();
    }));

  it('refuses other accounts, and unknown ones, with 403 common.adminsOnly', () =>
    apiTest(async (api) => {
      await api.operator();
      const s = await api.register('ordinary');
      await expect(requireAdmin(request(api.db, s.accountId))).rejects.toEqual(refusal('common.adminsOnly', -42, 403));
      await expect(requireAdmin(request(api.db, 999_999))).rejects.toEqual(refusal('common.adminsOnly', -42, 403));
    }));

  it('guards the operator routes by the account, not by what the token claims', () =>
    apiTest(async (api) => {
      const op = await api.operator();
      const p = await api.player('Pretender');
      const body = { playerName: 'Pretender', techId: 1, level: 1 };
      await api.refused('PUT', 'admin/research', 'common.adminsOnly', { token: p.token, body, status: 403 });
      const forged = signToken({ sub: p.accountId, pid: p.playerId, adm: true }, TEST_CONFIG.jwtSecret, 60);
      await api.refused('PUT', 'admin/research', 'common.adminsOnly', { token: forged, body, status: 403 });
      expect(await api.ok('PUT', 'admin/research', { token: op.token, body })).toBeNull();
      // and the guard comes after authentication
      await api.refused('PUT', 'admin/research', 'auth.notLoggedIn', { body, status: 401 });
    }));
});
