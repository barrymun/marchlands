// processArmy for attacks on lords' cities: the battle, losses, injured, plunder, honor, medals, hero
// experience and capture, allied troops stationed there, and the reasons an attack turns back.

import { describe, expect, it } from 'vitest';

import { PushCmd } from '@marchlands/contracts';
import {
  ArmyDirection,
  armyLoad,
  BuffId,
  BuildingType,
  FortType,
  HeroBuffId,
  HeroStatus,
  injuredOf,
  ItemId,
  maxArmyTroops,
  Mission,
  msg,
  TechType,
  totalResources,
  WAR_ENSIGN_DESC,
} from '@marchlands/core';

import { processArmy } from '#/engine/combat.ts';
import { interior, player, shop, training } from '#/index.ts';
import { getHero } from '#/repo.ts';
import {
  allies,
  armyRow,
  arrive,
  battleOf,
  cityTile,
  expectWipedHero,
  lastReport,
  reportsOf,
  reportTitles,
  send,
  WAR_ZONE,
  warCity,
  warrior,
} from '#test/support/armies.ts';
import {
  addHero,
  cityBundle,
  createTestPlayer,
  giveItems,
  reloadCity,
  reloadPlayer,
  setBuildings,
  setResearch,
  type TestPlayer,
} from '#test/support/factories.ts';
import { game, type TestGame } from '#test/support/game.ts';

const KEYS = ['gold', 'food', 'wood', 'stone', 'iron'] as const;

/** p attacks q's city: p has `attackers`, q `defenders`; returns the army (not sent yet when `go` is false). */
async function battle(g: TestGame, attackers: Record<string, number>, defenders: Record<string, number>) {
  const { p, heroId } = await warrior(g, attackers);
  const { p: q, heroId: qHero } = await warrior(g, defenders);
  const go = async () => (await send(g, p, { targetTileId: await cityTile(g, q.cityId), mission: Mission.ATTACK, troops: attackers, heroId })).armyId;
  return { p, q, heroId, qHero, go };
}

/** Run to just before the army arrives and settle the city: its state when the battle starts. */
async function justBefore(g: TestGame, armyId: number, q: TestPlayer) {
  await g.runDue((await armyRow(g, armyId))!.reachTime - 1);
  return (await cityBundle(g, q)).city;
}

describe(`${processArmy.name}: attacking a lord's city`, () => {
  it('a won battle: losses, injured, plunder, honor, medals and hero experience on both sides', () =>
    game(async (g) => {
      const { p, q, heroId, qHero, go } = await battle(g, { lightCavalry: 5000 }, { militia: 300, archer: 20 });
      await setResearch(g, p, TechType.MEDICINE, 10);
      await setResearch(g, q, TechType.MEDICINE, 4);
      const armyId = await go();
      const before = await justBefore(g, armyId, q);
      await arrive(g, armyId);

      const mine = await lastReport(g, p.id, 'report.title.attackSucceeded');
      const theirs = await lastReport(g, q.id, 'report.title.cityAttacked');
      expect(mine).toMatchObject({ isAttack: true, armyType: Mission.ATTACK });
      expect(theirs).toMatchObject({ isAttack: false, body: mine.body });
      const b = battleOf(mine, 'city');
      const [pp, qp] = [await reloadPlayer(g, p), await reloadPlayer(g, q)];
      const [hero, defHero] = [await getHero(g, heroId), await getHero(g, qHero)];
      expect(b).toMatchObject({
        result: 'attackerWon',
        city: before.name,
        attacker: { player: p.name, hero: { id: hero.id, name: hero.name }, troops: { before: { lightCavalry: 5000 } } },
        defender: { player: q.name, hero: { id: defHero.id, name: defHero.name }, troops: { before: { militia: 300, archer: 20 } }, wallLevel: 0 },
      });

      // losses and injured (Medicine)
      const city = await reloadCity(g, q.cityId);
      expect(city.troops).toEqual(b.defender.troops.after);
      expect(b.defender.injured).toEqual(injuredOf(b.defender.troops.lost, qp.research));
      expect(city.injuredTroops).toEqual(b.defender.injured);
      expect(b.attacker.injured).toEqual(injuredOf(b.attacker.troops.lost, pp.research));
      expect((await reloadCity(g, p.cityId)).injuredTroops).toEqual(b.attacker.injured);
      if (Object.keys(b.attacker.injured ?? {}).length) expect(g.pushes(PushCmd.INJURED_TROOP_UPDATE).at(-1)?.playerIds).toEqual([p.id]);

      // plunder: what the survivors can carry, taken from the city
      const loot = b.plunder;
      expect(totalResources(loot)).toBeGreaterThan(0);
      expect(totalResources(loot)).toBeLessThanOrEqual(armyLoad(b.attacker.troops.after, pp.research));
      for (const k of KEYS) expect(before[k] - city[k]).toBeCloseTo(loot[k], 0);

      // honor, medals, hero experience
      expect(pp.honor).toBe(b.attacker.honor);
      expect(qp.honor).toBe(b.defender.honor);
      expect(b.attacker.honor).toBeGreaterThan(0);
      for (const [id, n] of Object.entries(b.medals ?? {})) expect(pp.items[id]).toBe(n);
      expect(hero.experience).toBe(b.attacker.heroExp);
      expect(defHero.experience).toBe(b.defender.heroExp);

      // the defender sees the damage
      for (const cmd of [PushCmd.TROOP_UPDATE, PushCmd.FORTIFICATIONS_UPDATE, PushCmd.RESOURCE_UPDATE]) {
        expect(g.pushes(cmd).some((x) => x.playerIds.includes(q.id))).toBe(true);
      }

      // survivors head home with the loot
      expect(await armyRow(g, armyId)).toMatchObject({ direction: ArmyDirection.BACKWARD, troops: b.attacker.troops.after, resources: loot });
      expect(hero.status).toBe(HeroStatus.RETURN);
      await arrive(g, armyId);
      expect((await reloadCity(g, p.cityId)).troops.lightCavalry).toBe(b.attacker.troops.after.lightCavalry);
      expect(await reportTitles(g, p.id)).toEqual(['report.title.attackSucceeded', 'report.title.attackReturned']);
    }));

  it('a lost battle: the army is gone, its hero loses loyalty, the defender keeps the honor', () =>
    game(async (g) => {
      const { p, q, heroId, go } = await battle(g, { lightCavalry: 500 }, { archer: 50_000 });
      const loyalty = (await getHero(g, heroId)).loyalty;
      const armyId = await go();
      await arrive(g, armyId);

      const b = battleOf(await lastReport(g, p.id, 'report.title.attackFailed'), 'city');
      expect(b).toMatchObject({ result: 'defenderWon', plunder: { gold: 0, food: 0, wood: 0, stone: 0, iron: 0 } });
      expect(b.attacker.troops.after).toEqual({});
      expect(b.medals).toBeUndefined();
      expect(await reportTitles(g, q.id)).toEqual(['report.title.attackRepelled']);
      expect(await armyRow(g, armyId)).toBeUndefined();
      expect(g.events('army')).toEqual([]);
      expect((await reloadCity(g, p.cityId)).troops.lightCavalry ?? 0).toBe(0);
      expect((await reloadCity(g, q.cityId)).troops).toEqual(b.defender.troops.after);
      expect((await reloadPlayer(g, q)).honor).toBe(b.defender.honor);
      await expectWipedHero(g, heroId, loyalty, p, q);
    }));

  it('heroes of wiped armies may be captured by a city with a free Feasting Hall slot', () =>
    game(async (g) => {
      const { p } = await warrior(g, { lightCavalry: 100 });
      const { p: q } = await warrior(g, { archer: 50_000 });
      const target = await cityTile(g, q.cityId);
      const sent: { heroId: number; loyalty: number; armyId: number }[] = [];
      for (let i = 0; i < 10; i++) {
        const heroId = await addHero(g, p);
        const { armyId } = await send(g, p, { targetTileId: target, mission: Mission.ATTACK, troops: { lightCavalry: 10 }, heroId });
        sent.push({ heroId, loyalty: (await getHero(g, heroId)).loyalty, armyId });
      }
      await arrive(g, sent[0]!.armyId);
      const heroes = [];
      for (const s of sent) heroes.push(await expectWipedHero(g, s.heroId, s.loyalty, p, q));
      const captured = heroes.filter((h) => h.status === HeroStatus.SEIZED);
      expect(captured.length).toBeGreaterThan(0);
      // q had one hero and 5 slots
      expect(captured.length).toBeLessThanOrEqual(4);
      for (const h of captured) {
        expect(h).toMatchObject({ powerBuffAdded: 0, managementBuffAdded: 0, stratagemBuffAdded: 0 });
        expect(h.buffs).toEqual([expect.objectContaining({ id: HeroBuffId.HOME_CITY, param: p.cityId })]);
        expect(g.pushes(PushCmd.HERO_UPDATE).some((x) => x.playerIds.includes(p.id) && (x.data as { updateType: number }).updateType === 1)).toBe(true);
      }
    }));

  it('no hero is captured without a free Feasting Hall slot', () =>
    game(async (g) => {
      const { p } = await warrior(g, { lightCavalry: 100 });
      const { p: q } = await warrior(g, { archer: 50_000 }, { feastingHall: 0 });
      await setBuildings(g, q, [[1, BuildingType.FEASTING_HALL, 0]]);
      const target = await cityTile(g, q.cityId);
      const sent: { heroId: number; loyalty: number; armyId: number }[] = [];
      for (let i = 0; i < 10; i++) {
        const heroId = await addHero(g, p);
        const { armyId } = await send(g, p, { targetTileId: target, mission: Mission.ATTACK, troops: { lightCavalry: 10 }, heroId });
        sent.push({ heroId, loyalty: (await getHero(g, heroId)).loyalty, armyId });
      }
      await arrive(g, sent[0]!.armyId);
      for (const s of sent) expect((await expectWipedHero(g, s.heroId, s.loyalty, p, null)).status).toBe(HeroStatus.IDLE);
    }));

  it('a city keeping its troops in fights with nothing but its walls', () =>
    game(async (g) => {
      const { p, q, go } = await battle(g, { lightCavalry: 1000 }, { archer: 50_000 });
      await interior.setCityFlags(g, q.id, q.cityId, { goOutForBattle: false });
      const armyId = await go();
      await arrive(g, armyId);
      const b = battleOf(await lastReport(g, p.id, 'report.title.attackSucceeded'), 'city');
      expect(b.defender.troops.before).toEqual({});
      expect(b.defender.injured).toEqual({});
      expect((await reloadCity(g, q.cityId)).troops.archer).toBe(50_000);
    }));

  it('allied troops stationed in the city fight and share the losses; their lord gets the report', () =>
    game(async (g) => {
      const { q, go } = await battle(g, { lightCavalry: 5000 }, { militia: 100 });
      const { p: ally, heroId: allyHero } = await warrior(g, { pikemen: 200 });
      await allies(g, q, ally);
      await interior.setCityFlags(g, q.id, q.cityId, { allowAlliance: true });
      const guard = await send(g, ally, { targetTileId: await cityTile(g, q.cityId), mission: Mission.REINFORCE, troops: { pikemen: 200 }, heroId: allyHero });
      await arrive(g, guard.armyId);
      const armyId = await go();
      await arrive(g, armyId);

      const report = await lastReport(g, ally.id, 'report.title.reinforcementsFought');
      const b = battleOf(report, 'city');
      expect(b.defender.troops.before).toEqual({ militia: 100, pikemen: 200 });
      const stationed = await armyRow(g, guard.armyId);
      const city = await reloadCity(g, q.cityId);
      expect({ militia: city.troops.militia ?? 0, pikemen: stationed?.troops.pikemen ?? 0 }).toEqual({
        militia: b.defender.troops.after.militia ?? 0,
        pikemen: b.defender.troops.after.pikemen ?? 0,
      });
      if (!stationed) expect((await getHero(g, allyHero)).status).toBe(HeroStatus.IDLE);
      expect(await reportTitles(g, q.id)).toContain(b.result === 'attackerWon' ? 'report.title.cityAttacked' : 'report.title.attackRepelled');
    }));

  it('the hero of allied troops wiped out defending a city is idle again', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g, { lightCavalry: 5000 });
      const q = await createTestPlayer(g, { zone: WAR_ZONE });
      await warCity(g, q); // no hero of its own: the ally's hero leads the defence
      const { p: ally, heroId: allyHero } = await warrior(g, { pikemen: 50 });
      await allies(g, q, ally);
      await interior.setCityFlags(g, q.id, q.cityId, { allowAlliance: true });
      const guard = await send(g, ally, { targetTileId: await cityTile(g, q.cityId), mission: Mission.REINFORCE, troops: { pikemen: 50 }, heroId: allyHero });
      await arrive(g, guard.armyId);
      const attack = await send(g, p, { targetTileId: await cityTile(g, q.cityId), mission: Mission.ATTACK, troops: { lightCavalry: 5000 }, heroId });
      await arrive(g, attack.armyId);
      const b = battleOf(await lastReport(g, ally.id, 'report.title.reinforcementsFought'), 'city');
      expect(b).toMatchObject({ result: 'attackerWon', defender: { hero: { id: allyHero } } });
      expect(b.defender.heroExp).toBeGreaterThan(0);
      expect(await armyRow(g, guard.armyId)).toBeUndefined();
      expect((await getHero(g, allyHero)).status).toBe(HeroStatus.IDLE);
    }));

  it('reports the item bonuses that counted, and a War Ensign that let the army march', () =>
    game(async (g) => {
      const { p, go } = await battle(g, { lightCavalry: 12_000 }, { militia: 10 });
      await setBuildings(g, p, [[0, BuildingType.RALLY_SPOT, 1]]);
      await giveItems(g, p, { [ItemId.WAR_ENSIGN]: 1, [ItemId.WAR_HORN]: 1 });
      await shop.useItem(g, p.id, ItemId.WAR_ENSIGN, p.cityId);
      await shop.useItem(g, p.id, ItemId.WAR_HORN, p.cityId);
      expect(12_000).toBeGreaterThan(maxArmyTroops((await reloadCity(g, p.cityId)).buildings));
      const horn = (await reloadPlayer(g, p)).buffs.find((x) => x.id === BuffId.ATTACK)!;
      const armyId = await go();
      await arrive(g, armyId);
      const b = battleOf(await lastReport(g, p.id, 'report.title.attackSucceeded'), 'city');
      expect(b.attacker.bonuses).toEqual([
        { desc: horn.desc, itemId: ItemId.WAR_HORN },
        { desc: WAR_ENSIGN_DESC, itemId: ItemId.WAR_ENSIGN },
      ]);
      expect(b.defender.bonuses).toBeUndefined();
    }));

  it('turns back from a city that became friendly', () =>
    game(async (g) => {
      const { p, q, heroId, go } = await battle(g, { lightCavalry: 100 }, { militia: 10 });
      const armyId = await go();
      await allies(g, p, q);
      await arrive(g, armyId);
      expect((await lastReport(g, p.id, 'report.title.missionAborted')).body).toEqual({ kind: 'text', text: msg('army.cityNowFriendly') });
      expect(await armyRow(g, armyId)).toMatchObject({ direction: ArmyDirection.BACKWARD, troops: { lightCavalry: 100 } });
      expect((await getHero(g, heroId)).status).toBe(HeroStatus.RETURN);
      expect(await reportTitles(g, q.id)).toEqual([]);
    }));

  it('turns back from a city that came under protection', () =>
    game(async (g) => {
      const { p, q, go } = await battle(g, { lightCavalry: 100 }, { militia: 10 });
      const armyId = await go();
      await giveItems(g, q, { [ItemId.TRUCE_AGREEMENT]: 1 });
      await player.startTruce(g, q.id, ItemId.TRUCE_AGREEMENT, q.cityId);
      await arrive(g, armyId);
      expect((await lastReport(g, p.id, 'report.title.missionAborted')).body).toEqual({ kind: 'text', text: msg('player.protected.truce') });
      expect((await reloadCity(g, q.cityId)).troops.militia).toBe(10);
    }));

  it('a city with walls and fortifications keeps what survives of them', () =>
    game(async (g) => {
      const { p, q, go } = await battle(g, { lightCavalry: 5000 }, { militia: 10 });
      await setBuildings(g, q, [[-2, BuildingType.WALLS, 4]]);
      await training.train(g, q.id, q.cityId, FortType.TRAP, 100, training.WALLS_QUEUE);
      await g.runDue(g.events('train')[0]!.dueAt);
      expect((await reloadCity(g, q.cityId)).forts).toEqual({ trap: 100 });
      const armyId = await go();
      await arrive(g, armyId);
      const b = battleOf((await reportsOf(g, p.id))[0]!, 'city');
      expect(b.defender.wallLevel).toBe(4);
      expect(b.defender.forts).toMatchObject({ before: { trap: 100 } });
      expect((await reloadCity(g, q.cityId)).forts).toEqual(b.defender.forts!.after);
      expect(g.pushes(PushCmd.FORTIFICATIONS_UPDATE).at(-1)).toMatchObject({ playerIds: [q.id], data: { castleId: q.cityId } });
    }));
});
