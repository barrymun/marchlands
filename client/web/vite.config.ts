import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The dev server proxies the API so the browser talks to one origin (no CORS, same-origin WebSocket).
// Target: API_PROXY, else http://localhost:${API_PORT} from the repo's .env, else :3000.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(import.meta.dirname, '../..'), '');
  const target = env.API_PROXY || `http://localhost:${env.API_PORT || 3000}`;
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
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
