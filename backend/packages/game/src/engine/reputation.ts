// (marchlands) Players' standing with the NPC factions (core reputation.ts has the rules): a faction_standing row per
// player and faction they've dealt with. A city trades with the factions through its home faction (the one holding its
// zone), at the spread the player's standing with it sets.

import { and, eq, inArray } from 'drizzle-orm';

import { BALANCE, changeStanding, FACTION_IDS, type FactionId, factionSpread, homeFaction, standingNow, tradeStanding } from '@marchlands/core';
import { cities, factionStanding } from '@marchlands/db';

import { type Ctx } from '#/context.ts';

type StandingRow = typeof factionStanding.$inferSelect;

/** A player's standing with every faction now. */
export async function standingsOf(ctx: Ctx, playerId: number): Promise<Record<FactionId, number>> {
  const rows = await ctx.tx.select().from(factionStanding).where(eq(factionStanding.playerId, playerId));
  const out = Object.fromEntries(FACTION_IDS.map((id) => [id, 0])) as Record<FactionId, number>;
  for (const r of rows) if (r.factionId in out) out[r.factionId as FactionId] = standingNow(r, ctx.now);
  return out;
}

async function lockedRow(ctx: Ctx, playerId: number, factionId: FactionId): Promise<StandingRow | undefined> {
  const [row] = await ctx.tx
    .select()
    .from(factionStanding)
    .where(and(eq(factionStanding.playerId, playerId), eq(factionStanding.factionId, factionId)))
    .for('update');
  return row;
}

async function saveRow(ctx: Ctx, row: StandingRow) {
  const { playerId: _p, factionId: _f, ...set } = row;
  await ctx.tx
    .insert(factionStanding)
    .values(row)
    .onConflictDoUpdate({ target: [factionStanding.playerId, factionStanding.factionId], set });
}

/** Moves a player's standing with a faction by `delta`; returns the new standing. */
export async function addStanding(ctx: Ctx, playerId: number, factionId: FactionId, delta: number): Promise<number> {
  const row = await lockedRow(ctx, playerId, factionId);
  const next = changeStanding(row, delta, ctx.now);
  await saveRow(ctx, { playerId, factionId, tradeDay: 0, tradeGained: 0, ...row, ...next });
  return next.value;
}

/** A player traded `gold` with the factions from a city on `tileId`: standing with its home faction rises, capped per game day. */
export async function tradedWithFactions(ctx: Ctx, playerId: number, tileId: number, gold: number) {
  const f = homeFaction(tileId);
  if (!f || gold <= 0) return;
  const row = await lockedRow(ctx, playerId, f.id);
  const gain = tradeStanding(gold, row ? { day: row.tradeDay, gained: row.tradeGained } : null, ctx.now);
  if (gain.points <= 0) return;
  await saveRow(ctx, { playerId, factionId: f.id, ...changeStanding(row, gain.points, ctx.now), tradeDay: gain.day, tradeGained: gain.gained });
}

/** Where a city trades with the factions: its home faction, its player's standing with it, and the spread it sets (null: they won't trade). */
export interface CityTerms {
  playerId: number;
  tileId: number;
  faction: FactionId | null;
  standing: number;
  spread: number | null;
}

/** The terms the factions trade on with each of these cities, by city id (cities of other players included). */
export async function cityTerms(ctx: Ctx, cityIds: readonly number[]): Promise<Map<number, CityTerms>> {
  const out = new Map<number, CityTerms>();
  if (!cityIds.length) return out;
  const cs = await ctx.tx
    .select({ id: cities.id, playerId: cities.playerId, tileId: cities.tileId })
    .from(cities)
    .where(inArray(cities.id, [...new Set(cityIds)]));
  const rows = await ctx.tx
    .select()
    .from(factionStanding)
    .where(
      inArray(
        factionStanding.playerId,
        cs.map((c) => c.playerId),
      ),
    );
  for (const c of cs) {
    const f = homeFaction(c.tileId);
    const row = f ? rows.find((r) => r.playerId === c.playerId && r.factionId === f.id) : undefined;
    const standing = standingNow(row, ctx.now);
    // a tile outside every zone (none today) trades at the base spread
    out.set(c.id, {
      playerId: c.playerId,
      tileId: c.tileId,
      faction: f?.id ?? null,
      standing,
      spread: f ? factionSpread(standing) : BALANCE.npcTrade.playerSpread,
    });
  }
  return out;
}
