// One API client, one push socket, and the stored access token.

import { ApiError, PushClient, configureApi } from '@marchlands/api-client';

const TOKEN_KEY = 'marchlands.token';

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

let token = readToken();
const listeners = new Set<() => void>();

export const tokenStore = {
  get: () => token,
  set(next: string | null) {
    token = next;
    try {
      if (next) localStorage.setItem(TOKEN_KEY, next);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable: keep the token in memory */
    }
    for (const fn of listeners) fn();
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

// the generated SDK functions and TanStack Query options all use this one configured client
configureApi({
  baseUrl: import.meta.env.VITE_API_URL ?? '',
  getToken: tokenStore.get,
  onUnauthorized: () => tokenStore.set(null),
});

export const push = new PushClient({
  url: `${import.meta.env.VITE_API_URL ?? ''}/ws`,
  getToken: tokenStore.get,
});

export { ApiError };

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}
