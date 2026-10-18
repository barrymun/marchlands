import type { RelationGroup } from '@/components/map-panel/types';
import { i18n } from '@/lib/i18n';

/** Image URLs by file name in an art folder; Vite gives each file a hashed name. */
const byFile = (urls: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.entries(urls).map(([file, url]) => [file.slice(file.lastIndexOf('/') + 1), url]));

/** Map tile sprites by file name (`forest-4.png`, `castle-2.png`, lib/game-art.ts tileArtFile). */
export const TILE_ART = byFile(import.meta.glob<string>('@/assets/tiles/*.png', { eager: true, query: '?url', import: 'default' }));

/** The grass laid under every map tile: the isometric town's grass tile. */
export const GRASS = Object.values(import.meta.glob<string>('@/assets/city/grass.png', { eager: true, query: '?url', import: 'default' }))[0];

/** `label` (a heading) and `inline` (inside a sentence) are in the current locale. */
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
  friend: relation('friend', 'ring-2 ring-emerald-500 ring-inset', 'stroke-emerald-500'),
  enemy: relation('enemy', 'ring-2 ring-red-600 ring-inset', 'stroke-red-600'),
  other: relation('other', 'ring-2 ring-zinc-900 ring-inset dark:ring-zinc-100', 'stroke-zinc-900 dark:stroke-zinc-100'),
};
