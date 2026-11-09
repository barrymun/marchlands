// The API, for a test's set-up: requests go through the web container, as the client's do.
import { WEB } from './stack.ts';

/** One API call, the `{ ok: 1, data }` envelope unwrapped; anything else throws with the answer. */
export async function api<T>(method: string, path: string, body?: unknown, token?: string): Promise<T> {
  const res = await fetch(`${WEB}/api/v1${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as { ok?: number; data?: T } | null;
  if (json?.ok !== 1) throw new Error(`${method} ${path} answered ${res.status} ${JSON.stringify(json)}`);
  return json.data as T;
}

/** Ask again every 200 ms until `check` gives something, or fail after `timeoutMs`. */
export async function until<T>(what: string, check: () => Promise<T | undefined>, timeoutMs = 60_000): Promise<T> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const found = await check();
    if (found !== undefined) return found;
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 200));
  }
}
