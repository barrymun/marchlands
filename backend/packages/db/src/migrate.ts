// Applies pending migrations from ../migrations. Run by the `migrate` compose service.
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

if (import.meta.url === `file://${process.argv[1]}`) {
  const started = Date.now();
  runMigrations()
    .then(() => console.log(`migrations applied in ${Date.now() - started}ms`))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
