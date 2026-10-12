// Writes a gzipped copy (<file>.gz, best compression) next to each text file of a static build, for nginx's
// gzip_static (client/web/nginx.conf): compressed once at build time, never per request.
// Run by client/web/Dockerfile: `node tools/build/precompress.mjs client/web/dist`.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const dir = path.resolve(process.argv[2] ?? 'client/web/dist');
const TEXT = /\.(js|mjs|css|html|svg|json|txt|xml|webmanifest)$/;
let before = 0;
let after = 0;
for (const entry of fs.readdirSync(dir, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || !TEXT.test(entry.name)) continue;
  const file = path.join(entry.parentPath, entry.name);
  const data = fs.readFileSync(file);
  const gz = zlib.gzipSync(data, { level: 9 });
  // tiny files gain nothing: nginx serves them as they are
  if (gz.length >= data.length * 0.9) continue;
  fs.writeFileSync(`${file}.gz`, gz);
  before += data.length;
  after += gz.length;
}
console.log(`precompressed ${(before / 1024).toFixed(0)} kB to ${(after / 1024).toFixed(0)} kB (gzip -9)`);
