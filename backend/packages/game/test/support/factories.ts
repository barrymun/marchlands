// Test data, made with the game's own code (player creation, the admin tools), so it is always valid:
// a player gets an account and a real starting city on a free flat, exactly as a new player does.

import { eq } from 'drizzle-orm';

import { BuildingType, type ResourceSet, TileType, type TroopCounts } from '@marchlands/core';
import { accounts, cities, tiles } from '@marchlands/db';

import { type CityBundle, openOwnCity } from '#/city.ts';
import { initialCity } from '#/engine/player.ts';
import { pickOpenFlat } from '#/engine/world.ts';
import { admin, player as players } from '#/index.ts';
import { citiesOf, getCity, getPlayer, saveCity, savePlayer } from '#/repo.ts';
import type { TestGame } from '#test/support/game.ts';

let serial = 0;

export interface TestPlayer {
  id: number;
  accountId: number;
  name: string;
  /** the starting city */
  cityId: number;
}

/** A new player with an account and a starting city (Town Hall 1, the starting resources), as createPlayer makes it. */
export async function createTestPlayer(g: TestGame, opts: { name?: string; zone?: number; admin?: boolean } = {}): Promise<TestPlayer> {
  const n = ++serial;
  const name = opts.name ?? `Tester${n}`;
  const [account] = await g.tx
    .insert(accounts)
    .values({ username: `test_${n}_${g.now}`, email: `test_${n}_${g.now}@example.test`, passwordHash: 'x', isAdmin: !!opts.admin, createdAt: g.now })
    .returning();
  const p = await players.createPlayer(g, account!.id, { userName: name, castleName: `${name} City`, flag: 'T', faceUrl: '', sex: 0, zone: opts.zone ?? -1 });
  const [city] = await citiesOf(g, p.id);
  return { id: p.id, accountId: account!.id, name, cityId: city!.id };
}

/** Put buildings in a city: [positionId, typeId, level] (level 0 removes). Town Hall is position -1, Walls -2. */
export async function setBuildings(g: TestGame, p: TestPlayer, list: [positionId: number, typeId: number, level: number][], cityId = p.cityId) {
  for (const [pos, type, level] of list) await admin.setBuilding(g, cityId, p.id, pos, type, level);
}

/** Set a city's Town Hall level. */
export const setTownHall = (g: TestGame, p: TestPlayer, level: number, cityId = p.cityId) => setBuildings(g, p, [[-1, BuildingType.TOWN_HALL, level]], cityId);

/** Set a city's resources (others unchanged). */
export const setResources = (g: TestGame, p: TestPlayer, res: Partial<ResourceSet>, cityId = p.cityId) => admin.setResources(g, cityId, p.id, res);

/** Set a city's population and troop counts (each troop type given replaces its count; others are kept). */
export const setCityStats = (g: TestGame, p: TestPlayer, stats: { population?: number; troops?: Record<string, number> }, cityId = p.cityId) =>
  admin.setCityStats(g, cityId, p.id, stats);

/** Set a research level for the player. */
export const setResearch = (g: TestGame, p: TestPlayer, techId: number, level: number) => admin.setTechnology(g, p.name, techId, level);

/** Give the player items. */
export const giveItems = (g: TestGame, p: TestPlayer, items: Record<string, number>) => admin.grantItems(g, p.name, items);

/** Add a hired hero to a city (random, of up to 5 x innLevel); returns its id. */
export const addHero = (g: TestGame, p: TestPlayer, innLevel = 1, cityId = p.cityId) => admin.addHero(g, cityId, p.id, innLevel);

/** The player as stored now. */
export const reloadPlayer = (g: TestGame, p: TestPlayer) => getPlayer(g, p.id);

/** The city as stored now. */
export const reloadCity = (g: TestGame, cityId: number) => getCity(g, cityId);

/** The city with its heroes, production settled to now (what a service sees). */
export const cityBundle = (g: TestGame, p: TestPlayer, cityId = p.cityId): Promise<CityBundle> => openOwnCity(g, p.id, cityId);

/** Another city for the player on a free flat, as a new player's city is made (Town Hall 1, no heroes); returns its id. */
export async function addCity(g: TestGame, p: TestPlayer, name = `${p.name} Two`): Promise<number> {
  const tile = await pickOpenFlat(g, -1);
  const [city] = await g.tx
    .insert(cities)
    .values(initialCity(p.id, tile, name, g.now))
    .returning();
  await g.tx.update(tiles).set({ cityId: city!.id, type: TileType.CASTLE, ownerPlayerId: p.id, updatedAt: g.now }).where(eq(tiles.id, tile));
  return city!.id;
}

/** Set a city's injured troops (as a battle with Medicine leaves them). */
export async function setInjured(g: TestGame, cityId: number, injured: TroopCounts) {
  const c = await getCity(g, cityId);
  c.injuredTroops = injured;
  await saveCity(g, c);
}

/** Set the player's honor. */
export async function setHonor(g: TestGame, p: TestPlayer, honor: number) {
  const row = await getPlayer(g, p.id);
  row.honor = honor;
  await savePlayer(g, row);
}
