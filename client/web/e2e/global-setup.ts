// Before the run: check the stack answers, delete the accounts of earlier runs that were killed before their teardown,
// and name this run, so its accounts (fx_e2e_<run>_<n>) never clash with another's and the teardown finds them
// (support/stack.ts, accountsFile). Workers inherit E2E_RUN.
import { randomBytes } from 'node:crypto';
import { deleteAccounts } from './support/cleanup.ts';
import { staleAccountFiles, WEB } from './support/stack.ts';

/** A list untouched this long is a stopped run's, not one still going (a whole run takes about a minute). */
const STALE_MS = 30 * 60_000;

export default async function globalSetup() {
  const res = await fetch(WEB).catch(() => null);
  if (!res?.ok) throw new Error(`No stack at ${WEB}: start it (docker compose up -d), or set WEB to the web container's address.`);
  for (const file of staleAccountFiles(STALE_MS)) deleteAccounts(file);
  process.env.E2E_RUN = randomBytes(4).toString('hex').slice(0, 5);
}
