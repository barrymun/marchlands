// Helpers for the flow tests (test/services/flows/, test/engine/flows/).

import { and, desc, eq, gt, inArray, isNull } from 'drizzle-orm';
import { vi } from 'vitest';
import { BuildingType, healCost, Mission, msg, ref, tileId, TileType, tileXY, type TroopCounts, VALLEY_TYPES } from '@marchlands/core';
import type { PushCmd, PushData } from '@marchlands/contracts';
import { pushMessages, tiles, timedEvents, type Db } from '@marchlands/db';
import { armies, flows, player as players } from '#/index.ts';
import { getCity, saveCity } from '#/repo.ts';
import { addHero, setBuildings, setCityStats, type TestPlayer } from '#test/support/factories.ts';
import type { TestGame } from '#test/support/game.ts';

export type FlowInput = { id?: string | null; name: string; actions: unknown[]; cities?: 'all' | number[] };

/** Save a new flow and return it as listed. */
export async function newFlow(g: TestGame, p: TestPlayer, input: FlowInput) {
  const before = new Set((await flows.listFlows(g, p.id)).map((f) => f.id));
  const list = await flows.saveFlow(g, p.id, input);
  const f = list.find((x) => !before.has(x.id));
  if (!f) throw new Error('newFlow: no flow was added');
  return f;
}

/** A flow as stored now. */
export async function flowOf(g: TestGame, p: TestPlayer, flowId: string) {
  const f = (await flows.listFlows(g, p.id)).find((x) => x.id === flowId);
  if (!f) throw new Error(`flowOf: no flow ${flowId}`);
  return f;
}

/**
 * Call runFlow (which opens its own transactions on a Db) inside the test's transaction: its transactions become
 * savepoints, its clock is the test's, and the pushes and timed events it commits are moved back into the test
 * (g.pushes(), g.events(), g.runDue()).
 */
export async function runFlowIn(g: TestGame, p: TestPlayer, flowId: string, cityIds?: 'all' | number[], preview = false) {
  const [lastPush] = await g.tx.select({ id: pushMessages.id }).from(pushMessages).orderBy(desc(pushMessages.id)).limit(1);
  const [lastEvent] = await g.tx.select({ id: timedEvents.id }).from(timedEvents).orderBy(desc(timedEvents.id)).limit(1);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(g.now);
  try {
    return await flows.runFlow(g.tx as unknown as Db, p.id, flowId, cityIds, preview);
  } finally {
    vi.useRealTimers();
    const pushed = await g.tx
      .select()
      .from(pushMessages)
      .where(gt(pushMessages.id, lastPush?.id ?? 0))
      .orderBy(pushMessages.id);
    for (const r of pushed) g._pushes.push({ playerIds: r.playerIds, cmd: r.cmd as PushCmd, data: r.data as PushData<PushCmd> });
    const events = await g.tx
      .delete(timedEvents)
      .where(gt(timedEvents.id, lastEvent?.id ?? 0))
      .returning();
    for (const e of events) g.schedule({ type: e.type, dueAt: e.dueAt, playerId: e.playerId, cityId: e.cityId, refKey: e.refKey, payload: e.payload });
  }
}

/** A hero in the city (a flow on "all cities" only runs where there is one). */
export const withHero = (g: TestGame, p: TestPlayer, cityId = p.cityId) => addHero(g, p, 1, cityId);

/** Barracks at position 0 (level 1 queues one batch), plenty of idle population. */
export async function withBarracks(g: TestGame, p: TestPlayer, level = 1, cityId = p.cityId) {
  await setBuildings(g, p, [[0, BuildingType.BARRACKS, level]], cityId);
  await setCityStats(g, p, { population: 10_000 }, cityId);
}

/** Save an army preset; returns its id. */
export async function armyPreset(g: TestGame, p: TestPlayer, name: string, troops: TroopCounts) {
  const list = await players.saveArmyPreset(g, p.id, name, troops);
  return list.find((x) => x.name === name)!.id;
}

/** Valleys no one holds close to the city (not flat land, which cannot be attacked), nearest first. */
export async function valleysNear(g: TestGame, cityId: number, count = 1) {
  const c = await getCity(g, cityId);
  const { x, y } = tileXY(c.tileId);
  const near: number[] = [];
  for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) near.push(tileId(x + dx, y + dy));
  const rows = await g.tx
    .select({ id: tiles.id })
    .from(tiles)
    .where(
      and(
        inArray(tiles.id, near),
        inArray(
          tiles.type,
          VALLEY_TYPES.filter((t) => t !== TileType.FLAT),
        ),
        isNull(tiles.ownerCityId),
        isNull(tiles.cityId),
      ),
    );
  const dist = (id: number) => Math.abs(tileXY(id).x - x) + Math.abs(tileXY(id).y - y);
  const ids = rows.map((r) => r.id).sort((a, b) => dist(a) - dist(b));
  if (ids.length < count) throw new Error(`valleysNear: only ${ids.length} valleys near city ${cityId}`);
  return ids.slice(0, count);
}

/** A city ready to farm: Rally Spot, militia and a hero. */
export async function farmingCity(g: TestGame, p: TestPlayer, cityId = p.cityId, troops = 1000) {
  await setBuildings(g, p, [[1, BuildingType.RALLY_SPOT, 10]], cityId);
  await setCityStats(g, p, { troops: { militia: troops } }, cityId);
  return withHero(g, p, cityId);
}

/** The city passes to another player (as when it is captured). */
export async function loseCity(g: TestGame, cityId: number, to: TestPlayer) {
  const c = await getCity(g, cityId);
  c.playerId = to.id;
  await saveCity(g, c);
}

/**
 * Write the test's pending keyed timed events to the table, as committing would: for code that reads a pending
 * event back from the table (a heal still waiting from an earlier run). They stay pending in the test as well.
 */
export async function persistEvents(g: TestGame) {
  for (const e of g._events.values()) {
    const row = {
      type: e.type,
      dueAt: e.dueAt,
      playerId: e.playerId ?? null,
      cityId: e.cityId ?? null,
      refKey: e.refKey,
      payload: e.payload ?? {},
      createdAt: g.now,
    };
    await g.tx
      .insert(timedEvents)
      .values(row)
      .onConflictDoUpdate({ target: timedEvents.refKey, set: { dueAt: row.dueAt, payload: row.payload, type: row.type } });
  }
}

/** The timed event with this ref key as stored in the table, if any. */
export async function storedEvent(g: TestGame, refKey: string) {
  const [row] = await g.tx.select().from(timedEvents).where(eq(timedEvents.refKey, refKey));
  return row;
}

export const mayor = { type: 'setMayor', stat: 'power' };

export const waitTime = { type: 'wait', until: 'time', minutes: 5 };

export async function heroAway(g: TestGame, p: TestPlayer, heroId: number, cityId = p.cityId) {
  const [valley] = await valleysNear(g, cityId);
  const { armyId } = await armies.sendArmy(g, p.id, cityId, { targetTileId: valley, mission: Mission.ATTACK, troops: { militia: 10 }, heroId });
  return { armyId, reach: g.events('army').find((e) => e.payload?.armyId === armyId)!.dueAt };
}

export const injured = { militia: 10 };

export const healed = () => {
  const cost = healCost(injured);
  const amounts = (['food', 'wood', 'iron'] as const).map((k) => msg('flow.resourceAmount', { amount: Math.ceil(cost[k]), resource: ref.resource(k) }));
  return msg('flow.step.healed', { count: 10, cost: amounts });
};

export async function sendOut(g: TestGame, p: TestPlayer, heroId: number) {
  const [valley] = await valleysNear(g, p.cityId);
  return (await armies.sendArmy(g, p.id, p.cityId, { targetTileId: valley, mission: Mission.ATTACK, troops: { militia: 10 }, heroId })).armyId;
}
