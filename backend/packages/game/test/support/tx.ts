// Code that commits (runGame, the jobs) is tested on the open test transaction as its database: its own
// transactions become savepoints, and the whole test is rolled back at the end (as the API tests do, see
// backend/services/api/test/support/api.ts).

import type { Db } from '@marchlands/db';
import { testDb } from '@marchlands/db/test/support/db.ts';

import { runGame } from '#/index.ts';
import type { TestGame } from '#test/support/game.ts';

// thrown to roll the test's transaction back, then caught here
const ROLLBACK = new Error('rollback');

/** Run `fn` with the test transaction as its database; everything is rolled back afterwards. */
export async function inTestTx<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  let result: T | undefined;
  try {
    await testDb().transaction(async (tx) => {
      result = await fn(tx);
      throw ROLLBACK;
    });
  } catch (err) {
    if (err !== ROLLBACK) throw err;
  }
  return result as T;
}

/**
 * Make test data on `db` with the factories, in a game transaction of its own (a savepoint of the test
 * transaction) at time `now`. The factories only use the context, so the plain context stands in for a TestGame.
 */
export const arrange = <T>(db: Db, fn: (g: TestGame) => Promise<T>, now = Date.now()): Promise<T> =>
  runGame(db, (ctx) => fn(ctx as TestGame), { now, retries: 0 });
