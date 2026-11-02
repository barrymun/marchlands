// How a failed request is told apart: refused by the server, or lost on the way.

import { ApiError } from '@marchlands/api-client';

/**
 * Whether the server turned the request down (a 4xx: parameters it won't take, something that's gone), as opposed to
 * a dropped connection or a fault of its own, which trying again may mend. Not signing in again (401) or slowing down
 * (429), which have their own handling.
 */
export function isRefusal(err: unknown): boolean {
  return err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 401 && err.status !== 429;
}

/** The retry for a query whose refusal the screen handles: a dropped connection is tried again (three times, as by default), a refusal never. */
export const retryUnlessRefused = (failures: number, err: unknown) => failures < 3 && !isRefusal(err);
