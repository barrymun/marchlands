import { TileType } from '@marchlands/core';
import type { RelationGroup } from '@/components/map-panel/types';
import { i18n } from '@/lib/i18n';

export const R = 7; // 15x15 view

/** Map tile colours by tile type; tiles are named with `tileName` (lib/game-data). */
export const TILE_STYLE: Record<number, { className: string }> = {
  [TileType.FOREST]: { className: 'bg-emerald-700/70 text-white' },
  [TileType.DESERT]: { className: 'bg-amber-300/80' },
  [TileType.HILL]: { className: 'bg-stone-400/80' },
  [TileType.SWAMP]: { className: 'bg-teal-800/60 text-white' },
  [TileType.GRASS]: { className: 'bg-lime-400/70' },
  [TileType.LAKE]: { className: 'bg-sky-500/70 text-white' },
  [TileType.FLAT]: { className: 'bg-yellow-100/70 dark:bg-yellow-950/40' },
  [TileType.CASTLE]: { className: 'bg-blue-600 text-white' },
  [TileType.NPC]: { className: 'bg-red-700 text-white' },
};

/** `label` (a heading) and `inline` (inside a sentence) are in the current locale. */
const relation = (key: RelationGroup, ring: string, dot: string) => ({
  get label() {
    return i18n.t(`map-panel:relations.${key}`);
  },
  get inline() {
    return i18n.t(`map-panel:relationsInline.${key}`);
  },
  ring,
  dot,
});

export const RELATION_STYLE: Record<RelationGroup, { label: string; inline: string; ring: string; dot: string }> = {
  friend: relation('friend', 'ring-2 ring-emerald-500 ring-inset', 'bg-emerald-500'),
  enemy: relation('enemy', 'ring-2 ring-red-600 ring-inset', 'bg-red-600'),
  other: relation('other', 'ring-2 ring-zinc-900 ring-inset dark:ring-zinc-100', 'bg-zinc-900 dark:bg-zinc-100'),
};
