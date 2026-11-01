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
    // Shared code). Raised from 110 kB (2026-10-20) for the isometric viewport's animation layer (overlays and the
    // redraw clock); the animations themselves load after the first page (components/iso-anim/hooks.ts). Raised to
    // 118 kB (2026-10-31) for faction standing (115.56 kB): en-GB's text for every screen, and BALANCE, ship here, so
    // new text anywhere grows this chunk (docs/backlog.md, English text in the first page). Raised to 120 kB
    // (2026-11-01, at 118.34 kB) for the historic cities: their names, camp times' landing time, the seats' draft
    // controls and reports, and their text
    name: 'app',
    path: 'dist/assets/app-*.js',
    limit: '120 kB',
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
    // the market's charts (TradingView Lightweight Charts, about 45 kB of it), loaded with the Market page only
    name: 'market tab',
    path: 'dist/assets/market-panel-*.js',
    limit: '70 kB',
    gzip: true,
  },
  {
    // the hero's 3D figure (three.js, most of it; docs/features/hero-3d.md), loaded only when the figure is drawn in 3D
    name: 'hero 3d',
    path: 'dist/assets/hero-figure-3d-*.js',
    limit: '165 kB',
    gzip: true,
  },
  {
    // every sprite (buildings, walls, map tiles, units, resource and item icons in src/assets, AGENTS.md Client, Game art), loaded as the
    // screens show them. PNG is already compressed, so this counts the files as they are. Sized for the real pixel art,
    // about 3 kB a building sprite (a troop is about 0.3 kB)
    name: 'game art',
    path: 'dist/assets/*.png',
    limit: '250 kB',
    brotli: false,
  },
  {
    // a language other than English, loaded only when chosen. Raised to 40 kB (2026-11-01, at 35.02 kB): every screen's
    // text grows it, the historic cities' holding rules the last; it loads only for players who choose Japanese
    name: 'Japanese',
    path: 'dist/assets/ja-JP-*.js',
    limit: '40 kB',
    gzip: true,
  },
];
