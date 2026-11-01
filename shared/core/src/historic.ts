// Historic cities (docs/features/historical-cities.md): where they stand on the map, their garrisons, research and
// defending hero, and the troops that change with the day. Numbers live in BALANCE.historic.

import { BALANCE, scaled } from '#/balance.ts';
import { TechType, TileType } from '#/constants.ts';
import { createGuardHero } from '#/heroes.ts';
import { pick, seededRng } from '#/rng.ts';
import { DAY } from '#/time.ts';
import type { BuildingState, FortCounts, ResearchState, TroopCounts } from '#/types.ts';
import { freshNpcState, nextRefillAt, npcCityBuildings, type NpcState, refillCounts, regenerateNpc, stateOf } from '#/world.ts';

export const HISTORIC_LEVELS = [12, 14, 16, 18] as const;
export type HistoricLevel = (typeof HISTORIC_LEVELS)[number];

/** The troops that change each day: one of each pair, and one of the three siege engines. */
export interface HistoricDay {
  foot: 'pikemen' | 'swordsmen';
  horse: 'lightCavalry' | 'heavyCavalry';
  siege: 'batteringRam' | 'ballista' | 'catapult';
}

/**
 * The historic city's level at a map position, or null (docs/reference/historic-cities.md). Atlantis (18) at (0, 0);
 * each state's capital (16) in its middle; level 14s every 66 tiles from 33 across the whole map, three to a state
 * each way, but none in a state's middle place, by its capital; and level 12s every 18 tiles from 9, also across the
 * whole map (44 × 44 = 1,936), which puts one in each of those middle places.
 */
export function historicLevelAt(x: number, y: number, mapSize: number = BALANCE.mapSize): HistoricLevel | null {
  if (x === 0 && y === 0) return 18;
  const cell = mapSize / BALANCE.stateGrid;
  if (x % cell === cell / 2 && y % cell === cell / 2) return 16;
  const on14 = (v: number) => v >= 33 && (v - 33) % 66 === 0;
  // every third place of the level 14 grid is a state's middle one: a level 12 stands there instead
  const middle = (v: number) => ((v - 33) / 66) % 3 === 1;
  if (on14(x) && on14(y) && !(middle(x) && middle(y))) return 14;
  const on12 = (v: number) => v >= 9 && (v - 9) % 18 === 0;
  return on12(x) && on12(y) ? 12 : null;
}

/** Every historic city's position and level on a map. */
export function historicCities(mapSize: number = BALANCE.mapSize): { x: number; y: number; level: HistoricLevel }[] {
  const out: { x: number; y: number; level: HistoricLevel }[] = [];
  for (let y = 0; y < mapSize; y++)
    for (let x = 0; x < mapSize; x++) {
      const level = historicLevelAt(x, y, mapSize);
      if (level) out.push({ x, y, level });
    }
  return out;
}

/** The garrison a historic city keeps on a given day (a day is a UTC day, `Math.floor(ms / DAY)`), seeded by the tile. */
export function historicDay(tileId: number, day: number): HistoricDay {
  const rng = seededRng(`historic-day:${tileId}:${day}`);
  return {
    foot: pick(rng, ['pikemen', 'swordsmen'] as const),
    horse: pick(rng, ['lightCavalry', 'heavyCavalry'] as const),
    siege: pick(rng, ['batteringRam', 'ballista', 'catapult'] as const),
  };
}

/** A player's title from the historic cities they hold: a state's capital (16) or Atlantis (18), in that state. */
export interface SeatTitle {
  level: 16 | 18;
  /** the state the seat stands in (Atlantis: Friesland's corner) */
  zoneId: number;
}

/**
 * A player's seat title from the historic cities they hold (docs/features/historical-cities.md): Sovereign of Atlantis
 * when they hold it, else Ruler of the state whose capital they hold; null when they hold neither.
 */
export function seatTitle(held: readonly { historicLevel: number | null; tileId: number }[]): SeatTitle | null {
  const top = held.find((c) => c.historicLevel === 18) ?? held.find((c) => c.historicLevel === 16);
  return top ? { level: top.historicLevel === 18 ? 18 : 16, zoneId: stateOf(top.tileId) } : null;
}

/** A historic city's full garrison and fortifications on a day. */
export function historicGarrison(level: HistoricLevel, day: HistoricDay): { troops: TroopCounts; forts: FortCounts } {
  const [warriors, foot, archers, horse, siege] = BALANCE.historic.troops[level];
  return { troops: { militia: warriors, [day.foot]: foot, archer: archers, [day.horse]: horse, [day.siege]: siege }, forts: { ...BALANCE.historic.forts } };
}

/** A historic city's research: every research at BALANCE.historic.researchLevel (or `level`) but Archery, at 0. */
export function historicResearch(level: number = BALANCE.historic.researchLevel): ResearchState {
  const r: ResearchState = {};
  for (const id of Object.values(TechType)) r[id] = { level: id === TechType.ARCHERY ? 0 : level };
  return r;
}

/** The defending hero's Attack and Intelligence. */
export const historicHeroStats = (level: HistoricLevel) => BALANCE.historic.hero[level];

/**
 * The buildings of a captured historic city (docs/features/historical-cities.md): a captured level 10 barbarian city's,
 * all at level 10, but its resource fields at the seat's own level.
 */
export function historicCityBuildings(level: HistoricLevel): BuildingState[] {
  return npcCityBuildings(10).map((b) => (b.positionId >= 1001 ? { ...b, level } : b));
}

/**
 * The map string's level digit (one hex digit a tile, services/world.ts mapView): a historic city sends half its level
 * (6 to 9), since 16 and 18 don't fit in one; mapLevelOf reads it back.
 */
export const mapLevelDigit = (type: number, level: number) => (type === TileType.HISTORIC ? level / 2 : level);
export const mapLevelOf = (type: number, digit: number) => (type === TileType.HISTORIC ? digit * 2 : digit);

/** A historic city's stored state: a barbarian city's, plus the UTC day its garrison is for. */
export interface HistoricState extends NpcState {
  day: number;
}

/**
 * A historic city as of `at`: its garrison and fortifications, refilling a little every second
 * (BALANCE.historic.refillShare of full each BALANCE.npcRegenMs), and changing at the start of each UTC day, when the
 * new day's garrison stands whole; its loot and loyalty regenerate like a level 10 barbarian city's (its loot is a
 * level 10's, as in Age 2), loyalty up to BALANCE.historic.loyalty. Nothing stored (a city never touched) is a fresh one.
 */
export function historicState(
  level: HistoricLevel,
  tileId: number,
  stored: { state: HistoricState; troops: TroopCounts; forts: FortCounts } | null,
  at: number,
): { state: HistoricState; troops: TroopCounts; forts: FortCounts } {
  const day = Math.floor(at / DAY);
  const full = historicGarrison(level, historicDay(tileId, day));
  if (!stored || stored.state.day !== day) {
    const base = freshNpcState(10, at);
    return {
      state: { ...base.state, loyalty: stored ? stored.state.loyalty : BALANCE.historic.loyalty, heroSeed: stored?.state.heroSeed, day },
      troops: full.troops,
      forts: full.forts,
    };
  }
  // loot and loyalty as a level 10's (regenerateNpc), with loyalty's own ceiling; troops and fortifications by the second
  const npc = regenerateNpc(10, stored.state, {}, {}, at);
  const tick = Math.max(1000, scaled(BALANCE.npcRegenMs));
  const from = stored.state.refillAt ?? stored.state.regenAt;
  const troops = refillCounts(stored.troops, full.troops, at - from, BALANCE.historic.refillShare, tick);
  const forts = refillCounts(stored.forts, full.forts, at - from, BALANCE.historic.refillShare, tick);
  const refillAt =
    nextRefillAt(stored.troops, troops, full.troops, from, at) === at || nextRefillAt(stored.forts, forts, full.forts, from, at) === at ? at : from;
  // a level 10's loyalty stops at its own ceiling: count the steps regenerateNpc took and add them up to ours
  const loyaltyTick = BALANCE.npcLoyaltyRegenRealTime ? BALANCE.npcRegenMs : tick;
  const steps = Math.round(((npc.state.loyaltyAt ?? at) - (stored.state.loyaltyAt ?? stored.state.regenAt)) / loyaltyTick);
  const loyalty = Math.min(BALANCE.historic.loyalty, stored.state.loyalty + steps);
  return { state: { ...npc.state, loyalty, refillAt, day }, troops, forts };
}

/**
 * Whether a target tile lies in a historic city's area of power (docs/reference/historic-cities.md, Holding one): 9
 * tiles every way for a level 12 (its 18 × 18 cell), 33 for a 14 (its 66-tile cell), its state for a 16, and the whole
 * map for Atlantis. The map wraps.
 */
export function inSeatArea(seatTileId: number, level: HistoricLevel, targetTileId: number, mapSize: number = BALANCE.mapSize): boolean {
  if (level === 18) return true;
  if (level === 16) return stateOf(seatTileId, mapSize) === stateOf(targetTileId, mapSize);
  const reach = level === 12 ? 9 : 33;
  const d = (a: number, b: number) => Math.min(Math.abs(a - b), mapSize - Math.abs(a - b));
  return d(seatTileId % mapSize, targetTileId % mapSize) <= reach && d(Math.floor(seatTileId / mapSize), Math.floor(targetTileId / mapSize)) <= reach;
}

/** What a draft takes from a barbarian city's troops: BALANCE.historic.draftShare of its largest troop type, or null if it has none. */
export function draftTake(troops: TroopCounts): { key: keyof TroopCounts; count: number } | null {
  let best: { key: keyof TroopCounts; count: number } | null = null;
  for (const [key, n] of Object.entries(troops) as [keyof TroopCounts, number][]) if (n > 0 && (!best || n > best.count)) best = { key, count: n };
  if (!best) return null;
  const count = Math.floor(best.count * BALANCE.historic.draftShare);
  return count > 0 ? { key: best.key, count } : null;
}

/** Drafts a seat has made on the UTC day of `now` (its count is for one day, `draftDay`). */
export const draftsUsed = (c: { draftDay: number; draftsUsed: number }, now: number) => (c.draftDay === Math.floor(now / DAY) ? c.draftsUsed : 0);

/**
 * When a seat drafting by itself next drafts, from `at`: the start of the next equal part of the UTC day
 * (BALANCE.historic.draftsPerDay parts). A seat captured or switched to drafting by itself partway through a part waits
 * for the next one, rather than making up the parts it wasn't drafting in.
 */
export const nextAutoDraftAt = (at: number) => {
  const part = DAY / BALANCE.historic.draftsPerDay;
  return (Math.floor(at / part) + 1) * part;
};

/**
 * A held historic city's loyalty as of `at`: rivals' wins take it down (BALANCE.historic.loyaltyPerWin), and it comes
 * back a point every BALANCE.npcRegenMs of real time since `from`, up to BALANCE.historic.loyalty.
 */
export function seatLoyalty(loyalty: number, from: number, at: number): { loyalty: number; loyaltyAt: number } {
  if (loyalty >= BALANCE.historic.loyalty) return { loyalty, loyaltyAt: Math.max(from, at) };
  const steps = Math.max(0, Math.floor((at - from) / BALANCE.npcRegenMs));
  return { loyalty: Math.min(BALANCE.historic.loyalty, loyalty + steps), loyaltyAt: from + steps * BALANCE.npcRegenMs };
}

/** The hero defending a historic city: level 100, with the level's Attack and Intelligence, the same for every visit. */
export function historicGuard(level: HistoricLevel, tileId: number) {
  const [power, stratagem] = historicHeroStats(level);
  const h = createGuardHero(100, seededRng(`historic-guard:${tileId}`), stateOf(tileId));
  return { ...h, level: 100, power, powerAdded: 0, powerBuffAdded: 0, stratagem, stratagemAdded: 0, stratagemBuffAdded: 0 };
}

/**
 * The gold a real hour a state's ruler gets from its barbarian cities, cut off from their faction: BALANCE.historic.
 * stateTribute.perMemberLevel for each level of each member (`groups`: the state's members by level).
 */
export const stateTribute = (groups: readonly { level: number; members: number }[]) =>
  groups.reduce((sum, g) => sum + g.level * g.members, 0) * BALANCE.historic.stateTribute.perMemberLevel;

/** Why a held historic city is restless: too few troops at home, or out of gold or food for its upkeep. */
export const SeatNeglect = { GARRISON: 'garrison', UPKEEP: 'upkeep' } as const;
export type SeatNeglect = (typeof SeatNeglect)[keyof typeof SeatNeglect];

/** What a held historic city lacks now (BALANCE.historic.unrest): troops at home below its garrison, and gold or food at 0. */
export function seatNeglect(level: HistoricLevel, city: { troops: TroopCounts; gold: number; food: number }): SeatNeglect[] {
  const home = Object.values(city.troops).reduce((sum, n) => sum + n, 0);
  const out: SeatNeglect[] = [];
  if (home < BALANCE.historic.unrest.garrison[level]) out.push(SeatNeglect.GARRISON);
  if (city.gold <= 0 || city.food <= 0) out.push(SeatNeglect.UPKEEP);
  return out;
}

/**
 * A held historic city's loyalty as of `at`, given what it lacked since `from`: neglected, it loses a point every
 * BALANCE.historic.unrest.msPerPoint for each thing it lacks and doesn't recover; otherwise it recovers (seatLoyalty).
 */
export function seatUnrest(loyalty: number, from: number, at: number, neglect: number): { loyalty: number; loyaltyAt: number } {
  if (neglect <= 0) return seatLoyalty(loyalty, from, at);
  const step = BALANCE.historic.unrest.msPerPoint / neglect;
  const lost = Math.min(loyalty, Math.max(0, Math.floor((at - from) / step)));
  return { loyalty: loyalty - lost, loyaltyAt: lost >= loyalty ? at : from + lost * step };
}
