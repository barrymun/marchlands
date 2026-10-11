// A WebSocket client for the API app without a network (Fastify's injectWS): collects the frames the server pushes
// and how it closed the socket.

import type { FastifyInstance } from 'fastify';

export interface Frame {
  cmd: string;
  data: Record<string, unknown>;
}

/** The client side of `ws` (no @types/ws here): what the tests use. */
interface ClientSocket {
  on(event: 'message', fn: (raw: Buffer) => void): void;
  on(event: 'close', fn: (code: number, reason: Buffer) => void): void;
  send(data: string): void;
  close(): void;
  terminate(): void;
}

export interface TestSocket {
  /** the next frame not read yet (waits for it) */
  next(): Promise<Frame>;
  /** every frame received so far */
  frames: Frame[];
  /** resolves when the socket closed, with the code and reason */
  closed: Promise<{ code: number; reason: string }>;
  send(data: unknown): void;
  close(): Promise<{ code: number; reason: string }>;
  /** drop the connection without a closing handshake */
  terminate(): void;
}

export async function openSocket(app: FastifyInstance, url: string, timeoutMs = 2000): Promise<TestSocket> {
  await app.ready(); // injectWS does not boot the app the way inject does
  const frames: Frame[] = [];
  let read = 0;
  const waiting: (() => void)[] = [];
  let onClose!: (c: { code: number; reason: string }) => void;
  const closed = new Promise<{ code: number; reason: string }>((resolve) => (onClose = resolve));
  const ws = (await app.injectWS(url, {}, {
    onInit: (raw: unknown) => {
      const s = raw as ClientSocket;
      s.on('message', (data) => {
        frames.push(JSON.parse(data.toString()) as Frame);
        waiting.splice(0).forEach((w) => w());
      });
      s.on('close', (code, reason) => onClose({ code, reason: reason.toString() }));
    },
  } as never)) as unknown as ClientSocket;

  return {
    frames,
    closed,
    async next() {
      const deadline = Date.now() + timeoutMs;
      while (read >= frames.length) {
        if (Date.now() > deadline) throw new Error(`no frame within ${timeoutMs} ms (got ${JSON.stringify(frames)})`);
        await new Promise<void>((resolve) => {
          waiting.push(resolve);
          setTimeout(resolve, 50);
        });
      }
      return frames[read++];
    },
    send: (data) => ws.send(typeof data === 'string' ? data : JSON.stringify(data)),
    close() {
      ws.close();
      return closed;
    },
    terminate: () => ws.terminate(),
  };
}
