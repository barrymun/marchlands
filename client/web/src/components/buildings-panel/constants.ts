export const INSIDE = Array.from({ length: 32 }, (_, i) => i);

export const OUTSIDE = Array.from({ length: 40 }, (_, i) => 1001 + i);

/** Image URLs by file name in an art folder; Vite gives each file a hashed name. */
const byFile = (urls: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.entries(urls).map(([file, url]) => [file.slice(file.lastIndexOf('/') + 1), url]));

/** Building sprite URLs by file name (`town-hall-4.png`, lib/game-art.ts). */
export const BUILDING_ART = byFile(import.meta.glob<string>('@/assets/buildings/*.png', { eager: true, query: '?url', import: 'default' }));

/** The isometric city view's ground and wall pieces by file name (`plot.png`, lib/game-art.ts). */
export const CITY_ART = byFile(import.meta.glob<string>('@/assets/city/*.png', { eager: true, query: '?url', import: 'default' }));

/** How the panel can show the buildings: the isometric scene, or cards. Remembered in localStorage (VIEW_KEY), so a value never changes. */
export const CityView = { SCENE: 'scene', GRID: 'grid' } as const;
export type CityView = (typeof CityView)[keyof typeof CityView];
/** The city views in the order of their buttons. */
export const CITY_VIEWS = Object.values(CityView);

/** The area of the city the panel shows: inside the walls (the Town view), or the fields outside them (the Fields view). */
export const CityArea = { INSIDE: 'inside', FIELDS: 'fields' } as const;
export type CityArea = (typeof CityArea)[keyof typeof CityArea];

/** Screens at least this wide may show the isometric scene (Tailwind's md); narrower ones always show the cards. */
export const TOWN_VIEW_QUERY = '(min-width: 768px)';

/** Which city view the panel shows, remembered per browser. */
export const VIEW_KEY = 'marchlands-city-view';

/** A box floating over the scene: the title and tags, the view switch. */
export const FLOATING = 'absolute rounded-lg border bg-background/90 shadow backdrop-blur';
