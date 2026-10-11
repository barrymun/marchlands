// openapi.ts is a script (it writes on import): run it in a child process, writing to a temporary file, never to the
// repository's shared/api-client/openapi.json.

import { afterEach, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type { Db } from '@marchlands/db';
import { buildApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';

const SCRIPT = path.join(import.meta.dirname, '../src/openapi.ts');
const run = promisify(execFile);

let dir: string | undefined;
afterEach(() => {
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

describe('openapi.ts', () => {
  it('writes the OpenAPI document of the app to the given file', async () => {
    dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'marchlands-openapi-')));
    const out = path.join(dir, 'spec.json');
    const { stdout } = await run(process.execPath, [SCRIPT, out], { cwd: dir, env: { PATH: process.env.PATH ?? '' } });
    expect(stdout.trim()).toBe('wrote spec.json');
    const text = fs.readFileSync(out, 'utf8');
    expect(text.endsWith('}\n')).toBe(true);

    // the same document the app serves
    const app = await buildApp({
      db: {} as Db,
      config: loadConfig({ DATABASE_URL: 'postgres://unused', JWT_SECRET: 'openapi-export' }),
      gateway: null,
      logger: false,
    });
    await app.ready();
    try {
      expect(text).toBe(JSON.stringify(app.swagger(), null, 2) + '\n');
    } finally {
      await app.close();
    }
  }, 30_000);
});
