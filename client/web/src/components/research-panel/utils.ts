import type { TechUnlockKind } from '@marchlands/core';
import { buildingName, techName, troopName } from '@/lib/game-data';

/** The name of a building, troop or technology a tech unlocks, in the current locale. */
export function unlockName(u: { kind: TechUnlockKind; id: number }): string {
  if (u.kind === 'building') return buildingName(u.id);
  if (u.kind === 'troop') return troopName(u.id);
  return techName(u.id);
}
