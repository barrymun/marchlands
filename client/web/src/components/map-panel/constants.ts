import { TileType } from '@marchlands/core';
import type { RelationGroup } from '@/components/map-panel/types';

export const R = 7; // 15x15 view

export const TILE_STYLE: Record<number, { label: string; className: string }> = {
  [TileType.FOREST]: { label: 'Forest', className: 'bg-emerald-700/70 text-white' },
  [TileType.DESERT]: { label: 'Desert', className: 'bg-amber-300/80' },
  [TileType.HILL]: { label: 'Hill', className: 'bg-stone-400/80' },
  [TileType.SWAMP]: { label: 'Swamp', className: 'bg-teal-800/60 text-white' },
  [TileType.GRASS]: { label: 'Grassland', className: 'bg-lime-400/70' },
  [TileType.LAKE]: { label: 'Lake', className: 'bg-sky-500/70 text-white' },
  [TileType.FLAT]: { label: 'Flat', className: 'bg-yellow-100/70 dark:bg-yellow-950/40' },
  [TileType.CASTLE]: { label: 'City', className: 'bg-blue-600 text-white' },
  [TileType.NPC]: { label: 'Barbarian city', className: 'bg-red-700 text-white' },
};

export const RELATION_STYLE: Record<RelationGroup, { label: string; ring: string; dot: string }> = {
  friend: { label: 'Alliance & allies', ring: 'ring-2 ring-emerald-500 ring-inset', dot: 'bg-emerald-500' },
  enemy: { label: 'Enemy', ring: 'ring-2 ring-red-600 ring-inset', dot: 'bg-red-600' },
  other: { label: 'Other players', ring: 'ring-2 ring-zinc-900 ring-inset dark:ring-zinc-100', dot: 'bg-zinc-900 dark:bg-zinc-100' },
};
