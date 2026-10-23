/** Hero gear sprite URLs by file name (`weapon-3.png`, `backdrop-3.png`, `star-used.png`; lib/game-art.ts); Vite gives each file a hashed name. */
export const GEAR_ART: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob<string>('@/assets/gear/*.png', { eager: true, query: '?url', import: 'default' })).map(([file, url]) => [
    file.slice(file.lastIndexOf('/') + 1),
    url,
  ]),
);
