import { describe, expect, it, vi } from 'vitest';

import { PushCmd } from '@marchlands/contracts';
import type { Db } from '@marchlands/db';

import { type GatewayLogger, PushGateway, sendPush, type Socketish } from '#/ws/gateway.ts';

/** A socket that records what it was sent and how it was closed. */
function fakeSocket(readyState = 1) {
  const sent: unknown[] = [];
  const closes: [number | undefined, string | undefined][] = [];
  const socket: Socketish = {
    readyState,
    send: (data) => sent.push(JSON.parse(data)),
    close: (code, reason) => closes.push([code, reason]),
  };
  return { socket, sent, closes };
}

interface Row {
  id: number;
  playerIds: number[];
  cmd: string;
  data: unknown;
}

/**
 * Just the queries the gateway makes: `update(players)…` (last seen) and `select().from(pushMessages)…`, which answers
 * the next of `batches` (a promise, to hold a delivery back).
 */
function fakeDb(batches: (Row[] | Promise<Row[]>)[] = []) {
  const calls = { updates: 0, selects: 0 };
  const db = {
    update: () => ({ set: () => ({ where: () => (calls.updates++, Promise.resolve()) }) }),
    select: () => ({ from: () => ({ where: () => ({ orderBy: () => (calls.selects++, Promise.resolve(batches.shift() ?? [])) }) }) }),
  };
  return { db: db as unknown as Db, calls };
}

const silent = (): GatewayLogger & { errors: unknown[] } => {
  const errors: unknown[] = [];
  return { info: () => {}, warn: () => {}, error: (o) => errors.push(o), errors };
};

const row = (id: number, playerIds: number[]): Row => ({ id, playerIds, cmd: PushCmd.ITEM_UPDATE, data: { items: [{ id: `item${id}`, count: id }] } });
const frame = (r: Row) => ({ cmd: r.cmd, data: r.data });

/** deliver as if these ids had been notified (the LISTEN path is in gateway.db.test.ts) */
const notify = (gateway: PushGateway, ...ids: number[]) => ids.forEach((id) => gateway['enqueue'](id));
const idle = (gateway: PushGateway) => vi.waitUntil(() => !gateway['draining']);

describe(sendPush.name, () => {
  it('sends one { cmd, data } JSON frame', () => {
    const { socket, sent } = fakeSocket();
    sendPush(socket, { cmd: PushCmd.PONG, data: { serverTime: 123 } });
    expect(sent).toEqual([{ cmd: PushCmd.PONG, data: { serverTime: 123 } }]);
  });
});

describe(PushGateway.name, () => {
  it('counts the players online, not their sockets', () => {
    const { db } = fakeDb();
    const gateway = new PushGateway('unused', db, silent());
    const a1 = fakeSocket().socket;
    const a2 = fakeSocket().socket;
    expect(gateway.online()).toBe(0);
    gateway.add(1, a1);
    gateway.add(1, a2);
    gateway.add(2, fakeSocket().socket);
    expect(gateway.online()).toBe(2);
    expect(gateway.isOnline(1)).toBe(true);
    gateway.remove(1, a1);
    expect(gateway.isOnline(1)).toBe(true);
    gateway.remove(1, a2);
    expect(gateway.isOnline(1)).toBe(false);
    expect(gateway.online()).toBe(1);
  });

  it('ignores removing a socket it does not hold', () => {
    const { db, calls } = fakeDb();
    const gateway = new PushGateway('unused', db, silent());
    gateway.remove(9, fakeSocket().socket);
    expect(gateway.online()).toBe(0);
    expect(calls.updates).toBe(0);
  });

  it('records the last-seen time when a socket comes and goes', () => {
    const { db, calls } = fakeDb();
    const gateway = new PushGateway('unused', db, silent());
    const { socket } = fakeSocket();
    gateway.add(1, socket);
    gateway.remove(1, socket);
    expect(calls.updates).toBe(2);
  });

  it('survives a failing last-seen update', async () => {
    const db = { update: () => ({ set: () => ({ where: () => Promise.reject(new Error('db down')) }) }) } as unknown as Db;
    const gateway = new PushGateway('unused', db, silent());
    gateway.add(1, fakeSocket().socket);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(gateway.isOnline(1)).toBe(true);
  });

  it("drops a player's sockets with 4001, and nobody else's", () => {
    const { db } = fakeDb();
    const gateway = new PushGateway('unused', db, silent());
    const [a1, a2, b] = [fakeSocket(), fakeSocket(), fakeSocket()];
    gateway.add(1, a1.socket);
    gateway.add(1, a2.socket);
    gateway.add(2, b.socket);
    gateway.drop(1);
    gateway.drop(3);
    expect(a1.closes).toEqual([[4001, 'unauthorized']]);
    expect(a2.closes).toEqual([[4001, 'unauthorized']]);
    expect(b.closes).toEqual([]);
    // gone at once, and the socket's own close coming later changes nothing
    expect(gateway.isOnline(1)).toBe(false);
    gateway.remove(1, a1.socket);
    expect(gateway.online()).toBe(1);
  });

  it('closes every socket with 1001 when it stops', async () => {
    const { db } = fakeDb();
    const gateway = new PushGateway('unused', db, silent());
    const a = fakeSocket();
    const b = fakeSocket();
    gateway.add(1, a.socket);
    gateway.add(2, b.socket);
    await gateway.stop();
    expect(a.closes).toEqual([[1001, 'server shutting down']]);
    expect(b.closes).toEqual([[1001, 'server shutting down']]);
  });

  describe('delivery', () => {
    it('sends a push to each socket of its recipients that is open', async () => {
      const r = row(10, [1, 3]);
      const { db } = fakeDb([[r]]);
      const gateway = new PushGateway('unused', db, silent());
      const [p1a, p1b, p1closing, p2, p3] = [fakeSocket(), fakeSocket(), fakeSocket(2), fakeSocket(), fakeSocket()];
      gateway.add(1, p1a.socket);
      gateway.add(1, p1b.socket);
      gateway.add(1, p1closing.socket);
      gateway.add(2, p2.socket);
      gateway.add(3, p3.socket);
      notify(gateway, 10);
      await idle(gateway);
      expect(p1a.sent).toEqual([frame(r)]);
      expect(p1b.sent).toEqual([frame(r)]);
      expect(p3.sent).toEqual([frame(r)]);
      expect(p1closing.sent).toEqual([]);
      expect(p2.sent).toEqual([]);
    });

    it('broadcasts a push without recipients to everyone online', async () => {
      const r = row(11, []);
      const { db } = fakeDb([[r]]);
      const gateway = new PushGateway('unused', db, silent());
      const [a, b] = [fakeSocket(), fakeSocket()];
      gateway.add(1, a.socket);
      gateway.add(2, b.socket);
      notify(gateway, 11);
      await idle(gateway);
      expect(a.sent).toEqual([frame(r)]);
      expect(b.sent).toEqual([frame(r)]);
    });

    it('delivers the rows of a batch in the order loaded', async () => {
      const rows = [row(20, [1]), row(21, []), row(22, [1])];
      const { db } = fakeDb([rows]);
      const gateway = new PushGateway('unused', db, silent());
      const s = fakeSocket();
      gateway.add(1, s.socket);
      notify(gateway, 22, 20, 21);
      await idle(gateway);
      expect(s.sent).toEqual(rows.map(frame));
    });

    it('never lets a later push overtake one still loading', async () => {
      let release!: (rows: Row[]) => void;
      const first = new Promise<Row[]>((resolve) => (release = resolve));
      const [r1, r2, r3] = [row(30, [1]), row(31, [1]), row(32, [1])];
      const { db, calls } = fakeDb([first, [r2, r3]]);
      const gateway = new PushGateway('unused', db, silent());
      const s = fakeSocket();
      gateway.add(1, s.socket);
      notify(gateway, 30);
      notify(gateway, 31, 32); // arrive while 30 is loading: queued for the next batch
      await vi.waitUntil(() => calls.selects === 1);
      expect(s.sent).toEqual([]);
      release([r1]);
      await idle(gateway);
      expect(s.sent).toEqual([frame(r1), frame(r2), frame(r3)]);
      expect(calls.selects).toBe(2);
    });

    it('drops pushes while nobody is connected, without loading them', async () => {
      const r = row(41, []);
      const { db, calls } = fakeDb([[r]]);
      const gateway = new PushGateway('unused', db, silent());
      notify(gateway, 40);
      await idle(gateway);
      expect(calls.selects).toBe(0);
      // a later push is still delivered
      const s = fakeSocket();
      gateway.add(1, s.socket);
      notify(gateway, 41);
      await idle(gateway);
      expect(calls.selects).toBe(1);
      expect(s.sent).toEqual([frame(r)]);
    });

    it('logs a failed load and carries on with the next pushes', async () => {
      const r = row(51, [1]);
      const { db } = fakeDb([Promise.reject(new Error('db down')), [r]]);
      const log = silent();
      const gateway = new PushGateway('unused', db, log);
      const s = fakeSocket();
      gateway.add(1, s.socket);
      notify(gateway, 50);
      await idle(gateway);
      expect(log.errors).toEqual([{ err: expect.objectContaining({ message: 'db down' }) }]);
      notify(gateway, 51);
      await idle(gateway);
      expect(s.sent).toEqual([frame(r)]);
    });
  });
});
