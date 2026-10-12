// Bundles the backend's entry points (API, worker, migrations) into dist/backend/bin/*.mjs with esbuild, so the
// production image ships those bundles and a few assets instead of the TypeScript sources and node_modules.
// Run by backend/Dockerfile: `node tools/build/backend.mjs [--minify]`.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const root = path.resolve(import.meta.dirname, '../..');
const out = path.join(root, 'dist/backend');
const bin = path.join(out, 'bin');
const minify = process.argv.includes('--minify');

const entryPoints = {
  api: 'backend/services/api/src/main.ts',
  worker: 'backend/services/worker/src/main.ts',
  migrate: 'backend/packages/db/src/main.ts',
};

// Dependencies that read their own files at run time (relative to __dirname). Their __dirname is rewritten to
// dist/backend/bin/<package>/<dir> and the files they read are copied there.
const OWN_FILES = {
  '@fastify/swagger-ui': ['static'],
  '@fastify/swagger': ['package.json'],
};

const require = createRequire(path.join(root, 'backend/services/api/package.json'));
const packageDir = (name) => path.dirname(require.resolve(`${name}/package.json`));

/** Rewrites __dirname in the OWN_FILES packages to where their files are copied next to the bundle. */
const ownFiles = {
  name: 'own-files',
  setup(b) {
    for (const name of Object.keys(OWN_FILES)) {
      const dir = packageDir(name);
      const filter = new RegExp(`^${dir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/.*\\.js$`);
      b.onLoad({ filter }, async (args) => {
        const rel = path.relative(dir, path.dirname(args.path));
        const js = await fs.promises.readFile(args.path, 'utf8');
        return { contents: js.replaceAll('__dirname', `__bundleDir + ${JSON.stringify(`/${name}${rel ? '/' + rel : ''}`)}`), loader: 'js' };
      });
    }
  },
};

fs.rmSync(out, { recursive: true, force: true });
await build({
  absWorkingDir: root,
  entryPoints,
  outdir: bin,
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  minify,
  keepNames: true,
  // pg's optional native binding is required inside a try/catch
  external: ['pg-native'],
  // CommonJS dependencies call require() and read __dirname, which an ES module doesn't have
  banner: {
    js: [
      "import { createRequire as __createRequire } from 'node:module';",
      "import { fileURLToPath as __fileURLToPath } from 'node:url';",
      'const require = __createRequire(import.meta.url);',
      'const __bundleDir = __fileURLToPath(new URL(".", import.meta.url)).replace(/\\/$/, "");',
    ].join('\n'),
  },
  plugins: [ownFiles],
  logLevel: 'warning',
});

for (const [name, files] of Object.entries(OWN_FILES)) {
  for (const f of files) fs.cpSync(path.join(packageDir(name), f), path.join(bin, name, f), { recursive: true });
}

// the migrator reads the journal and the SQL files (not the snapshots), from ../migrations (db migrate.ts)
const migrations = path.join(root, 'backend/packages/db/migrations');
fs.mkdirSync(path.join(out, 'migrations/meta'), { recursive: true });
fs.cpSync(path.join(migrations, 'meta/_journal.json'), path.join(out, 'migrations/meta/_journal.json'));
for (const f of fs.readdirSync(migrations).filter((f) => f.endsWith('.sql'))) fs.cpSync(path.join(migrations, f), path.join(out, 'migrations', f));

for (const f of fs.readdirSync(bin)) {
  const s = fs.statSync(path.join(bin, f));
  if (s.isFile()) console.log(`${f.padEnd(14)} ${(s.size / 1024).toFixed(0).padStart(6)} KB`);
}
