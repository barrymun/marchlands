// After the run, failed or not: delete the accounts it made. A run killed before this point leaves its list, which
// the next run's setup cleans up (global-setup.ts).
import { deleteAccounts } from './support/cleanup.ts';
import { accountsFile } from './support/stack.ts';

export default function globalTeardown() {
  const run = process.env.E2E_RUN;
  if (run) deleteAccounts(accountsFile(run));
}
