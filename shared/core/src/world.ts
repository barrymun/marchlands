// World map: states, procedural generation, NPC (barbarian) cities and valley garrisons.
// Port of Map.cpp / NpcCity.cpp / Valley.cpp.

import { BALANCE, scaled } from '#/balance.ts';
import { BASIC_RESOURCES, BuildingStatus, Relation, RESOURCE_KEYS, TileType, TROOP_ID_BY_KEY } from '#/constants.ts';
import { randInt, type Rng, seededRng } from '#/rng.ts';
import { unitExp } from '#/troops.ts';
import { type BuildingState, type FortCounts, type ResourceSet, type TroopCounts } from '#/types.ts';

export function stateOf(tileId: number, mapSize: number = BALANCE.mapSize): number {
  const x = tileId % mapSize;
  const y = Math.floor(tileId / mapSize);
  const cell = mapSize / BALANCE.stateGrid;
  return Math.floor(y / cell) * BALANCE.stateGrid + Math.floor(x / cell);
}

/** Inclusive tile-coordinate bounds of a state. */
export function stateBounds(state: number, mapSize: number = BALANCE.mapSize) {
  const cell = mapSize / BALANCE.stateGrid;
  const col = state % BALANCE.stateGrid;
  const row = Math.floor(state / BALANCE.stateGrid);
  return { x1: col * cell, x2: (col + 1) * cell - 1, y1: row * cell, y2: (row + 1) * cell - 1 };
}

// ---------------------------------------------------------------------------------------------
// Procedural generation
// ---------------------------------------------------------------------------------------------

export interface GeneratedTile {
  type: number;
  level: number;
}

/**
 * Deterministic map: smooth value-noise biomes for valleys, scattered flats (city sites) and
 * barbarian cities. Roughly 35% flats, 57% valleys, 8% NPC cities; low levels are more common.
 */
export function generateMap(seed: string, mapSize: number = BALANCE.mapSize): Uint8Array {
  const out = new Uint8Array(mapSize * mapSize * 2);
  const rng = seededRng(seed);
  const grid = 12; // noise cell size in tiles
  const gw = Math.ceil(mapSize / grid) + 2;
  const noise = new Float64Array(gw * gw);
  for (let i = 0; i < noise.length; i++) noise[i] = rng.next();
  const sample = (x: number, y: number) => {
    const gx = x / grid;
    const gy = y / grid;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const tx = gx - x0;
    const ty = gy - y0;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    // the grid has a cell to spare on every side, so a neighbour is always there
    const n = (a: number, b: number) => noise[b * gw + a] ?? 0;
    const top = n(x0, y0) * (1 - sx) + n(x0 + 1, y0) * sx;
    const bot = n(x0, y0 + 1) * (1 - sx) + n(x0 + 1, y0 + 1) * sx;
    return top * (1 - sy) + bot * sy;
  };
  const valleys = [TileType.FOREST, TileType.DESERT, TileType.HILL, TileType.SWAMP, TileType.GRASS, TileType.LAKE];
  const level = () => {
    // weight 11-l: level 1 is ten times as common as level 10
    let r = randInt(rng, 1, 55);
    for (let l = 1; l <= 10; l++) {
      r -= 11 - l;
      if (r <= 0) return l;
    }
    return 1;
  };
  for (let y = 0; y < mapSize; y++) {
    for (let x = 0; x < mapSize; x++) {
      const i = (y * mapSize + x) * 2;
      const roll = rng.next();
      let type: number;
      if (roll < 0.08) type = TileType.NPC;
      else if (roll < 0.43) type = TileType.FLAT;
      else {
        const v = Math.min(0.9999, sample(x, y));
        type = valleys[Math.floor(v * valleys.length)] ?? TileType.FLAT; // v < 1: always one of them
      }
      out[i] = type;
      out[i + 1] = level();
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// NPC cities (orig NpcCity::Initialize table)
// ---------------------------------------------------------------------------------------------

export interface NpcTemplate {
  resources: ResourceSet;
  troops: TroopCounts;
  forts: FortCounts;
  population: number;
  loyalty: number;
}

type NpcRow = [number, number, number, number, number, number, number, number, number, number, number, number, number];
const NPC_TABLE: readonly [NpcRow, ...NpcRow[]] = [
  // gold, food, wsi, warrior, pike, sword, archer, cavalry, traps, abatis, towers, logs, trebs
  [55000, 100000, 20000, 50, 40, 30, 10, 8, 1000, 0, 0, 0, 0],
  [65000, 200000, 30000, 50, 45, 40, 30, 25, 1850, 550, 0, 0, 0],
  [75000, 900000, 75000, 200, 160, 65, 40, 60, 2000, 1000, 650, 0, 0],
  [300000, 1600000, 120000, 400, 400, 100, 100, 150, 4500, 1875, 550, 0, 0],
  [450000, 3000000, 180000, 750, 1000, 350, 250, 200, 3750, 1875, 1250, 750, 0],
  [600000, 4000000, 200000, 4000, 1750, 550, 500, 450, 4250, 1500, 1500, 950, 400],
  [800000, 4500000, 500000, 12000, 3000, 750, 800, 750, 5600, 2800, 1850, 1100, 700],
  [1000000, 8000000, 800000, 15000, 6750, 4000, 3000, 2000, 7200, 3600, 2400, 1440, 900],
  [1200000, 14000000, 550000, 60000, 18000, 2000, 6750, 2500, 9000, 4500, 3000, 1800, 1125],
  [1500000, 19000000, 600000, 400000, 0, 0, 0, 0, 11000, 5500, 3666, 2200, 1375],
];
const NPC_POPULATION: readonly [number, ...number[]] = [1000, 4000, 8000, 16000, 25000, 33000, 38000, 58000, 68000, 78000];

/**
 * (marchlands) An NPC city's gold as the original table has it (55,000 at level 1 to 1,500,000 at level 10), whatever
 * BALANCE.npcGoldMatchesTopResource makes it hold for plunder: what a faction member brings to its faction's treasury
 * (npc-economy.ts).
 */
export function npcTableGold(level: number): number {
  const l = Math.min(10, Math.max(1, level));
  // l is clamped to the table's 10 levels
  return (NPC_TABLE[l - 1] ?? NPC_TABLE[0])[0];
}

export function npcTemplate(level: number): NpcTemplate {
  const l = Math.min(10, Math.max(1, level));
  // l is clamped to the table's 10 levels
  const [gold, food, wsi, warrior, pike, sword, archer, cav, traps, abatis, towers, logs, trebs] = NPC_TABLE[l - 1] ?? NPC_TABLE[0];
  return {
    resources: { gold: BALANCE.npcGoldMatchesTopResource ? Math.max(food, wsi) : gold, food, wood: wsi, stone: wsi, iron: wsi },
    troops: { militia: warrior, pikemen: pike, swordsmen: sword, archer, lightCavalry: cav },
    forts: { trap: traps, abatis, arrowTower: towers, rollingLogs: logs, rockfall: trebs },
    population: NPC_POPULATION[l - 1] ?? NPC_POPULATION[0],
    loyalty: l > 2 ? BALANCE.npcLoyaltyStart.high : BALANCE.npcLoyaltyStart.low,
  };
}

/** Persisted NPC state (tiles.state). */
export interface NpcState {
  gold: number;
  food: number;
  wood: number;
  stone: number;
  iron: number;
  loyalty: number;
  population: number;
  /** last regeneration boundary (resources) */
  regenAt: number;
  /** (marchlands) when the troops and fortifications last caught up (they refill by the second); regenAt until set */
  refillAt?: number;
  /** last loyalty regeneration boundary (real time, see BALANCE.npcLoyaltyRegenRealTime) */
  loyaltyAt?: number;
  /** seed of the defending hero, so every scout and attack meets the same one (combat.ts guardHeroOf) */
  heroSeed?: number;
}

export function freshNpcState(level: number, now: number): { state: NpcState; troops: TroopCounts; forts: FortCounts } {
  const t = npcTemplate(level);
  return {
    state: { ...t.resources, loyalty: t.loyalty, population: t.population, regenAt: now, loyaltyAt: now, refillAt: now },
    troops: { ...t.troops },
    forts: { ...t.forts },
  };
}

/**
 * (marchlands) Counts (troops, fortifications) caught up towards `full`: `share` of each full count for every `periodMs`
 * that passed in `elapsedMs`, a little every second rather than in steps (deviations.md), whole units only and never
 * past full. Types in `full` the counts lack start from 0.
 */
export function refillCounts<K extends string>(
  current: Partial<Record<K, number>>,
  full: Partial<Record<K, number>>,
  elapsedMs: number,
  share: number,
  periodMs: number,
): Partial<Record<K, number>> {
  const out = { ...current };
  const k = (share * Math.max(0, elapsedMs)) / periodMs;
  for (const [key, max] of Object.entries(full) as [K, number][]) out[key] = Math.min(max, (current[key] ?? 0) + Math.floor(max * k));
  return out;
}

/** Whether any count differs between two sets of counts (a missing count is 0). */
export const countsDiffer = (a: Partial<Record<string, number>>, b: Partial<Record<string, number>>) =>
  Object.keys({ ...a, ...b }).some((k) => (a[k] ?? 0) !== (b[k] ?? 0));

/**
 * When the refill clock stands after catching `before` up to `after` (refillCounts) at `now`: it moves on to `now` once
 * something came back, or when there's nothing to refill (so the next loss counts from now, not from long ago); while
 * less than a unit has come back it stays, so frequent touches don't lose the fraction.
 * @internal
 */
export function nextRefillAt(
  before: Partial<Record<string, number>>,
  after: Partial<Record<string, number>>,
  full: Partial<Record<string, number>>,
  from: number,
  now: number,
) {
  return countsDiffer(before, after) || !countsDiffer(after, full) ? Math.max(from, now) : from;
}

/**
 * Lazily apply NPC regeneration (orig every 6 min: food/wood/stone/iron +max/80, troops and forts +max/10, loyalty
 * +1; gold does not regenerate unless BALANCE.npcGoldMatchesTopResource). Loyalty can run on real time instead
 * (BALANCE.npcLoyaltyRegenRealTime), so a faster game does not undo attacks faster. (marchlands) Troops and
 * fortifications come back by the second at the same rate (refillCounts), from `refillAt`; resources and loyalty keep
 * their steps.
 */
export function regenerateNpc(level: number, state: NpcState, troops: TroopCounts, forts: FortCounts, now: number) {
  const t = npcTemplate(level);
  const tick = Math.max(1000, scaled(BALANCE.npcRegenMs));
  const ticks = Math.max(0, Math.floor((now - state.regenAt) / tick));
  // loyalty recovers +1 per npcRegenMs of real time (unaffected by GAME_SPEED) when npcLoyaltyRegenRealTime is on
  const loyaltyTick = BALANCE.npcLoyaltyRegenRealTime ? BALANCE.npcRegenMs : tick;
  const loyaltyFrom = state.loyaltyAt ?? state.regenAt;
  const loyaltyTicks = Math.max(0, Math.floor((now - loyaltyFrom) / loyaltyTick));
  const refillFrom = state.refillAt ?? state.regenAt;
  const tr = refillCounts(troops, t.troops, now - refillFrom, 0.1, tick);
  const fo = refillCounts(forts, t.forts, now - refillFrom, 0.1, tick);
  const refillAt = nextRefillAt(troops, tr, t.troops, refillFrom, now) === now || nextRefillAt(forts, fo, t.forts, refillFrom, now) === now ? now : refillFrom;
  if (ticks <= 0 && loyaltyTicks <= 0 && refillAt === refillFrom) return { state, troops, forts };
  const s = { ...state, regenAt: state.regenAt + ticks * tick, loyaltyAt: loyaltyFrom + loyaltyTicks * loyaltyTick, refillAt };
  s.loyalty = Math.min(t.loyalty, s.loyalty + loyaltyTicks);
  const regen = BALANCE.npcGoldMatchesTopResource ? RESOURCE_KEYS : BASIC_RESOURCES;
  for (const r of regen) s[r] = Math.min(t.resources[r], s[r] + (t.resources[r] / 80) * ticks);
  return { state: s, troops: tr, forts: fo };
}

/** NPC building layout (orig NpcCity::SetupBuildings), for scout reports. */
export function npcBuildings(level: number): { typeId: number; levels: number[] }[] {
  const fields = 10 + 3 * (level - 1);
  return [
    { typeId: 1, levels: Array<number>(20).fill(level) },
    { typeId: 2, levels: [level] },
    { typeId: 4, levels: [level] },
    { typeId: 5, levels: [level] },
    { typeId: 6, levels: [level] },
    { typeId: 7, levels: Array<number>(fields).fill(level) },
    ...[20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30].map((typeId) => ({ typeId, levels: [level] })),
  ];
}

// ---------------------------------------------------------------------------------------------
// Valley garrisons (orig ValleyData::Reset)
// ---------------------------------------------------------------------------------------------

export function valleyGarrison(level: number, rng: Rng): TroopCounts {
  const candidates: (keyof TroopCounts)[] = [];
  const consider = (k: keyof TroopCounts, allowed: boolean) => {
    if (allowed && randInt(rng, 0, 2) > 0) candidates.push(k);
  };
  consider('militia', true);
  consider('pikemen', true);
  consider('swordsmen', level > 2);
  consider('archer', level > 4);
  consider('lightCavalry', level > 6);
  if (candidates.length === 0) candidates.push('militia');
  const x = Math.pow(2, level - 1) * 10_000;
  const total = Math.floor((x + randInt(rng, 0, x - 1)) / candidates.length);
  const troops: TroopCounts = {};
  for (const k of candidates) troops[k] = Math.ceil(total / unitExp(TROOP_ID_BY_KEY[k]));
  return troops;
}

/** NPC building layout (orig NpcCity::SetupBuildings) as real buildings of a captured city. */
export function npcCityBuildings(level: number): BuildingState[] {
  const b = (positionId: number, typeId: number): BuildingState => ({ positionId, typeId, level, status: BuildingStatus.IDLE, startTime: 0, endTime: 0 });
  const out = [b(-1, 31), b(-2, 32)];
  [25, 22, 28, 27, 23, 30, 20, 21, 29, 24, 26, 2].forEach((t, i) => out.push(b(i, t)));
  for (let p = 12; p <= 31; p++) out.push(b(p, 1));
  const fields = Math.min(37, 10 + 3 * (level - 1));
  for (let i = 0; i < fields; i++) out.push(b(1001 + i, 7));
  out.push(b(1001 + fields, 4), b(1002 + fields, 5), b(1003 + fields, 6));
  return out;
}

/** Interaction permissions by relation (orig GetMapCastle intended mapping). */
export function relationPermissions(relation: number) {
  if (relation === Relation.SELF || relation === Relation.ALLY || relation === Relation.ALLIANCE) {
    return { canLoot: false, canOccupy: false, canScout: false, canSend: true, canTrans: true };
  }
  if (relation === Relation.ENEMY) return { canLoot: true, canOccupy: true, canScout: true, canSend: true, canTrans: true };
  return { canLoot: true, canOccupy: true, canScout: true, canSend: false, canTrans: false };
}

/** The widest map view (tiles per side) a client may ask for. */
export const MAP_VIEW_MAX = 21;
