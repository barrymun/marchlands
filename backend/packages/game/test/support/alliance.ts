// Alliance test data, made with the alliance service itself: a founded alliance, members joined by
// invitation (they get an Embassy first) and promoted by the Host. Shared by every service test that needs one.

import { eq } from 'drizzle-orm';
import { AllianceRank, BALANCE, BuildingType } from '@marchlands/core';
import { alliances } from '@marchlands/db';
import { alliance } from '#/index.ts';
import { createTestPlayer, setBuildings, setResources, type TestPlayer } from '#test/support/factories.ts';
import type { TestGame } from '#test/support/game.ts';

let serial = 0;

export interface TestAlliance {
  id: number;
  name: string;
  host: TestPlayer;
}

/** Give the player an Embassy (needed to apply or accept an invitation). */
export async function withEmbassy(g: TestGame, p: TestPlayer): Promise<TestPlayer> {
  await setBuildings(g, p, [[4, BuildingType.EMBASSY, 1]]);
  return p;
}

/** A new player founds an alliance (paying the creation gold); returns it with its Host. */
export async function createTestAlliance(g: TestGame, opts: { name?: string; host?: TestPlayer } = {}): Promise<TestAlliance> {
  const host = opts.host ?? (await createTestPlayer(g));
  await setResources(g, host, { gold: BALANCE.allianceCreateGold });
  const name = opts.name ?? `Order ${++serial}`;
  const { id } = await alliance.createAlliance(g, host.id, host.cityId, name);
  return { id, name, host };
}

/** A new player invited into the alliance by its Host, then given `rank`. */
export async function addMember(g: TestGame, a: TestAlliance, rank: number = AllianceRank.MEMBER): Promise<TestPlayer> {
  const p = await withEmbassy(g, await createTestPlayer(g));
  await alliance.invite(g, a.host.id, p.name);
  await alliance.acceptInvite(g, p.id, a.name);
  if (rank !== AllianceRank.MEMBER) await alliance.setRank(g, a.host.id, p.name, rank);
  return p;
}

/** The alliance as stored now (undefined once disbanded). */
export async function allianceRow(g: TestGame, id: number) {
  const [row] = await g.tx.select().from(alliances).where(eq(alliances.id, id));
  return row;
}

/** `host` founds an alliance named `name` (paying its gold from the starting city); returns its id. */
export async function foundAlliance(g: TestGame, host: TestPlayer, name: string): Promise<number> {
  return (await alliance.createAlliance(g, host.id, host.cityId, name)).id;
}

/** `host` invites `p` into the alliance `name` and `p` accepts (an Embassy is built for it first). */
export async function joinAlliance(g: TestGame, host: TestPlayer, p: TestPlayer, name: string) {
  await withEmbassy(g, p);
  await alliance.invite(g, host.id, p.name);
  await alliance.acceptInvite(g, p.id, name);
}

/** The ally, neutral and enemy lists an alliance's Host sees (alliance.myAlliance). */
export async function relationsOf(g: TestGame, a: TestAlliance) {
  const mine = await alliance.myAlliance(g, a.host.id);
  if (!mine) throw new Error(`${a.name} has no host`);
  return { friendlyList: mine.friendlyList, middleList: mine.middleList, enemyList: mine.enemyList };
}
