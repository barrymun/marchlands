// Player-facing building descriptions. Each effect mirrors the rule that uses the building
// (economy, construction, training, heroes, armies, market, alliance), with numbers from BALANCE,
// so the text follows the rules. "Unlocks" is derived from the requirement data.

import { BALANCE, getGameSpeed } from './balance.ts';
import { BUILDING_NAMES, BuildingType, TECH_NAMES, TROOP_NAMES } from './constants.ts';
import { BUILDINGS, RESEARCH, TROOPS, buildingConfig } from './data/index.ts';
import { reliefMultiplier } from './troops.ts';

const fmt = (n: number) => n.toLocaleString('en');
const F = (l: number) => BALANCE.fieldFactor[l] ?? 0;

interface BuildingText {
  summary: string;
  /** what the building gives at `level` (level > 0) */
  effect?: (level: number) => string;
}

const field = (res: string): BuildingText => ({
  summary: `Produces ${res} and adds ${res} storage. Output and storage grow faster at higher levels; it needs workers from your idle population.`,
  effect: (l) =>
    `${fmt(BALANCE.fieldProductionPerF * F(l) * getGameSpeed())} ${res}/h at full labour, +${fmt(BALANCE.fieldStoragePerF * F(l))} storage, employs ${fmt(BALANCE.fieldWorkersPerF * F(l))} workers`,
});

const TEXT: Record<number, BuildingText> = {
  [BuildingType.TOWN_HALL]: {
    summary: `The heart of the city. Each level unlocks 3 more field slots outside the walls (from 10) and lets the city hold one more valley. Beginner protection ends at level ${BALANCE.beginnerTownHallLevel}. It cannot be demolished.`,
    effect: (l) => `${10 + 3 * l} field slots, up to ${l} valley${l === 1 ? '' : 's'}`,
  },
  [BuildingType.WALLS]: {
    summary:
      "Defends the city. Holds fortifications (traps, abatis, archer's towers, rolling logs, trebuchets) and builds them in a queue of one batch per level. In battle the walls absorb damage and extend the range of archer's towers.",
    effect: (l) => `${fmt(BALANCE.wallSpace[l] ?? 0)} fortification space, ${l} queued batch${l === 1 ? '' : 'es'}, ${fmt(50_000 * l * (l + 1))} wall hit points, +${Math.round(l * 4.5 * 10) / 10}% tower range`,
  },
  [BuildingType.COTTAGE]: {
    summary: 'Houses people: raises the city\'s population limit. Population works the fields, pays tax and is spent to train troops.',
    effect: (l) => `+${fmt(BALANCE.cottagePopulation[l] ?? 0)} population`,
  },
  [BuildingType.FARM]: field('food'),
  [BuildingType.SAWMILL]: field('lumber'),
  [BuildingType.QUARRY]: field('stone'),
  [BuildingType.IRONMINE]: field('iron'),
  [BuildingType.WAREHOUSE]: {
    summary: 'Hides resources from plunder. Each resource is protected up to the warehouse amount times the share you set for it (store percent).',
    effect: (l) => `protects up to ${fmt(BALANCE.warehouseProtectPerLevel[l] ?? 0)} of each resource`,
  },
  [BuildingType.BARRACKS]: {
    summary: 'Trains troops. Each barracks has its own queue of one batch per level, and several barracks train in parallel.',
    effect: (l) => `${l} queued batch${l === 1 ? '' : 'es'}`,
  },
  [BuildingType.ACADEMY]: {
    summary: `Researches technologies, up to ${BALANCE.researchQueues} at a time. A technology only counts up to the Academy level in this city.`,
    effect: (l) => `technologies count up to level ${l}`,
  },
  [BuildingType.INN]: {
    summary: `Offers heroes for hire. Higher levels offer more and stronger heroes; new offers cost ${fmt(BALANCE.tavernRefreshGoldPerInnLevel)} gold per level.`,
    effect: (l) => `${Math.min(10, l)} hero offer${l === 1 ? '' : 's'}, heroes up to level ${5 * l}`,
  },
  [BuildingType.FEASTING_HALL]: {
    summary: 'Houses heroes: one hero (hired or captured) per level.',
    effect: (l) => `${l} hero slot${l === 1 ? '' : 's'}`,
  },
  [BuildingType.RALLY_SPOT]: {
    summary: 'Sends armies out. Needed to march at all; each level allows one more army away at a time.',
    effect: (l) => `${l * BALANCE.rallySpotArmiesPerLevel} arm${l * BALANCE.rallySpotArmiesPerLevel === 1 ? 'y' : 'ies'} out at once`,
  },
  [BuildingType.MARKETPLACE]: {
    summary: `Trades food, lumber, stone and iron for gold with other lords and the merchant. Each level allows ${BALANCE.marketMaxOrdersPerLevel} more waiting orders.`,
    effect: (l) => `${l * BALANCE.marketMaxOrdersPerLevel} waiting orders`,
  },
  [BuildingType.RELIEF_STATION]: {
    summary: 'Speeds up armies (transports and reinforcements) marching between your own cities.',
    effect: (l) => `marches between your cities ×${reliefMultiplier([{ positionId: 0, typeId: BuildingType.RELIEF_STATION, level: l, status: 0, startTime: 0, endTime: 0 }])} faster`,
  },
  [BuildingType.BEACON_TOWER]: {
    summary: 'Watches for enemies: level 1 shows the troops of hostile armies marching on you, level 2 also their hero.',
    effect: (l) => (l >= 2 ? 'see incoming troops and heroes' : 'see incoming troops'),
  },
  [BuildingType.EMBASSY]: { summary: 'Needed to join an alliance (accept an invitation or apply).' },
  [BuildingType.STABLE]: { summary: 'A prerequisite for what it unlocks below; no other effect on this server yet.' },
  [BuildingType.FORGE]: { summary: 'A prerequisite for what it unlocks below; no other effect on this server yet.' },
  [BuildingType.WORKSHOP]: { summary: 'A prerequisite for what it unlocks below; no other effect on this server yet.' },
};

export interface BuildingInfo {
  typeId: number;
  name: string;
  summary: string;
  /** where it can be built and how many */
  placement: string;
  /** buildings, troops and technologies that require this building, with the level they need */
  unlocks: { kind: 'building' | 'troop' | 'tech'; name: string; level: number }[];
}

function unlocksOf(typeId: number): BuildingInfo['unlocks'] {
  const out = new Map<string, BuildingInfo['unlocks'][number]>();
  const add = (kind: 'building' | 'troop' | 'tech', name: string | undefined, level: number) => {
    if (!name) return;
    const key = `${kind}:${name}`;
    const prev = out.get(key);
    if (!prev || level < prev.level) out.set(key, { kind, name, level });
  };
  for (const b of BUILDINGS) for (const r of b.requires.buildings) if (r.id === typeId && b.typeId !== typeId && b.level === 1) add('building', BUILDING_NAMES[b.typeId], r.level);
  for (const t of TROOPS) for (const r of t.requires.buildings) if (r.id === typeId) add('troop', TROOP_NAMES[t.troopId], r.level);
  for (const t of RESEARCH) for (const r of t.requires.buildings) if (r.id === typeId && t.level === 1) add('tech', TECH_NAMES[t.techId], r.level);
  return [...out.values()].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}

function placementOf(typeId: number): string {
  if (typeId === BuildingType.TOWN_HALL || typeId === BuildingType.WALLS) return 'One per city, in its own slot.';
  const cfg = buildingConfig(typeId, 1);
  if (!cfg) return '';
  const fields: number[] = [BuildingType.FARM, BuildingType.SAWMILL, BuildingType.QUARRY, BuildingType.IRONMINE];
  const where = fields.includes(typeId) ? 'Outside the walls (field slots)' : 'Inside the walls';
  return cfg.limit > 0 ? `${where}; at most ${cfg.limit} per city.` : `${where}; as many as you like.`;
}

export function buildingInfo(typeId: number): BuildingInfo {
  return {
    typeId,
    name: BUILDING_NAMES[typeId] ?? `Building ${typeId}`,
    summary: TEXT[typeId]?.summary ?? '',
    placement: placementOf(typeId),
    unlocks: unlocksOf(typeId),
  };
}

/** What a building gives at `level` ('' when it has no measurable effect). */
export function buildingEffect(typeId: number, level: number): string {
  if (level <= 0) return '';
  return TEXT[typeId]?.effect?.(level) ?? '';
}
