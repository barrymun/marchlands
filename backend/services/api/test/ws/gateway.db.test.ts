// The gateway's LISTEN path against the test database. Pushes are written in the (rolled back) test transaction, which
// is also the gateway's database, so they never commit; the NOTIFY that a commit would send is sent by hand from
// another connection (a NOTIFY writes no rows).

import { desc, sql } from 'drizzle-orm';
import { describe, expect, inject, it, vi } from 'vitest';

import { PushCmd } from '@marchlands/contracts';
import { pushMessages } from '@marchlands/db';
import { testDb } from '@marchlands/db/test/support/db.ts';
import { PUSH_CHANNEL } from '@marchlands/game';

import { type GatewayLogger, PushGateway, type Socketish } from '#/ws/gateway.ts';
import { apiTest, type TestApi } from '#test/support/api.ts';

function fakeSocket() {
  const sent: unknown[] = [];
  const socket: Socketish = { readyState: 1, send: (data) => sent.push(JSON.parse(data)), close: () => {} };
  return { socket, sent };
}

function recordingLog() {
  const lines: string[] = [];
  const log: GatewayLogger = {
    info: (m) => lines.push(`info ${m}`),
    warn: (_o, m) => lines.push(`warn ${m}`),
    error: (_o, m) => lines.push(`error ${m}`),
  };
  return { log, lines };
}

/** Queue a push to these players (none: a broadcast) in the test transaction; returns its push_messages id. */
async function queuePush(api: TestApi, playerIds: number[], items: { id: string; count: number }[]) {
  await api.game(async (ctx) => {
    if (playerIds.length) ctx.push(playerIds, PushCmd.ITEM_UPDATE, { items });
    else ctx.broadcast(PushCmd.ITEM_UPDATE, { items });
  });
  const [row] = await api.db.select({ id: pushMessages.id }).from(pushMessages).orderBy(desc(pushMessages.id)).limit(1);
  return row!.id;
}

/** What a commit would announce, sent outside the test transaction. */
const notify = (id: number | string) => testDb().execute(sql`select pg_notify(${PUSH_CHANNEL}, ${String(id)})`);

/** the gateway's listening connection, seen from the server */
const listeners = async () => {
  const { rows } = await testDb().execute<{ pid: number }>(
    sql`select pid from pg_stat_activity where datname = current_database() and query = ${`LISTEN ${PUSH_CHANNEL}`}`,
  );
  return rows.map((r) => r.pid);
};

/** Run with a started gateway on the test transaction, always stopped before the transaction ends. */
async function withListener(api: TestApi, fn: (gateway: PushGateway, lines: string[]) => Promise<void>) {
  const { log, lines } = recordingLog();
  const gateway = new PushGateway(inject('databaseUrl'), api.db, log);
  await gateway.start();
  try {
    await fn(gateway, lines);
  } finally {
    await gateway.stop();
    await vi.waitUntil(() => !gateway['draining']);
  }
}

describe(PushGateway.name, () => {
  it('listens for notified pushes and delivers them to their recipients', () =>
    apiTest(async (api) =>
      withListener(api, async (gateway, lines) => {
        expect(lines).toContain('info push gateway listening');
        expect(await listeners()).toHaveLength(1);
        const [p1, p2] = [fakeSocket(), fakeSocket()];
        gateway.add(101, p1.socket);
        gateway.add(102, p2.socket);

        const id = await queuePush(api, [101], [{ id: 'a', count: 1 }]);
        await notify(id);
        await vi.waitUntil(() => p1.sent.length > 0, { timeout: 3000 });
        expect(p1.sent).toEqual([{ cmd: PushCmd.ITEM_UPDATE, data: { items: [{ id: 'a', count: 1 }] } }]);

        const all = await queuePush(api, [], [{ id: 'b', count: 2 }]);
        await notify(all);
        await vi.waitUntil(() => p2.sent.length > 0, { timeout: 3000 });
        expect(p1.sent).toHaveLength(2);
        expect(p2.sent).toEqual([{ cmd: PushCmd.ITEM_UPDATE, data: { items: [{ id: 'b', count: 2 }] } }]);
      }),
    ));

  it('ignores notifications on other channels and ids it cannot find', () =>
    apiTest(async (api) =>
      withListener(api, async (gateway) => {
        const s = fakeSocket();
        gateway.add(101, s.socket);
        await testDb().execute(sql`select pg_notify('some_other_channel', '1')`);
        await notify(-1);
        // a push notified afterwards still arrives, and alone
        const id = await queuePush(api, [101], [{ id: 'c', count: 3 }]);
        await notify(id);
        await vi.waitUntil(() => s.sent.length > 0, { timeout: 3000 });
        expect(s.sent).toEqual([{ cmd: PushCmd.ITEM_UPDATE, data: { items: [{ id: 'c', count: 3 }] } }]);
      }),
    ));

  it('listens again after losing its connection', () =>
    apiTest(async (api) =>
      withListener(api, async (gateway, lines) => {
        const s = fakeSocket();
        gateway.add(101, s.socket);
        const [pid] = await listeners();
        await testDb().execute(sql`select pg_terminate_backend(${pid})`);
        await vi.waitUntil(() => lines.includes('warn push listener error, reconnecting'), { timeout: 3000 });
        // it reconnects after 2 s
        await vi.waitUntil(() => lines.filter((l) => l === 'info push gateway listening').length === 2, { timeout: 5000, interval: 100 });
        expect(await listeners()).toHaveLength(1);

        const id = await queuePush(api, [101], [{ id: 'd', count: 4 }]);
        await notify(id);
        await vi.waitUntil(() => s.sent.length > 0, { timeout: 3000 });
        expect(s.sent).toEqual([{ cmd: PushCmd.ITEM_UPDATE, data: { items: [{ id: 'd', count: 4 }] } }]);
      }),
    ));

  it('stops listening and closes its sockets when stopped', () =>
    apiTest(async (api) => {
      const { log } = recordingLog();
      const gateway = new PushGateway(inject('databaseUrl'), api.db, log);
      await gateway.start();
      const closes: unknown[] = [];
      gateway.add(101, { readyState: 1, send: () => {}, close: (code, reason) => closes.push([code, reason]) });
      await gateway.stop();
      expect(closes).toEqual([[1001, 'server shutting down']]);
      await vi.waitUntil(async () => (await listeners()).length === 0, { timeout: 3000, interval: 100 });
    }));
});
