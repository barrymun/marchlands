import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { PushCmd } from '@marchlands/contracts';
import { players } from '@marchlands/db';

import { buildApp } from '#/app.ts';
import { signToken } from '#/auth/jwt.ts';
import { PushGateway } from '#/ws/gateway.ts';
import { apiTest, TEST_CONFIG, type TestApi } from '#test/support/api.ts';
import { openSocket } from '#test/support/ws-client.ts';

/** wait for the gateway's fire-and-forget lastSeenAt updates: queries on the test transaction run in order */
const settle = (api: TestApi) => api.db.select({ id: players.id }).from(players).limit(1);

/**
 * The app on the test transaction with a push gateway that is not listening (it only tracks sockets). Tests drop their
 * sockets with terminate: over injectWS the server only sees a closing handshake end at ws's close timeout. The
 * gateway's writes must land before the transaction ends.
 */
async function withGateway<T>(api: TestApi, fn: (app: Awaited<ReturnType<typeof buildApp>>, gateway: PushGateway) => Promise<T>) {
  const gateway = new PushGateway('unused: not started', api.db);
  const app = await buildApp({ db: api.db, config: TEST_CONFIG, gateway, logger: false });
  try {
    const result = await fn(app, gateway);
    await expect.poll(() => gateway.online()).toBe(0);
    return result;
  } finally {
    await settle(api);
    await app.close();
  }
}

describe('GET /health', () => {
  it('checks the database and reports the players online', () =>
    apiTest(async (api) => {
      expect(await api.call('GET', '/health')).toEqual({ status: 200, body: { ok: 1, status: 'up', online: 0 } });
      await api.operator();
      const p = await api.player('Healthy');
      await withGateway(api, async (app, gateway) => {
        const socket = { send: () => {}, readyState: 1, close: () => {} };
        gateway.add(p.playerId, socket);
        const res = await app.inject({ method: 'GET', url: '/health' });
        expect(res.json()).toEqual({ ok: 1, status: 'up', online: 1 });
        gateway.remove(p.playerId, socket);
      });
    }));
});

describe('the /ws socket', () => {
  it('connects a player: CONNECTED with the player id, then PONG to a ping', () =>
    apiTest(async (api) => {
      await api.operator();
      const p = await api.player('Socketeer');
      await withGateway(api, async (app, gateway) => {
        const before = Date.now();
        const ws = await openSocket(app, `/ws?token=${p.token}`);
        const connected = await ws.next();
        expect(connected).toEqual({ cmd: PushCmd.CONNECTED, data: { playerId: p.playerId, serverTime: expect.any(Number) } });
        expect(connected.data.serverTime).toBeGreaterThanOrEqual(before);
        expect(gateway.isOnline(p.playerId)).toBe(true);

        ws.send({ cmd: 'ping' });
        expect(await ws.next()).toEqual({ cmd: PushCmd.PONG, data: { serverTime: expect.any(Number) } });

        ws.terminate();
        await expect.poll(() => gateway.isOnline(p.playerId)).toBe(false);
      });
    }));

  it('closes the socket when the player logs out everywhere, and refuses the old token after', () =>
    apiTest(async (api) => {
      await api.operator();
      const p = await api.player('Leaver');
      await withGateway(api, async (app, gateway) => {
        const ws = await openSocket(app, `/ws?token=${p.token}`);
        expect((await ws.next()).cmd).toBe(PushCmd.CONNECTED);
        const res = await app.inject({ method: 'DELETE', url: '/api/v1/auth/sessions', headers: { authorization: `Bearer ${p.token}` } });
        expect(res.statusCode).toBe(200);
        expect(await ws.closed).toEqual({ code: 4001, reason: 'unauthorized' });
        await expect.poll(() => gateway.isOnline(p.playerId)).toBe(false);

        const again = await openSocket(app, `/ws?token=${p.token}`);
        expect(await again.next()).toEqual({ cmd: PushCmd.CONNECTION_LOST, data: { reasonCode: 5, msg: { code: 'auth.notLoggedIn' } } });
        expect((await again.closed).code).toBe(4001);
      });
    }));

  it('ignores malformed frames and other commands, and keeps the socket open', () =>
    apiTest(async (api) => {
      await api.operator();
      const p = await api.player('Noisy');
      await withGateway(api, async (app) => {
        const ws = await openSocket(app, `/ws?token=${p.token}`);
        expect((await ws.next()).cmd).toBe(PushCmd.CONNECTED);
        ws.send('{not json');
        ws.send({ cmd: 'shout' });
        ws.send({ cmd: 'ping' });
        expect((await ws.next()).cmd).toBe(PushCmd.PONG);
        expect(ws.frames).toHaveLength(2);
        ws.terminate();
      });
    }));

  it('records when the player was last seen', () =>
    apiTest(async (api) => {
      await api.operator();
      const p = await api.player('Seen');
      await api.db.update(players).set({ lastSeenAt: 0 }).where(eq(players.id, p.playerId));
      await withGateway(api, async (app) => {
        const ws = await openSocket(app, `/ws?token=${p.token}`);
        await ws.next();
        await settle(api);
        const [row] = await api.db.select({ lastSeenAt: players.lastSeenAt }).from(players).where(eq(players.id, p.playerId));
        expect(row!.lastSeenAt).toBeGreaterThan(0);
        ws.terminate();
      });
    }));

  it('refuses an account without a player: CONNECTION_LOST auth.needPlayer, then close 4004', () =>
    apiTest(async (api) => {
      const s = await api.register('noplayer');
      await withGateway(api, async (app, gateway) => {
        const ws = await openSocket(app, `/ws?token=${s.token}`);
        expect(await ws.next()).toEqual({ cmd: PushCmd.CONNECTION_LOST, data: { reasonCode: 5, msg: { code: 'auth.needPlayer' } } });
        expect(await ws.closed).toEqual({ code: 4004, reason: 'no player' });
        expect(gateway.online()).toBe(0);
      });
    }));

  it('refuses a missing, bad or foreign token with close 4001', () =>
    apiTest(async (api) => {
      await api.operator();
      const p = await api.player('Locked');
      const foreign = signToken({ sub: p.accountId, pid: p.playerId }, 'another-fake-secret', 60);
      await withGateway(api, async (app, gateway) => {
        for (const url of ['/ws', '/ws?token=', '/ws?token=garbage', `/ws?token=${foreign}`]) {
          const ws = await openSocket(app, url);
          expect(await ws.next(), url).toEqual({ cmd: PushCmd.CONNECTION_LOST, data: { reasonCode: 5, msg: { code: 'auth.notLoggedIn' } } });
          expect((await ws.closed).code, url).toBe(4001);
        }
        expect(gateway.online()).toBe(0);
      });
    }));
});
