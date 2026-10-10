import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // the client's `@/` imports (client/web/vite.config.ts)
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'client/web/src') } },
  test: {
    include: ['shared/*/test/**/*.test.ts', 'backend/**/test/**/*.test.ts', 'client/web/src/**/*.test.ts'],
    environment: 'node',
  },
});
