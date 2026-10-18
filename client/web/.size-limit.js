// Size budget of the browser client, checked after every build (`npm run build`, so also the web Docker image):
// a build over a limit fails. Sizes are gzipped (`gzip: true`; size-limit's default is brotli), as nginx serves them
// (client/web/nginx.conf). Each limit is the size when it was set (October 2026) plus 10-15%. Raise a limit only on
// purpose, saying why in the commit; AGENTS.md (Client, rule 7) has the rules that keep these small.
export default [
  {
    // everything the first page loads before showing anything
    name: 'first page',
    path: ['dist/assets/rolldown-runtime-*.js', 'dist/assets/vendor-*.js', 'dist/assets/app-*.js', 'dist/assets/app-*.css'],
    limit: '310 kB',
    gzip: true,
  },
  {
    // the game's own code for the first page; a jump here usually means a zod schema module came in (AGENTS.md,
    // Shared code)
    name: 'app',
    path: 'dist/assets/app-*.js',
    limit: '110 kB',
    gzip: true,
  },
  {
    // React, the router, Radix … (vite.config.ts, vendor)
    name: 'vendor',
    path: 'dist/assets/vendor-*.js',
    limit: '185 kB',
    gzip: true,
  },
  {
    // the biggest tab: the market's price chart (recharts)
    name: 'market tab',
    path: 'dist/assets/market-panel-*.js',
    limit: '115 kB',
    gzip: true,
  },
  {
    // every sprite (buildings, walls, map tiles and troops in src/assets, AGENTS.md Client, Game art), loaded as the
    // screens show them. PNG is already compressed, so this counts the files as they are. Sized for the real pixel art,
    // about 3 kB a building sprite (a troop is about 0.3 kB)
    name: 'game art',
    path: 'dist/assets/*.png',
    limit: '250 kB',
    brotli: false,
  },
  {
    // a language other than English, loaded only when chosen
    name: 'Japanese',
    path: 'dist/assets/ja-JP-*.js',
    limit: '35 kB',
    gzip: true,
  },
];
