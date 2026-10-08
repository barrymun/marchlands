// Writes the OpenAPI document without a database or a listening server:
//   node backend/services/api/src/openapi.ts [out.json]
// `npm run gen:api` runs this, then generates the typed client in shared/api-client.

import fs from 'node:fs';
import path from 'node:path';
import type { Db } from '@marchlands/db';
import { buildApp } from './app.ts';
import { loadConfig } from './config.ts';

const out = path.resolve(process.argv[2] ?? path.join(import.meta.dirname, '../../../../shared/api-client/openapi.json'));
const config = loadConfig({ DATABASE_URL: 'postgres://unused', JWT_SECRET: 'openapi-export' });
const app = await buildApp({ db: {} as Db, config, gateway: null, logger: false });
await app.ready();
fs.writeFileSync(out, JSON.stringify(app.swagger(), null, 2) + '\n');
await app.close();
console.log(`wrote ${path.relative(process.cwd(), out)}`);
