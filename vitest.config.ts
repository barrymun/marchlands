import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // the client's `@/` imports (client/web/vite.config.ts)
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'client/web/src') } },
  test: {
    include: ['shared/*/test/**/*.test.ts', 'backend/**/test/**/*.test.ts', 'client/web/src/**/*.test.ts', 'tools/eslint/*.test.mjs'],
    // service tests against Postgres run with npm run test:db (vitest.db.config.ts)
    exclude: ['**/node_modules/**', '**/*.db.test.ts'],
    environment: 'node',
  },
});
