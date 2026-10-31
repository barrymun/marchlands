// (marchlands) NPC factions: five blocks of neighbouring zones (docs/features/market-and-factions.md, Factions).
// Membership is worked out, never stored: an NPC city at BALANCE.factions.minLevel or above belongs to the faction
// holding its zone; lower ones are unaligned bandits. The zones are alike, so each faction's character (the
// resources it is strong in and short of, its temperament) is designed here. Display names live in the client's
// data-factions namespace, keyed by FactionId.

import { BALANCE } from '#/balance.ts';
import { FactionId, type ResourceKey } from '#/constants.ts';
import { stateOf } from '#/world.ts';

/** How a faction behaves towards others: trade, war, or neither. */
export const FactionTemperament = {
  TRADING: 'trading',
  WARLIKE: 'warlike',
  INSULAR: 'insular',
} as const;
export type FactionTemperament = (typeof FactionTemperament)[keyof typeof FactionTemperament];

export interface Faction {
  id: FactionId;
  /** the zones it holds (stateOf), as BALANCE.stateGrid lays them out: 0 Friesland in the north-west … 15 Romagna */
  zones: readonly number[];
  /** what it has plenty of, and sells */
  strong: readonly ResourceKey[];
  /** what it runs short of, and buys */
  short: readonly ResourceKey[];
  temperament: FactionTemperament;
}

export const FACTIONS: readonly Faction[] = [
  // the north: Friesland, Saxony, North March
  { id: FactionId.SAXON_LEAGUE, zones: [0, 1, 2], strong: ['wood'], short: ['stone'], temperament: FactionTemperament.TRADING },
  // the west: Lower Lorraine, Upper Lorraine, Burgundy
  { id: FactionId.LOTHARINGIAN_CROWN, zones: [4, 8, 12], strong: ['stone'], short: ['food'], temperament: FactionTemperament.INSULAR },
  // the centre, bordering every other faction: Franconia, Thuringia, Swabia, Bavaria
  { id: FactionId.FRANCONIAN_HEARTLAND, zones: [5, 6, 9, 10], strong: ['food'], short: ['wood'], temperament: FactionTemperament.TRADING },
  // the east: Bohemia, Moravia, Carinthia
  { id: FactionId.BOHEMIAN_CROWN, zones: [3, 7, 11], strong: ['iron', 'stone'], short: ['food'], temperament: FactionTemperament.WARLIKE },
  // the south: Lombardy, Tuscany, Romagna
  { id: FactionId.ITALIAN_LEAGUE, zones: [13, 14, 15], strong: ['food', 'gold'], short: ['iron'], temperament: FactionTemperament.TRADING },
];

const BY_ZONE = new Map(FACTIONS.flatMap((f) => f.zones.map((z) => [z, f] as const)));
const BY_ID = new Map(FACTIONS.map((f) => [f.id, f] as const));

/** The faction holding a zone; null for a number that is no zone. */
export const factionOfZone = (zone: number): Faction | null => BY_ZONE.get(zone) ?? null;

/** A faction by id (every FactionId has one). */
export function faction(id: FactionId): Faction {
  const f = BY_ID.get(id);
  if (!f) throw new Error(`no faction ${id}`);
  return f;
}

/** Whether an NPC city of this level belongs to a faction (from BALANCE.factions.minLevel), rather than being a bandit. */
export const isFactionLevel = (level: number) => level >= BALANCE.factions.minLevel;

/** The faction an NPC city on this tile belongs to, or null for a bandit below BALANCE.factions.minLevel. */
export const npcFaction = (tileId: number, level: number): Faction | null => (isFactionLevel(level) ? factionOfZone(stateOf(tileId)) : null);
