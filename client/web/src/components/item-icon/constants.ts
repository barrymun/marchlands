/** Item icon URLs by file name (`napoleons-diary.png`, lib/game-art.ts); Vite gives each file a hashed name. */
export const ITEM_ART: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob<string>('@/assets/items/*.png', { eager: true, query: '?url', import: 'default' })).map(([file, url]) => [
    file.slice(file.lastIndexOf('/') + 1),
    url,
  ]),
);
