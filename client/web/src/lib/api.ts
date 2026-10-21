// One API client, one push socket, and the stored access token.

import { ApiError, configureApi, PushClient } from '@marchlands/api-client';
import { i18n } from '@/lib/i18n';
import { translateMessage } from '@/lib/messages';

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
  set: (next: string | null) => {
    token = next;
    try {
      if (next) localStorage.setItem(TOKEN_KEY, next);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable: keep the token in memory */
    }
    for (const fn of listeners) fn();
  },
  subscribe: (fn: () => void) => {
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

/** What went wrong, in the player's language: the server's message, or a generic one when none came back. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.error ? translateMessage(err.error) : i18n.t('common:errors.network');
  return i18n.t('common:errors.unexpected');
}
