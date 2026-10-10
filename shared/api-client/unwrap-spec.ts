// The API answers `{ ok: 1, data }`; the generated client unwraps that envelope at runtime
// (src/http.ts), so it is generated from a copy of the OpenAPI document whose success responses
// describe `data` itself:
//   node unwrap-spec.ts   (openapi.json -> openapi.client.json)

import fs from 'node:fs';
import path from 'node:path';

type Schema = { properties?: { ok?: unknown; data?: unknown } };
const dir = import.meta.dirname;
const spec = JSON.parse(fs.readFileSync(path.join(dir, 'openapi.json'), 'utf8'));
let n = 0;
for (const methods of Object.values(spec.paths) as Record<string, { responses?: Record<string, { content?: Record<string, { schema?: Schema }> }> }>[]) {
  for (const op of Object.values(methods)) {
    const json = op.responses?.['200']?.content?.['application/json'];
    if (json?.schema?.properties?.ok && 'data' in json.schema.properties) {
      json.schema = json.schema.properties.data as Schema;
      n++;
    }
  }
}
fs.writeFileSync(path.join(dir, 'openapi.client.json'), JSON.stringify(spec, null, 2) + '\n');
console.log(`openapi.client.json: ${n} success responses unwrapped`);
