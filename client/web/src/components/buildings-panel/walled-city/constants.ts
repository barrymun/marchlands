/** Wall piece URLs by file name (`walls-4-gate.png`, lib/game-art.ts); Vite gives each file a hashed name. */
export const WALL_ART: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob<string>('@/assets/walls/*.png', { eager: true, query: '?url', import: 'default' })).map(([file, url]) => [
    file.slice(file.lastIndexOf('/') + 1),
    url,
  ]),
);

/** CSS pixels per pixel of wall art: the 16-pixel wall pieces are 32 px thick on screen. */
export const WALL_SCALE = 2;

/** Where the four corner towers sit: centred on the frame's corners, so they stand out past the walls a little. */
export const CORNERS = ['-top-2 -left-2', '-top-2 -right-2', '-bottom-2 -left-2', '-bottom-2 -right-2'] as const;
