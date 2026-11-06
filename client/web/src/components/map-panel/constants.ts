import { i18n } from '@/lib/i18n';

/** Image URLs by file name in an art folder; Vite gives each file a hashed name. */
const byFile = (urls: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.entries(urls).map(([file, url]) => [file.slice(file.lastIndexOf('/') + 1), url]));

/** Map tile sprites by file name (`forest-4.png`, `castle-2.png`, lib/game-art.ts tileArtFile). */
export const TILE_ART = byFile(import.meta.glob<string>('@/assets/tiles/*.png', { eager: true, query: '?url', import: 'default' }));

/** The grass laid under every map tile: the isometric town's grass tile. */
// one file, so one URL ('' never loads: the map draws no grass, as with any missing art)
export const GRASS = Object.values(import.meta.glob<string>('@/assets/city/grass.png', { eager: true, query: '?url', import: 'default' }))[0] ?? '';

/** `label` (a heading) and `inline` (inside a sentence) are in the current locale. */
/** Which way a tile's holder is shown on the map, by their relation to the player. */
export const RelationGroup = {
  FRIEND: 'friend',
  ENEMY: 'enemy',
  OTHER: 'other',
} as const;
export type RelationGroup = (typeof RelationGroup)[keyof typeof RelationGroup];

const relation = (key: RelationGroup, ring: string, stroke: string) => ({
  get label() {
    return i18n.t(`map-panel:relations.${key}`);
  },
  get inline() {
    return i18n.t(`map-panel:relationsInline.${key}`);
  },
  ring,
  stroke,
});

/** How another player's valley is marked, by your relation: a ring in the legend, an outline on the map. */
export const RELATION_STYLE: Record<RelationGroup, { label: string; inline: string; ring: string; stroke: string }> = {
  friend: relation(RelationGroup.FRIEND, 'ring-2 ring-emerald-500 ring-inset', 'stroke-emerald-500'),
  enemy: relation(RelationGroup.ENEMY, 'ring-2 ring-red-600 ring-inset', 'stroke-red-600'),
  other: relation(RelationGroup.OTHER, 'ring-2 ring-zinc-900 ring-inset dark:ring-zinc-100', 'stroke-zinc-900 dark:stroke-zinc-100'),
};

/** Where this browser remembers whether the map is tinted by faction (localStorage). */
export const FACTION_TINT_KEY = 'marchlands-map-factions';

/** The list open under the map's toolbar: the player's other cities, this city's valleys, the farming lists or the key. */
export const MapList = { CITIES: 'cities', VALLEYS: 'valleys', FARMS: 'farms', LEGEND: 'legend' } as const;
export type MapList = (typeof MapList)[keyof typeof MapList];

/** Whether the map is tinted by faction. Remembered in localStorage (FACTION_TINT_KEY), so a value never changes. */
export const FactionTint = { ON: 'on', OFF: 'off' } as const;
