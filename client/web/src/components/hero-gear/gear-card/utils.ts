import { GEAR_LEVEL_KEY } from '@/components/hero-gear/gear-card/constants';

/** The gear levels remembered for each player in this browser; empty when there are none, or what's stored can't be read. */
function storedLevels(): Record<string, unknown> {
  try {
    const all: unknown = JSON.parse(localStorage.getItem(GEAR_LEVEL_KEY) ?? '{}');
    return typeof all === 'object' && all != null && !Array.isArray(all) ? (all as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** The gear level the card last showed player `playerId` in this browser, or null if it never has (or storage is off). */
export function rememberedGearLevel(playerId: number): number | null {
  const level = storedLevels()[playerId];
  return typeof level === 'number' ? level : null;
}

/** Remember that the card showed player `playerId` the gear at `level`, beside other players' (several accounts in one browser). */
export function rememberGearLevel(playerId: number, level: number) {
  try {
    localStorage.setItem(GEAR_LEVEL_KEY, JSON.stringify({ ...storedLevels(), [playerId]: level }));
  } catch {
    // without storage the card bursts only while it's open
  }
}

/** Whether the gear went up a level since the card last showed it (`before`, null when it never has): the pieces burst. */
export function gearLevelRose(before: number | null, level: number): boolean {
  return before != null && level > before;
}
