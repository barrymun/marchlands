import { UnlockKind } from '@marchlands/core';
import { buildingName, techName, troopName } from '@/lib/game-data';

/** The name of a building, troop or technology a tech unlocks, in the current locale. */
export function unlockName(u: { kind: UnlockKind; id: number }): string {
  if (u.kind === UnlockKind.BUILDING) return buildingName(u.id);
  if (u.kind === UnlockKind.TROOP) return troopName(u.id);
  return techName(u.id);
}
