// Keeps the folders already fixed for noUncheckedIndexedAccess fixed (docs/features/unchecked-index-access.md).
// The flag is off in the tsconfigs until every folder is done, so this runs tsc with it on and fails only on errors
// in the folders listed in DONE. Part of `npm run typecheck`; it goes once both tsconfigs have the flag.
//
//   node tools/dev/check-index-access.mjs

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** Folders with no unchecked index access left, as path prefixes from the repo root. */
const DONE = [
  'shared/core/src/',
  'backend/packages/db/src/',
  'backend/packages/game/src/',
  'backend/services/api/src/',
  'backend/services/worker/src/',
  'tools/dev/',
  'tools/battle-sim/',
  'client/web/src/',
];

/** Files inside a done folder that aren't done yet: the client's tests live in its src, and tests come last. */
const NOT_YET = [/\.test\.tsx?\(/];

/** The two projects, and the folders each one reports (the client's also compiles shared/core, reported by the root's). */
const PROJECTS = [
  { tsconfig: 'tsconfig.json', reports: (file) => !file.startsWith('client/') },
  { tsconfig: 'client/web/tsconfig.json', reports: (file) => file.startsWith('client/') },
];

const tsc = fileURLToPath(import.meta.resolve('typescript/bin/tsc'));
const root = fileURLToPath(new URL('../..', import.meta.url));
let failed = 0;
for (const { tsconfig, reports } of PROJECTS) {
  const done = DONE.filter(reports);
  if (!done.length) continue;
  const run = spawnSync(process.execPath, [tsc, '-p', tsconfig, '--noEmit', '--noUncheckedIndexedAccess'], { cwd: root, encoding: 'utf8' });
  const lines = run.stdout.split('\n');
  const errors = lines.filter((l) => /^\S+\(\d+,\d+\): error TS\d+/.test(l));
  if (run.status !== 0 && !errors.length) {
    // tsc failed without reporting a type error (a crash, a bad option): show what it said
    console.error(run.stdout + run.stderr);
    failed++;
    continue;
  }
  for (const line of errors) {
    if (!done.some((folder) => reports(line) && line.startsWith(folder)) || NOT_YET.some((re) => re.test(line))) continue;
    console.error(line);
    failed++;
  }
}
if (failed) {
  console.error(`\n${failed} unchecked index access error(s) in folders already done (DONE in tools/dev/check-index-access.mjs).`);
  process.exit(1);
}
