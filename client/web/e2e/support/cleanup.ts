// Deleting a run's accounts, the way the game does (npm run delete-player, which reads DATABASE_URL from the repo's
// .env), and then its list.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { REPO_ROOT } from './stack.ts';

export function deleteAccounts(file: string) {
  if (!existsSync(file)) return;
  const usernames = readFileSync(file, 'utf8').split('\n').filter(Boolean);
  if (usernames.length) execFileSync('npm', ['run', '--silent', 'delete-player', '--', ...usernames, '--yes'], { cwd: REPO_ROOT, stdio: 'inherit' });
  rmSync(file);
}
