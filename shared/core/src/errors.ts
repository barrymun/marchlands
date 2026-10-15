import { type Message, msgLogText } from '#/messages/index.ts';

/**
 * A rule violation reported back to the player. `code` mirrors the original server's `ok` field (negative
 * numbers); `msg` is what the player is told, as a message code + params (messages/index.ts), worded by the
 * client in the player's language. `status` is the HTTP status the API uses. The Error's own `message` is
 * the code and params, for logs.
 */
export class GameError extends Error {
  readonly code: number;
  readonly status: number;
  readonly msg: Message;
  constructor(message: Message, code = -1, status = 400) {
    super(msgLogText(message));
    this.name = 'GameError';
    this.code = code;
    this.status = status;
    this.msg = message;
  }
}

export function assertGame(cond: unknown, message: Message, code = -1, status = 400): asserts cond {
  if (!cond) throw new GameError(message, code, status);
}
