// Assertions for game errors: a service refuses with a GameError carrying a message (code + params).

import { expect } from 'vitest';
import { GameError, type Message, type MsgCode } from '@marchlands/core';

/** Expect `promise` to be refused with exactly this message (`msg('mail.toSelf')`), or just this code. */
export async function expectRefused(promise: Promise<unknown>, expected: Message | MsgCode): Promise<GameError> {
  const err = await promise.then(
    () => expect.unreachable('expected the service to refuse'),
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(GameError);
  const game = err as GameError;
  if (typeof expected === 'string') expect(game.msg.code).toBe(expected);
  else expect(game.msg).toEqual(expected);
  return game;
}
