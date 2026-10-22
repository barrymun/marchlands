/** Resource icon URLs by file name (`wood.png`, lib/game-art.ts); Vite gives each file a hashed name. */
export const RESOURCE_ART: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob<string>('@/assets/resources/*.png', { eager: true, query: '?url', import: 'default' })).map(([file, url]) => [
    file.slice(file.lastIndexOf('/') + 1),
    url,
  ]),
);
