// Applies pending migrations from ../migrations (the `migrate` command is main.ts).
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { connect } from '#/client.ts';

const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../migrations');

/** @internal also run by the test setup */
export async function runMigrations(url?: string): Promise<void> {
  const { db, close } = connect(url, 2);
  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await close();
  }
}
