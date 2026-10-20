// Buildings that finished a level while the page was open, for the town's sparkle (components/iso-anim): the push
// handler notes each one as it completes (lib/push/handlers.ts), with the page's clock (performance.now()), which is
// also the clock the town's animations run on. Kept in memory only; a reload forgets them.

const finished = new Map<string, number>();

/** Note that the building at `positionId` in city `cityId` finished a level at `at` (ms, the page's clock). */
export function noteBuilt(cityId: number, positionId: number, at: number) {
  finished.set(`${cityId}:${positionId}`, at);
}

/** When the building at `positionId` in city `cityId` last finished a level while the page was open, if it did. */
export function builtAt(cityId: number, positionId: number): number | undefined {
  return finished.get(`${cityId}:${positionId}`);
}
