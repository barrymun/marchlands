// (marchlands) Standing with the NPC factions (docs/features/market-and-factions.md, Reputation's rules). Each player
// has a standing with each faction, from -max to max, that drifts back to 0; the drift is worked out when read, so only
// the value and when it was set are stored. A city trades with the factions through the faction holding its zone (its
// home faction), at a spread set by the player's standing with it, or not at all once that standing is low enough.
// Attacking a member lowers standing with its faction; a won attack on a bandit camp and trading with the factions raise
// it. Numbers in BALANCE.reputation, game time.

import { BALANCE, getGameSpeed } from '#/balance.ts';
import { type Faction, factionOfZone, factionRivals, isFactionLevel, npcFaction, stateFaction } from '#/factions.ts';
import { DAY } from '#/time.ts';
import { stateOf } from '#/world.ts';

const cfg = () => BALANCE.reputation;

/** A stored standing: its value when last set, and when that was (real ms). */
export interface Standing {
  value: number;
  at: number;
}

/** A standing's band, as players see it: hostile ones won't trade. */
export const StandingTier = {
  HOSTILE: 'hostile',
  UNFRIENDLY: 'unfriendly',
  NEUTRAL: 'neutral',
  FRIENDLY: 'friendly',
  HONOURED: 'honoured',
} as const;
export type StandingTier = (typeof StandingTier)[keyof typeof StandingTier];
export const STANDING_TIERS = Object.values(StandingTier) as [StandingTier, ...StandingTier[]];

/** A stored standing at `now` (real ms), faded towards 0 for the game time since it was set; 0 when there is none. */
export function standingNow(s: Standing | undefined, now: number): number {
  if (!s) return 0;
  const gameMs = Math.max(0, now - s.at) * getGameSpeed();
  return s.value * 0.5 ** (gameMs / cfg().driftHalfLifeMs);
}

/** A standing moved by `delta` at `now`, within ±max. */
export function changeStanding(s: Standing | undefined, delta: number, now: number): Standing {
  const { max } = cfg();
  return { value: Math.min(max, Math.max(-max, standingNow(s, now) + delta)), at: now };
}

/**
 * The factions' spread for a city whose player has this standing with its home faction: the base spread
 * (BALANCE.npcTrade.playerSpread) at 0, narrowing to `spread.best` at max and widening to `spread.worst` at
 * `refuseBelow`; null at or below it, when they won't trade.
 */
export function factionSpread(standing: number): number | null {
  const { max, refuseBelow, spread } = cfg();
  if (standing <= refuseBelow) return null;
  const base = BALANCE.npcTrade.playerSpread;
  const t = standing >= 0 ? Math.min(1, standing / max) : standing / refuseBelow;
  return base + ((standing >= 0 ? spread.best : spread.worst) - base) * t;
}

/** The band a standing falls in. */
export function standingTier(standing: number): StandingTier {
  const { refuseBelow, tiers } = cfg();
  if (standing <= refuseBelow) return StandingTier.HOSTILE;
  if (standing < tiers.unfriendly) return StandingTier.UNFRIENDLY;
  if (standing <= tiers.friendly) return StandingTier.NEUTRAL;
  if (standing < tiers.honoured) return StandingTier.FRIENDLY;
  return StandingTier.HONOURED;
}

/** The faction a city on this tile trades with the factions through: the one holding its zone. */
export const homeFaction = (tileId: number): Faction | null => factionOfZone(stateOf(tileId));

/**
 * What an attack on a barbarian city of `level` on this tile does to standing: a member's faction loses standing for
 * any attack (more when it's captured); a bandit camp's land's faction gains a little when the attack is won. Null when
 * nothing changes.
 */
export function attackStanding(
  tileId: number,
  level: number,
  won: boolean,
  captured: boolean,
  ruled?: ReadonlySet<number>,
): { faction: Faction; change: number } | null {
  const { attackPerLevel, capture, banditPerLevel } = cfg();
  const f = stateFaction(stateOf(tileId), ruled);
  if (!f) return null;
  if (isFactionLevel(level)) return { faction: f, change: -(attackPerLevel * level + (captured ? capture : 0)) };
  return won ? { faction: f, change: banditPerLevel * level } : null;
}

/** A change of standing with one faction. */
export interface StandingChange {
  faction: Faction;
  change: number;
}

/**
 * What an attack on an unheld historic city of `level` on this tile does to standing (BALANCE.reputation.seat): the
 * faction whose state it stands in loses standing for any attack, more when it's captured, and on a capture its rivals
 * gain a share of that. Null off any faction's land, or in a state a player rules (`ruled`).
 */
export function seatStanding(
  tileId: number,
  level: 12 | 14 | 16 | 18,
  captured: boolean,
  ruled?: ReadonlySet<number>,
): { own: StandingChange; rivals: StandingChange[] } | null {
  const { attackPerLevel, capture, seat } = cfg();
  const f = stateFaction(stateOf(tileId), ruled);
  if (!f) return null;
  const captureCost = captured ? capture * seat.captureFactor[level] : 0;
  const rivals = captured ? factionRivals(f.id).map((r) => ({ faction: r, change: captureCost * seat.rivalShare })) : [];
  return { own: { faction: f, change: -(attackPerLevel * level + captureCost) }, rivals };
}

/** What drafting from a barbarian city of `level` on this tile costs: standing with its faction, none for a bandit camp. */
export function draftStanding(tileId: number, level: number, ruled?: ReadonlySet<number>): StandingChange | null {
  const f = npcFaction(tileId, level, ruled);
  return f ? { faction: f, change: -cfg().seat.draft } : null;
}

/** The game day `now` (real ms) falls in, for the daily cap on standing from trade. */
export const gameDay = (now: number) => Math.floor((now * getGameSpeed()) / DAY);

/**
 * Standing gained by trading `gold` with the factions at `now`, given what trade last gained (`sofar`: on which game
 * day, and how much): one point per BALANCE.reputation.trade.goldPerPoint, at most maxPerDay a game day. Returns the
 * points and the day's new total.
 */
export function tradeStanding(gold: number, sofar: { day: number; gained: number } | null, now: number) {
  const { goldPerPoint, maxPerDay } = cfg().trade;
  const day = gameDay(now);
  const before = sofar?.day === day ? sofar.gained : 0;
  const points = Math.max(0, Math.min(gold / goldPerPoint, maxPerDay - before));
  return { points, day, gained: before + points };
}
