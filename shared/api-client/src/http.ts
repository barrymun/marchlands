// Typed HTTP client. Paths, parameters, bodies and responses come from the generated
// OpenAPI types (src/generated/openapi.ts, `npm run gen:api`).

import createClient, { type Client, type Middleware } from 'openapi-fetch';
import type { paths } from './generated/openapi.ts';

export type ApiPaths = paths;
export type ApiClient = Client<paths>;

export interface ApiClientOptions {
  /** API origin, e.g. `http://localhost:3000`; '' for same-origin (behind a proxy) */
  baseUrl?: string;
  /** current access token, or null when logged out */
  getToken?: () => string | null | undefined;
  /** called on any 401 answer (expired or revoked token) */
  onUnauthorized?: () => void;
  fetch?: typeof globalThis.fetch;
}

export function createApiClient(opts: ApiClientOptions = {}): ApiClient {
  const client = createClient<paths>({ baseUrl: opts.baseUrl ?? '', fetch: opts.fetch });
  const auth: Middleware = {
    onRequest({ request }) {
      const token = opts.getToken?.();
      if (token) request.headers.set('Authorization', `Bearer ${token}`);
      return request;
    },
    onResponse({ response }) {
      if (response.status === 401) opts.onUnauthorized?.();
      return response;
    },
  };
  client.use(auth);
  return client;
}

/** A failed call: `code` is the game's (negative) error code, `status` the HTTP status. */
export class ApiError extends Error {
  readonly code: number;
  readonly status: number;
  readonly issues?: { path: string; message?: string }[];
  constructor(code: number, message: string, status: number, issues?: { path: string; message?: string }[]) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.issues = issues;
  }
}

interface ErrorBody {
  ok: number;
  errorMsg: string;
  issues?: { path: string; message?: string }[];
}

/**
 * Await an openapi-fetch call and return the `data` of the `{ ok: 1, data }` envelope,
 * or throw an ApiError.
 *
 *   const city = await unwrap(api.GET('/api/v1/cities/{cityId}', { params: { path: { cityId } } }));
 */
export async function unwrap<T>(call: Promise<{ data?: { ok: 1; data?: T }; error?: unknown; response: Response }>): Promise<T> {
  const res = await call;
  // openapi-fetch's types drop `data: null` (commands without a result), hence the optional field
  if (res.data) return (res.data.data ?? null) as T;
  const err = res.error as Partial<ErrorBody> | undefined;
  throw new ApiError(err?.ok ?? -99, err?.errorMsg ?? (res.response.statusText || 'Request failed'), res.response.status, err?.issues);
}
