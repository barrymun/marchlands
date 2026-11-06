// Bursts on the gear icons (docs/features/gear-animations.md, phase 3): the gear card starts one on a piece when a star
// is added, or on every piece when the gear level rises, and each icon showing that piece plays it. Times are the
// page's clock (performance.now()), the one the icons' animation frames run on. Kept in memory only.

import type { GearPieceId } from '@marchlands/core';

const bursts = new Map<GearPieceId, number>();
const listeners = new Set<(piece: GearPieceId) => void>();

/** Start a burst on `piece`'s icons at `at` (ms, the page's clock; later for one that waits its turn), and tell the icons. */
export function startBurst(piece: GearPieceId, at = performance.now()) {
  bursts.set(piece, at);
  for (const l of listeners) l(piece);
}

/** When the latest burst on `piece` starts or started, if there was one while the page was open. */
export function burstAt(piece: GearPieceId): number | undefined {
  return bursts.get(piece);
}

/** Hear of each burst as it is started; the function returned stops listening. */
export function onBurst(listener: (piece: GearPieceId) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
