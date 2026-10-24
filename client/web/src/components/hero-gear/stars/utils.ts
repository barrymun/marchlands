import type { GearStarKind } from '@/lib/game-art';

/** How a piece's star `i` (from 0) shows: bought and in use, bought and waiting above the research level (`used`), or not yet bought. */
export function starKind(i: number, count: number, used?: number): GearStarKind {
  if (i >= count) return 'empty';
  return used == null || i < used ? 'used' : 'waiting';
}
