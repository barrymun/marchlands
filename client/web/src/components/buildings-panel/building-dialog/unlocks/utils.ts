import type { UnlockKind } from '@marchlands/core';
import { buildingName, techName, troopName } from '@/lib/game-data';

/** The name of something a building unlocks (a building type, troop or technology), in the current locale. */
export function unlockName(u: { kind: UnlockKind; id: number }): string {
  if (u.kind === 'building') return buildingName(u.id);
  if (u.kind === 'troop') return troopName(u.id);
  return techName(u.id);
}
