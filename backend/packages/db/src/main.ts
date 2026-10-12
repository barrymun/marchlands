// Applies pending migrations, then exits. Run by the `migrate` compose service and `npm run db:migrate`.
import { runMigrations } from '#/migrate.ts';

const started = Date.now();
runMigrations()
  .then(() => console.log(`migrations applied in ${Date.now() - started}ms`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
