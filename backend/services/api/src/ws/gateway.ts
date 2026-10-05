// WebSocket push gateway. Game transactions write to `push_messages` and NOTIFY the id on
// commit; this gateway LISTENs, loads the row and fans it out to the recipients' sockets.
// Any number of API replicas can run: each delivers to the sockets it holds.

import pg from 'pg';
import { eq } from 'drizzle-orm';
import type { PushMessage } from '@evony/contracts';
import { players, pushMessages, type Db } from '@evony/db';
import { PUSH_CHANNEL } from '@evony/game';

export interface Socketish {
  send(data: string): void;
  readyState: number;
  close(code?: number, reason?: string): void;
}

/** Send one typed `{ cmd, data }` frame. */
export function sendPush(socket: Pick<Socketish, 'send'>, msg: PushMessage) {
  socket.send(JSON.stringify(msg));
}

export interface GatewayLogger {
  info(msg: string): void;
  warn(obj: object, msg: string): void;
  error(obj: object, msg: string): void;
}
const consoleLogger: GatewayLogger = {
  info: (m) => console.log(m),
  warn: (o, m) => console.warn(m, o),
  error: (o, m) => console.error(m, o),
};

export class PushGateway {
  private sockets = new Map<number, Set<Socketish>>();
  private client: pg.Client | null = null;
  private stopped = false;
  private readonly url: string;
  private readonly db: Db;
  private log: GatewayLogger;

  constructor(url: string, db: Db, log: GatewayLogger = consoleLogger) {
    this.url = url;
    this.db = db;
    this.log = log;
  }

  setLogger(log: GatewayLogger) {
    this.log = log;
  }

  async start() {
    this.stopped = false;
    await this.connect();
  }

  private async connect() {
    const client = new pg.Client({ connectionString: this.url });
    client.on('error', (err) => {
      this.log.warn({ err }, 'push listener error, reconnecting');
      void this.reconnect();
    });
    client.on('notification', (n) => {
      if (n.channel === PUSH_CHANNEL && n.payload) void this.deliver(Number(n.payload));
    });
    await client.connect();
    await client.query(`LISTEN ${PUSH_CHANNEL}`);
    this.client = client;
    this.log.info('push gateway listening');
  }

  private async reconnect() {
    if (this.stopped) return;
    try {
      await this.client?.end().catch(() => {});
    } finally {
      this.client = null;
    }
    setTimeout(() => {
      if (!this.stopped) this.connect().catch((err) => this.log.error({ err }, 'push gateway reconnect failed'));
    }, 2000);
  }

  async stop() {
    this.stopped = true;
    await this.client?.end().catch(() => {});
    for (const set of this.sockets.values()) for (const s of set) s.close(1001, 'server shutting down');
  }

  private async deliver(id: number) {
    if (this.sockets.size === 0) return;
    const [row] = await this.db.select().from(pushMessages).where(eq(pushMessages.id, id));
    if (!row) return;
    // rows are only written by ctx.push / ctx.broadcast, which are typed against PushSchemas
    const frame = JSON.stringify({ cmd: row.cmd, data: row.data } as PushMessage);
    const targets = row.playerIds.length ? row.playerIds : [...this.sockets.keys()];
    for (const pid of targets) for (const s of this.sockets.get(pid) ?? []) if (s.readyState === 1) s.send(frame);
  }

  add(playerId: number, socket: Socketish) {
    let set = this.sockets.get(playerId);
    if (!set) this.sockets.set(playerId, (set = new Set()));
    set.add(socket);
    void this.db.update(players).set({ lastSeenAt: Date.now() }).where(eq(players.id, playerId)).catch(() => {});
  }

  remove(playerId: number, socket: Socketish) {
    const set = this.sockets.get(playerId);
    if (!set) return;
    set.delete(socket);
    if (!set.size) this.sockets.delete(playerId);
    void this.db.update(players).set({ lastSeenAt: Date.now() }).where(eq(players.id, playerId)).catch(() => {});
  }

  /** Lords with at least one open socket on this replica. */
  online() {
    return this.sockets.size;
  }

  isOnline(playerId: number) {
    return this.sockets.has(playerId);
  }
}
