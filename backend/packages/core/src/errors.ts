/**
 * A rule violation reported back to the player. `code` mirrors the original server's `ok`
 * field (negative numbers), `message` its `errorMsg`. `status` is the HTTP status the API uses.
 */
export class GameError extends Error {
  readonly code: number;
  readonly status: number;
  constructor(message: string, code = -1, status = 400) {
    super(message);
    this.name = 'GameError';
    this.code = code;
    this.status = status;
  }
}

export const notFound = (what: string) => new GameError(`${what} not found.`, -1, 404);
export const forbidden = (message = 'Not allowed.') => new GameError(message, -1, 403);

export function assertGame(cond: unknown, message: string, code = -1, status = 400): asserts cond {
  if (!cond) throw new GameError(message, code, status);
}
