#!/usr/bin/env node
// Regenerates docs/api-endpoints.md from the OpenAPI document written by `npm run gen:api`
// (shared/api-client/openapi.json), or from a running API: API=http://localhost:3000 node tools/docs/gen-api-md.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const spec = process.env.API
  ? await fetch(`${process.env.API}/docs/json`).then((r) => r.json())
  : JSON.parse(fs.readFileSync(path.resolve(here, '../../shared/api-client/openapi.json'), 'utf8'));
const byTag = new Map();
for (const [p, ops] of Object.entries(spec.paths)) {
  for (const [method, op] of Object.entries(ops)) {
    const tag = op.tags?.[0] ?? 'misc';
    if (!byTag.has(tag)) byTag.set(tag, []);
    byTag.get(tag).push({ method: method.toUpperCase(), path: p, summary: op.summary ?? '', auth: !!op.security });
  }
}
const order = ['auth', 'player', 'city', 'buildings', 'research', 'troops', 'heroes', 'armies', 'map', 'mail', 'reports', 'chat', 'friends', 'alliance', 'market', 'shop', 'quests', 'rankings', 'config', 'admin'];
const tags = [...byTag.keys()].sort((a, b) => (order.indexOf(a) + 100) % 100 - (order.indexOf(b) + 100) % 100);
let md = `# API endpoints\n\nGenerated from the OpenAPI document by \`npm run gen:api\` (\`tools/docs/gen-api-md.mjs\`). Interactive docs: \`/docs\`.\n\n`;
md += 'All paths are relative to the server root. Names in parentheses are the original client commands (`module.command`) each endpoint replaces.\n\n';
for (const tag of tags) {
  md += `## ${tag}\n\n| Method | Path | Description |\n|---|---|---|\n`;
  for (const r of byTag.get(tag).sort((a, b) => a.path.localeCompare(b.path))) {
    md += `| ${r.method} | \`${r.path}\` | ${r.summary.replace(/\|/g, '\\|')}${r.auth ? '' : ' *(public)*'} |\n`;
  }
  md += '\n';
}
const out = path.resolve(here, '../../docs/api-endpoints.md');
fs.writeFileSync(out, md);
console.log(`wrote ${out}`);
