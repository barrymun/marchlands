import { defineConfig } from 'vitest/config';

// Service tests against a real Postgres (npm run test:db): backend/**/test/**/*.db.test.ts. global-setup.ts
// prepares the test database (TEST_DB_NAME, default marchlands_test) next to the dev one in DATABASE_URL; each
// test runs in a transaction that is rolled back (test/support/game.ts). Files run one at a time: they share
// the world map.
export default defineConfig({
  test: {
    include: ['backend/**/test/**/*.db.test.ts'],
    environment: 'node',
    globalSetup: ['backend/packages/game/test/support/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 300_000,
  },
});
