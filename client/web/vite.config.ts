import path from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// The dev server proxies the API so the browser talks to one origin (no CORS, same-origin WebSocket).
// Target: API_PROXY, else http://localhost:${API_PORT} from the repo's .env, else :3000.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(import.meta.dirname, '../..'), '');
  const target = env.API_PROXY || `http://localhost:${env.API_PORT || 3000}`;
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
    build: {
      // the vendor file (React, the router, Radix …) is one deliberate file of about 540 kB (165 kB gzipped)
      chunkSizeWarningLimit: 600,
      // game art (src/assets) stays separate files, never inlined into the JS as data URLs (Vite inlines files under
      // 4 kB, and every sprite is that small): the browser loads only the sprites it shows and caches them by hash
      assetsInlineLimit: (file) => (file.includes('/src/assets/') ? false : undefined),
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              // what every page needs and rarely changes: its own file, still cached after a deploy that only
              // changes the game (charts are left to the tabs that draw them)
              {
                name: 'vendor',
                priority: 2,
                test: /[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|@tanstack|@radix-ui|@floating-ui|i18next|i18next-browser-languagedetector|react-i18next|sonner|next-themes|lucide-react|clsx|tailwind-merge|class-variance-authority)[\\/]/,
              },
              // the rest of what the first page loads, in one file rather than many small shared ones (fewer
              // requests on a slow connection); the code only a tab uses stays with that tab
              { name: 'app', priority: 1, tags: ['$initial'] },
            ],
          },
        },
        // The shared packages run no code on import that the client needs, so modules the client doesn't use (the
        // contracts' schemas, which @marchlands/api-client reaches through PushCmd, and the database schema behind
        // them) are left out, and with them zod and drizzle. Client builds only: the API needs the schemas
        // registered on import (zod .meta(), its OpenAPI document).
        treeshake: {
          moduleSideEffects: [
            { test: /[\\/](shared[\\/](core|contracts)|backend[\\/]packages[\\/]db)[\\/]src[\\/]/, sideEffects: false },
            { test: /[\\/]node_modules[\\/](zod|drizzle-orm|drizzle-zod)[\\/]/, sideEffects: false },
          ],
        },
      },
    },
    server: {
      port: Number(env.WEB_DEV_PORT || 5173),
      proxy: {
        '/api': { target, changeOrigin: true },
        '/docs': { target, changeOrigin: true },
        '/ws': { target, ws: true, changeOrigin: true },
      },
    },
  };
});
