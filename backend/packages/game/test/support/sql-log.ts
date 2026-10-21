// Records the SQL a piece of game code sends on the test transaction, to check which rows it locks and
// whether it writes anything (row locks cannot be seen from inside the transaction that holds them).

import { vi } from 'vitest';
import type { TestGame } from '#test/support/game.ts';

interface QueryClient {
  query: (...args: unknown[]) => unknown;
}

/** Run `fn` and return the statements it sent, in order. */
export async function recordSql(g: TestGame, fn: () => Promise<unknown>): Promise<string[]> {
  const client = (g.tx as unknown as { session: { client: QueryClient } }).session.client;
  const spy = vi.spyOn(client, 'query');
  try {
    await fn();
    return spy.mock.calls.map(([q]) => (typeof q === 'string' ? q : (q as { text: string }).text));
  } finally {
    spy.mockRestore();
  }
}

/** The tables of the `select … for update` statements, in order. */
export const lockedTables = (statements: string[]) => statements.filter((s) => /\bfor update\b/i.test(s)).map((s) => /\bfrom "(\w+)"/.exec(s)?.[1]);

/** The statements that change data. */
export const writes = (statements: string[]) => statements.filter((s) => /^\s*(?:insert|update|delete)\b/i.test(s));
