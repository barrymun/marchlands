import { readFileSync } from 'node:fs';

import { sql } from 'drizzle-orm';
import { describe, expect, inject, it } from 'vitest';

import { runMigrations } from '#/index.ts';
import { testDb } from '#test/support/db.ts';

const journal = JSON.parse(readFileSync(new URL('../migrations/meta/_journal.json', import.meta.url), 'utf8')) as { entries: { tag: string }[] };

const applied = async () => (await testDb().execute<{ n: number }>(sql`select count(*)::int as n from drizzle.__drizzle_migrations`)).rows[0]!.n;

describe(runMigrations.name, () => {
  // the test setup migrated the database already: running again finds nothing to apply and changes nothing
  it('has applied every migration in the journal, and running again applies none', async () => {
    expect(await applied()).toBe(journal.entries.length);
    await runMigrations(inject('databaseUrl'));
    expect(await applied()).toBe(journal.entries.length);
  });

  it('fails when the database cannot be reached', async () => {
    await expect(runMigrations('postgres://tester@127.0.0.1:1/none')).rejects.toThrow();
  });
});
