/** Building sprite URLs by file name (`town-hall-4.png`, lib/game-art.ts); Vite gives each file a hashed name. */
export const BUILDING_ART: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob<string>('@/assets/buildings/*.png', { eager: true, query: '?url', import: 'default' })).map(([file, url]) => [
    file.slice(file.lastIndexOf('/') + 1),
    url,
  ]),
);
