// processArmy for transports and reinforcements: goods delivered, troops moving in or camping.

import { describe, expect, it } from 'vitest';

import { PushCmd } from '@marchlands/contracts';
import { ArmyDirection, HeroStatus, Mission, msg, ReportBodyKind, ReportType, TimedEventType } from '@marchlands/core';

import { processArmy } from '#/engine/combat.ts';
import { alliance, combat, interior } from '#/index.ts';
import { getHero } from '#/repo.ts';
import {
  allies,
  armyRow,
  arrive,
  cityTile,
  lastReport,
  NO_RESOURCES,
  occupyValley,
  reportTitles,
  secondCity,
  send,
  warCity,
  warrior,
} from '#test/support/armies.ts';
import { addHero, cityBundle, reloadCity, type TestPlayer } from '#test/support/factories.ts';
import { game, type TestGame } from '#test/support/game.ts';

/** Run time to just before an army arrives and settle the city then: what it holds when the army walks in. */
async function justBefore(g: TestGame, armyId: number, p: TestPlayer, cityId = p.cityId) {
  const a = (await armyRow(g, armyId))!;
  await g.runDue(a.reachTime - 1);
  return (await cityBundle(g, p, cityId)).city;
}

const heroSummaryOf = async (g: TestGame, id: number) => {
  const h = await getHero(g, id);
  return { id: h.id, name: h.name, level: h.level, logoUrl: h.logoUrl };
};

describe(`${processArmy.name}: transport`, () => {
  it('delivers goods to an ally, reports to both, and comes home empty', () =>
    game(async (g) => {
      const { p } = await warrior(g);
      const { p: q } = await warrior(g);
      await allies(g, p, q);
      const goods = { ...NO_RESOURCES, food: 30_000, iron: 20_000 };
      const bean = await send(g, p, { targetTileId: await cityTile(g, q.cityId), mission: Mission.TRANSPORT, troops: { carriage: 10 }, resources: goods });
      const before = await justBefore(g, bean.armyId, q);
      await arrive(g, bean.armyId);

      const after = await reloadCity(g, q.cityId);
      expect(after.food - before.food).toBeCloseTo(30_000, 0);
      expect(after.iron - before.iron).toBeCloseTo(20_000, 0);
      expect(g.pushes(PushCmd.RESOURCE_UPDATE).at(-1)?.playerIds).toEqual([q.id]);

      const body = { kind: ReportBodyKind.TRADE, trade: { from: p.name, to: q.name, resources: goods } };
      expect(await lastReport(g, p.id, 'report.title.transportReport')).toMatchObject({ typeId: ReportType.TRADE, armyType: Mission.TRANSPORT, body });
      expect(await lastReport(g, q.id, 'report.title.transportReceived')).toMatchObject({ typeId: ReportType.TRADE, body });

      expect(await armyRow(g, bean.armyId)).toMatchObject({ direction: ArmyDirection.BACKWARD, resources: NO_RESOURCES, troops: { carriage: 10 } });
      await arrive(g, bean.armyId);
      expect(await armyRow(g, bean.armyId)).toBeUndefined();
      expect((await reloadCity(g, p.cityId)).troops.carriage).toBe(20);
      expect((await reportTitles(g, p.id)).at(-1)).toBe('report.title.returned');
    }));

  it('between own cities there is a single report', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      const other = await secondCity(g, p, heroId);
      const bean = await send(g, p, { targetTileId: await cityTile(g, other), mission: Mission.TRANSPORT, troops: { carriage: 5 }, resources: { wood: 5000 } });
      const before = await justBefore(g, bean.armyId, p, other);
      await arrive(g, bean.armyId);
      expect((await reloadCity(g, other)).wood - before.wood).toBeCloseTo(5000, 0);
      expect((await reportTitles(g, p.id)).filter((t) => t.startsWith('report.title.transport'))).toEqual(['report.title.transportReport']);
    }));

  it('turns back with the goods when the city is no longer friendly', () =>
    game(async (g) => {
      const { p } = await warrior(g);
      const { p: q } = await warrior(g);
      await allies(g, p, q);
      const bean = await send(g, p, {
        targetTileId: await cityTile(g, q.cityId),
        mission: Mission.TRANSPORT,
        troops: { carriage: 1 },
        resources: { food: 1000 },
      });
      await alliance.leaveAlliance(g, q.id);
      await arrive(g, bean.armyId);
      expect(await armyRow(g, bean.armyId)).toMatchObject({ direction: ArmyDirection.BACKWARD, resources: { ...NO_RESOURCES, food: 1000 } });
      expect((await lastReport(g, p.id, 'report.title.missionAborted')).body).toEqual({ kind: ReportBodyKind.TEXT, text: msg('army.destinationNotFriendly') });
      expect(await reportTitles(g, q.id)).toEqual([]);
    }));
});

describe(`${processArmy.name}: reinforce`, () => {
  it('camps in an allied city after delivering its goods, and the host is told', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      const { p: q } = await warrior(g);
      await allies(g, p, q);
      await interior.setCityFlags(g, q.id, q.cityId, { allowAlliance: true });
      const bean = await send(g, p, {
        targetTileId: await cityTile(g, q.cityId),
        mission: Mission.REINFORCE,
        troops: { lightCavalry: 300 },
        resources: { stone: 4000 },
        heroId,
      });
      const before = await justBefore(g, bean.armyId, q);
      await arrive(g, bean.armyId);

      expect((await reloadCity(g, q.cityId)).stone - before.stone).toBeCloseTo(4000, 0);
      expect(await armyRow(g, bean.armyId)).toMatchObject({
        direction: ArmyDirection.STAY,
        reachTime: g.now,
        resources: NO_RESOURCES,
        troops: { lightCavalry: 300 },
      });
      expect(g.events(TimedEventType.ARMY)).toEqual([]);
      expect((await getHero(g, heroId)).status).toBe(HeroStatus.ATTACK);
      const report = await lastReport(g, q.id, 'report.title.reinforcementsFrom');
      expect(report).toMatchObject({
        title: msg('report.title.reinforcementsFrom', { name: p.name }),
        typeId: ReportType.OTHER,
        body: { kind: ReportBodyKind.MOVEMENT, movement: { from: p.name, hero: await heroSummaryOf(g, heroId), troops: { lightCavalry: 300 } } },
      });
      expect(await reportTitles(g, p.id)).toEqual([]);
    }));

  it('turns back when the city is no longer friendly', () =>
    game(async (g) => {
      const { p } = await warrior(g);
      const { p: q } = await warrior(g);
      await allies(g, p, q);
      await interior.setCityFlags(g, q.id, q.cityId, { allowAlliance: true });
      const bean = await send(g, p, { targetTileId: await cityTile(g, q.cityId), mission: Mission.REINFORCE, troops: { lightCavalry: 1 } });
      await alliance.leaveAlliance(g, q.id);
      await arrive(g, bean.armyId);
      expect((await armyRow(g, bean.armyId))!.direction).toBe(ArmyDirection.BACKWARD);
      expect((await lastReport(g, p.id, 'report.title.missionAborted')).body).toEqual({ kind: ReportBodyKind.TEXT, text: msg('army.destinationNotFriendly') });
    }));

  it('moves troops, goods and the hero into an own city for good', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      const other = await secondCity(g, p, heroId);
      await warCity(g, p, { cityId: other });
      const hero2 = await addHero(g, p);
      const bean = await send(g, p, {
        targetTileId: await cityTile(g, other),
        mission: Mission.REINFORCE,
        troops: { lightCavalry: 700 },
        resources: { gold: 2000 },
        heroId: hero2,
      });
      const before = await justBefore(g, bean.armyId, p, other);
      await arrive(g, bean.armyId);

      expect(await armyRow(g, bean.armyId)).toBeUndefined();
      expect(g.events(TimedEventType.ARMY)).toEqual([]);
      const city = await reloadCity(g, other);
      expect(city.troops.lightCavalry).toBe((before.troops.lightCavalry ?? 0) + 700);
      expect(city.gold - before.gold).toBeCloseTo(2000, 0);
      expect(await getHero(g, hero2)).toMatchObject({ cityId: other, status: HeroStatus.IDLE });
      const report = await lastReport(g, p.id, 'report.title.reinforcementArrived');
      expect(report).toMatchObject({
        typeId: ReportType.OTHER,
        body: {
          kind: ReportBodyKind.MOVEMENT,
          movement: { hero: await heroSummaryOf(g, hero2), troops: { lightCavalry: 700 }, resources: { ...NO_RESOURCES, gold: 2000 }, heroReturned: false },
        },
      });
      expect(g.pushes(PushCmd.TROOP_UPDATE).at(-1)?.data).toMatchObject({ castleId: other });
    }));

  it('in an own city with no free hero slot, the hero goes back home with the empty army', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      const other = await secondCity(g, p, heroId); // no Feasting Hall there
      const hero2 = await addHero(g, p);
      const bean = await send(g, p, { targetTileId: await cityTile(g, other), mission: Mission.REINFORCE, troops: { lightCavalry: 50 }, heroId: hero2 });
      await arrive(g, bean.armyId);

      expect((await reloadCity(g, other)).troops.lightCavalry).toBe(50);
      expect(await armyRow(g, bean.armyId)).toMatchObject({ direction: ArmyDirection.BACKWARD, troops: {}, resources: NO_RESOURCES, heroId: hero2 });
      expect((await getHero(g, hero2)).status).toBe(HeroStatus.RETURN);
      expect((await lastReport(g, p.id, 'report.title.reinforcementArrived')).body).toMatchObject({ movement: { heroReturned: true } });
      await arrive(g, bean.armyId);
      expect(await getHero(g, hero2)).toMatchObject({ cityId: p.cityId, status: HeroStatus.IDLE });
    }));

  it('garrisons an own valley', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      const valley = await occupyValley(g, p, heroId);
      const bean = await send(g, p, { targetTileId: valley.id, mission: Mission.REINFORCE, troops: { lightCavalry: 100 }, heroId });
      await arrive(g, bean.armyId);
      expect(await armyRow(g, bean.armyId)).toMatchObject({ direction: ArmyDirection.STAY, troops: { lightCavalry: 100 } });
      expect((await getHero(g, heroId)).status).toBe(HeroStatus.ATTACK);
      expect(g.pushes(PushCmd.SELF_ARMIES_UPDATE).at(-1)?.data).toMatchObject({
        armys: [expect.objectContaining({ armyId: bean.armyId, direction: ArmyDirection.STAY })],
      });
    }));

  it('turns back from a valley no longer held', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      const valley = await occupyValley(g, p, heroId);
      const bean = await send(g, p, { targetTileId: valley.id, mission: Mission.REINFORCE, troops: { lightCavalry: 100 } });
      await combat.abandonValley(g, p.id, valley.id);
      await arrive(g, bean.armyId);
      expect((await armyRow(g, bean.armyId))!.direction).toBe(ArmyDirection.BACKWARD);
      expect((await lastReport(g, p.id, 'report.title.missionAborted')).body).toEqual({ kind: ReportBodyKind.TEXT, text: msg('army.valleyNoLongerHeld') });
    }));
});
