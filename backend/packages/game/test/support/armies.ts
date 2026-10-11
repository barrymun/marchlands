// Helpers for the army and combat tests (armies.db.test.ts, combat/*.db.test.ts): a city ready for war,
// targets on the seeded map near it, running a march through the real timed events, and its reports.

import { expect } from 'vitest';
import { asc, eq } from 'drizzle-orm';
import {
  BASIC_RESOURCES,
  BALANCE,
  BuildingType,
  HeroStatus,
  Mission,
  tileDistance,
  TileType,
  tileXY,
  type BattleReport,
  type ReportBody,
  type ScoutReport,
} from '@marchlands/core';
import { reports } from '@marchlands/db';
import { admin, alliance, armies, citiesOf, getArmy, getCity, getHero, getTile, world, type ArmyRow, type TileRow } from '../../src/index.ts';
import { addHero, createTestPlayer, setBuildings, setCityStats, setResources, type TestPlayer } from './factories.ts';
import type { TestGame } from './game.ts';

export const RICH = { gold: 10_000_000, food: 10_000_000, wood: 10_000_000, stone: 10_000_000, iron: 10_000_000 };
export const NO_RESOURCES = { gold: 0, food: 0, wood: 0, stone: 0, iron: 0 };

/**
 * Make a city ready to send armies: a Rally Spot (default level 10), a Feasting Hall (hero slots), an Embassy,
 * plenty of every resource and population, and the given troops; the player's beginner protection is lifted.
 */
export async function warCity(
  g: TestGame,
  p: TestPlayer,
  opts: { rallySpot?: number; feastingHall?: number; troops?: Record<string, number>; beginner?: boolean; cityId?: number } = {},
) {
  const cityId = opts.cityId ?? p.cityId;
  const list: [number, number, number][] = [
    [0, BuildingType.RALLY_SPOT, opts.rallySpot ?? 10],
    [1, BuildingType.FEASTING_HALL, opts.feastingHall ?? 5],
    [2, BuildingType.EMBASSY, 1],
  ];
  await setBuildings(g, p, list, cityId);
  await setResources(g, p, RICH, cityId);
  await setCityStats(g, p, { population: 50_000, troops: opts.troops ?? {} }, cityId);
  if (!opts.beginner) await admin.setPlayerFlags(g, p.name, { beginner: false });
}

/** Players of the war tests live in one state, so their cities are a few hours' march apart. */
export const WAR_ZONE = 6;

/** A new player ready for war (see warCity) with a hero in the city. */
export async function warrior(
  g: TestGame,
  troops: Record<string, number> = { lightCavalry: 5000, scouter: 500, carriage: 20 },
  opts: { feastingHall?: number } = {},
) {
  const p = await createTestPlayer(g, { zone: WAR_ZONE });
  await warCity(g, p, { troops, ...opts });
  const heroId = await addHero(g, p);
  return { p, heroId };
}

/** Send an army from the player's starting city. */
export const send = (g: TestGame, p: TestPlayer, input: armies.SendArmyInput) => armies.sendArmy(g, p.id, p.cityId, input);

/** The tile of a player's city. */
export const cityTile = async (g: TestGame, cityId: number) => (await getCity(g, cityId)).tileId;

/** Found a second city on the nearest free flat with the given hero and 10 extra carriages (the player gets the title for it); returns its id. */
export async function secondCity(g: TestGame, p: TestPlayer, heroId: number) {
  await admin.setPlayerFlags(g, p.name, { title: 1 });
  const { troops } = await getCity(g, p.cityId);
  await setCityStats(g, p, { troops: { carriage: (troops.carriage ?? 0) + 10 } });
  const flat = await tileNear(g, p.cityId, TileType.FLAT);
  const resources = Object.fromEntries(BASIC_RESOURCES.map((k) => [k, BALANCE.newCityMinResource]));
  const a = await send(g, p, { targetTileId: flat.id, mission: Mission.BUILD_CITY, troops: { carriage: 10 }, resources, heroId });
  await arrive(g, a.armyId);
  const city = (await citiesOf(g, p.id)).find((c) => c.tileId === flat.id);
  if (!city) throw new Error('the settlers founded no city');
  return city.id;
}

/** Occupy the nearest free level-1 valley with a big army (which then comes home); returns the valley tile. */
export async function occupyValley(g: TestGame, p: TestPlayer, heroId: number) {
  await setCityStats(g, p, { troops: { lightCavalry: 40_000 } });
  const valley = await valleyNear(g, p.cityId, { level: 1 });
  const a = await send(g, p, { targetTileId: valley.id, mission: Mission.ATTACK, troops: { lightCavalry: 40_000 }, heroId });
  await roundTrip(g, a.armyId);
  const t = await getTile(g, valley.id);
  if (t.ownerPlayerId !== p.id) throw new Error('the valley was not occupied');
  return t;
}

/** Free tiles of a type near a city (no city on them, not occupied), nearest first. */
export async function tilesNear(g: TestGame, cityId: number, type: TileType, opts: { level?: number; radius?: number } = {}): Promise<TileRow[]> {
  const c = await getCity(g, cityId);
  const { x, y } = tileXY(c.tileId);
  const found = await world.searchTiles(g, x, y, opts.radius ?? 10, type);
  const free = found.filter((t) => t.cityId == null && t.ownerCityId == null && (opts.level == null || t.level === opts.level));
  free.sort((a, b) => tileDistance(c.tileId, a.id) - tileDistance(c.tileId, b.id));
  return Promise.all(free.map((t) => getTile(g, t.id)));
}

/** The nearest free tile of a type (and level) to a city. */
export async function tileNear(g: TestGame, cityId: number, type: TileType, opts: { level?: number; radius?: number; skip?: number } = {}) {
  const list = await tilesNear(g, cityId, type, opts);
  const t = list[opts.skip ?? 0];
  if (!t) throw new Error(`no free tile of type ${type} near city ${cityId}`);
  return t;
}

const VALLEYS = [TileType.FOREST, TileType.DESERT, TileType.HILL, TileType.SWAMP, TileType.GRASS, TileType.LAKE];

/** The nearest free valley (any type but flat land) of a level to a city. */
export async function valleyNear(g: TestGame, cityId: number, opts: { level?: number; radius?: number; skip?: number } = {}) {
  const c = await getCity(g, cityId);
  const all = (await Promise.all(VALLEYS.map((t) => tilesNear(g, cityId, t, opts)))).flat();
  all.sort((a, b) => tileDistance(c.tileId, a.id) - tileDistance(c.tileId, b.id));
  const t = all[opts.skip ?? 0];
  if (!t) throw new Error(`no free valley near city ${cityId}`);
  return t;
}

/** The army as stored now (undefined once it is gone). */
export const armyRow = (g: TestGame, id: number): Promise<ArmyRow | undefined> => getArmy(g, id);

/** Run the timed events up to the army's current reach time (arrival, or its return home). */
export async function arrive(g: TestGame, armyId: number) {
  const a = await getArmy(g, armyId);
  if (!a) throw new Error(`army ${armyId} is gone`);
  await g.runDue(Math.max(g.now, a.reachTime));
}

/** Run the army's march to the end: arrival, then its way home (as long as it keeps marching). */
export async function roundTrip(g: TestGame, armyId: number) {
  for (let i = 0; i < 5; i++) {
    const a = await getArmy(g, armyId);
    if (!a || a.direction === 3) return;
    await g.runDue(Math.max(g.now, a.reachTime));
  }
}

/** A player's reports, oldest first, with their bodies. */
export async function reportsOf(g: TestGame, playerId: number) {
  const rows = await g.tx.select().from(reports).where(eq(reports.playerId, playerId)).orderBy(asc(reports.id));
  return rows.map((r) => ({ ...r, body: r.body as ReportBody }));
}

/** Report title codes of a player, oldest first. */
export const reportTitles = async (g: TestGame, playerId: number) => (await reportsOf(g, playerId)).map((r) => r.title.code);

/** The latest report of a player with this title code. */
export async function lastReport(g: TestGame, playerId: number, code: string) {
  const r = (await reportsOf(g, playerId)).filter((x) => x.title.code === code).at(-1);
  if (!r) throw new Error(`no report ${code} for player ${playerId}`);
  return r;
}

/** Put `b` in an alliance founded by `a` (both need an Embassy, see warCity). Returns the alliance id. */
export async function allies(g: TestGame, a: TestPlayer, b: TestPlayer, name = `Alliance ${a.id}`) {
  const { id } = await alliance.createAlliance(g, a.id, a.cityId, name);
  await alliance.invite(g, a.id, b.name);
  await alliance.acceptInvite(g, b.id, name);
  return id;
}

type BattleKinds = { city: { city: string }; npc: { loyaltyDamage: number }; valley: { occupied: boolean } };
type ScoutKinds = { npc: { target: 'npc' }; valley: { target: 'valley' }; city: { intel: unknown }; cityDefender: { from: string } };

/** The battle of a report, of the given target kind (fails when the report is something else). */
export function battleOf<K extends keyof BattleKinds>(r: { body: ReportBody }, kind: K): Extract<BattleReport, BattleKinds[K]> {
  const key = { city: 'city', npc: 'loyaltyDamage', valley: 'occupied' }[kind];
  if (r.body.kind !== 'battle' || !(key in r.body.battle)) throw new Error(`not a ${kind} battle report: ${JSON.stringify(r.body)}`);
  return r.body.battle as Extract<BattleReport, BattleKinds[K]>;
}

/** The scouting of a report, of the given kind (`city`: the scout's copy, `cityDefender`: the scouted lord's). */
export function scoutOf<K extends keyof ScoutKinds>(r: { body: ReportBody }, kind: K): Extract<ScoutReport, ScoutKinds[K]> {
  if (r.body.kind !== 'scout') throw new Error(`not a scout report: ${JSON.stringify(r.body)}`);
  const s = r.body.scout;
  const ok = kind === 'city' ? 'intel' in s : kind === 'cityDefender' ? 'from' in s : s.target === kind;
  if (!ok) throw new Error(`not a ${kind} scout report: ${JSON.stringify(s)}`);
  return s as Extract<ScoutReport, ScoutKinds[K]>;
}

/** A hero whose army was wiped out: 5 loyalty less, then either captured by the captor or idle at home. */
export async function expectWipedHero(g: TestGame, heroId: number, loyaltyBefore: number, home: TestPlayer, captor: TestPlayer | null) {
  const h = await getHero(g, heroId);
  expect(h.loyalty).toBe(Math.max(0, loyaltyBefore - 5));
  if (h.status === HeroStatus.SEIZED) {
    expect(captor).not.toBeNull();
    expect(h).toMatchObject({ cityId: captor!.cityId, capturedByPlayerId: captor!.id });
  } else expect(h).toMatchObject({ status: HeroStatus.IDLE, cityId: home.cityId, capturedByPlayerId: null });
  return h;
}
