/** Troop badge URLs by file name (`cataphract.png`, lib/game-art.ts); Vite gives each file a hashed name. */
export const TROOP_BADGES: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob<string>('@/assets/badges/*.png', { eager: true, query: '?url', import: 'default' })).map(([file, url]) => [
    file.slice(file.lastIndexOf('/') + 1),
    url,
  ]),
);
