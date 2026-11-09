// Where the stack under test is: WEB if set, else the web container's port from the repo's .env (WEB_PORT), as
// docker-compose.yml publishes it. A worktree's second stack has its own .env, so the same command tests it.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseEnv } from 'node:util';

export const REPO_ROOT = path.resolve(import.meta.dirname, '../../../..');

function envFile(): Record<string, string | undefined> {
  const file = path.join(REPO_ROOT, '.env');
  return existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : {};
}

export const WEB = process.env.WEB ?? `http://localhost:${envFile().WEB_PORT ?? '8000'}`;

/** The runs' account lists are named after this checkout, so a worktree's (and its stack's) are its own. */
const LIST_PREFIX = `marchlands-e2e-${createHash('sha256').update(REPO_ROOT).digest('hex').slice(0, 8)}-`;

/** The accounts a run made, one username a line, for the teardown to delete (E2E_RUN is set by the global setup). */
export const accountsFile = (run: string) => path.join(tmpdir(), `${LIST_PREFIX}${run}.txt`);

/**
 * This checkout's account lists left by runs stopped before their teardown (killed, or the machine went down),
 * untouched for `maxAgeMs`: a run in progress adds to its list as its workers start, and lasts about a minute.
 */
export function staleAccountFiles(maxAgeMs: number): string[] {
  return readdirSync(tmpdir())
    .filter((name) => name.startsWith(LIST_PREFIX) && name.endsWith('.txt'))
    .map((name) => path.join(tmpdir(), name))
    .filter((file) => Date.now() - statSync(file).mtimeMs > maxAgeMs);
}
