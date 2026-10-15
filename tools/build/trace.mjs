// Maps a stack trace from the minified bundles back to source positions, with the source maps built next to them
// (dist/backend-maps). In production it runs inside the backend image, whose maps match its bundles exactly
// (docs/deployment.md, Reading a stack trace):
//   docker compose logs --no-log-prefix api | docker compose exec -T api node tools/build/trace.mjs
// Locally, after `npm run build:backend`: npm run trace < trace.txt
// Accepts plain stack traces and JSON log lines (their escaped \n become line breaks).
import fs from 'node:fs';
import { SourceMap } from 'node:module';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const bin = path.join(root, 'dist/backend/bin');
const mapsDir = path.join(root, 'dist/backend-maps');

if (!fs.existsSync(mapsDir)) {
  console.error('No source maps in dist/backend-maps: run `npm run build:backend` first.');
  process.exit(1);
}

const maps = new Map();
function mapOf(bundle) {
  if (!maps.has(bundle)) {
    const file = path.join(mapsDir, `${bundle}.mjs.map`);
    maps.set(bundle, fs.existsSync(file) ? new SourceMap(JSON.parse(fs.readFileSync(file, 'utf8'))) : null);
  }
  return maps.get(bundle);
}

/** `bin/api.mjs:1:2345` (1-based, as in stack traces) -> `backend/services/api/src/app.ts:42:7` */
function original(bundle, line, column) {
  const entry = mapOf(bundle)?.findEntry(line - 1, column - 1);
  if (!entry?.originalSource) return null;
  // sources are relative to where esbuild wrote the map, next to the bundle
  const source = path.relative(root, path.resolve(bin, entry.originalSource));
  return `${source}:${entry.originalLine + 1}:${entry.originalColumn + 1}`;
}

const input = fs.readFileSync(0, 'utf8').replace(/\\n/g, '\n');
const output = input.replace(
  /(?:file:\/\/)?[^\s()"]*?bin\/(api|worker|migrate)\.mjs:(\d+):(\d+)/g,
  (whole, bundle, line, column) => original(bundle, Number(line), Number(column)) ?? whole,
);
process.stdout.write(output);
