// WebSocket push client: authenticates with the access token, keeps the socket alive,
// reconnects with backoff and dispatches typed `{ cmd, data }` frames.

import type { PushCmd, PushData, PushMessage } from '@evony/contracts';

export type PushStatus = 'connecting' | 'open' | 'closed';

export interface PushClientOptions {
  /** WebSocket endpoint, e.g. `ws://localhost:3000/ws` or `/ws` (resolved against location) */
  url: string;
  getToken: () => string | null | undefined;
  onStatus?: (status: PushStatus) => void;
  /** close codes after which reconnecting is pointless (4001 unauthorized, 4004 no lord) */
  onRejected?: (code: number, reason: string) => void;
  WebSocket?: typeof globalThis.WebSocket;
}

type Handler<K extends PushCmd> = (data: PushData<K>, msg: Extract<PushMessage, { cmd: K }>) => void;

export class PushClient {
  private socket: WebSocket | null = null;
  private handlers = new Map<string, Set<(data: unknown, msg: PushMessage) => void>>();
  private any = new Set<(msg: PushMessage) => void>();
  private retry = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private ping: ReturnType<typeof setInterval> | null = null;
  private stopped = true;
  private current: PushStatus = 'closed';
  private statusListeners = new Set<(status: PushStatus) => void>();
  private readonly opts: PushClientOptions;

  constructor(opts: PushClientOptions) {
    this.opts = opts;
  }

  /** Subscribe to one push; returns an unsubscribe function. */
  on<K extends PushCmd>(cmd: K, fn: Handler<K>): () => void {
    let set = this.handlers.get(cmd);
    if (!set) this.handlers.set(cmd, (set = new Set()));
    const h = fn as (data: unknown, msg: PushMessage) => void;
    set.add(h);
    return () => set.delete(h);
  }

  get status(): PushStatus {
    return this.current;
  }

  /** Subscribe to connection status changes; returns an unsubscribe function. */
  onStatus(fn: (status: PushStatus) => void): () => void {
    this.statusListeners.add(fn);
    return () => this.statusListeners.delete(fn);
  }

  private setStatus(status: PushStatus) {
    this.current = status;
    this.opts.onStatus?.(status);
    for (const fn of this.statusListeners) fn(status);
  }

  /** Subscribe to every push. */
  onAny(fn: (msg: PushMessage) => void): () => void {
    this.any.add(fn);
    return () => this.any.delete(fn);
  }

  connect() {
    this.stopped = false;
    this.open();
  }

  close() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.ping) clearInterval(this.ping);
    this.timer = this.ping = null;
    this.socket?.close(1000, 'bye');
    this.socket = null;
    this.setStatus('closed');
  }

  private open() {
    const token = this.opts.getToken();
    if (!token || this.stopped) return;
    const WS = this.opts.WebSocket ?? globalThis.WebSocket;
    const base = (globalThis as { location?: { href: string } }).location?.href ?? 'http://localhost/';
    const url = new URL(this.opts.url, base);
    if (url.protocol === 'http:') url.protocol = 'ws:';
    if (url.protocol === 'https:') url.protocol = 'wss:';
    url.searchParams.set('token', token);
    this.setStatus('connecting');
    const ws = new WS(url);
    this.socket = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.setStatus('open');
      this.ping = setInterval(() => ws.readyState === ws.OPEN && ws.send(JSON.stringify({ cmd: 'ping' })), 25_000);
    };
    ws.onmessage = (ev) => {
      let msg: PushMessage;
      try {
        msg = JSON.parse(String(ev.data)) as PushMessage;
      } catch {
        return;
      }
      for (const fn of this.any) fn(msg);
      for (const fn of this.handlers.get(msg.cmd) ?? []) fn(msg.data, msg);
    };
    ws.onclose = (ev) => {
      if (this.ping) clearInterval(this.ping);
      this.ping = null;
      if (this.socket !== ws) return;
      this.socket = null;
      this.setStatus('closed');
      if (ev.code === 4001 || ev.code === 4004) {
        this.opts.onRejected?.(ev.code, ev.reason);
        return;
      }
      if (this.stopped) return;
      const delay = Math.min(30_000, 500 * 2 ** this.retry++);
      this.timer = setTimeout(() => this.open(), delay);
    };
  }
}
