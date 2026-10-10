// Hey API: generates the typed SDK (one function per operationId), the types and TanStack Query
// options/keys/mutations from openapi.client.json (see unwrap-spec.ts). `npm run gen:api` runs it.
import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: './openapi.client.json',
  output: { path: './src/generated' },
  plugins: ['@hey-api/client-fetch', '@hey-api/typescript', '@hey-api/sdk', '@tanstack/react-query'],
});
