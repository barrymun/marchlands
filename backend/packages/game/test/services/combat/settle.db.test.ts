// processArmy for settlers (Mission.BUILD_CITY): a new city on free flat land.

import { describe, expect, it } from 'vitest';
import { ArmyDirection, BALANCE, BASIC_RESOURCES, HeroStatus, Mission, msg, TileType } from '@marchlands/core';
import { PushCmd } from '@marchlands/contracts';
import { admin, citiesOf, combat, getHero, getTile, reports } from '../../../src/index.ts';
import { armyRow, arrive, lastReport, NO_RESOURCES, reportTitles, send, tileNear, warrior } from '../../support/armies.ts';
import { addHero, reloadCity } from '../../support/factories.ts';
import { game } from '../../support/game.ts';

const goods = { ...NO_RESOURCES, ...Object.fromEntries(BASIC_RESOURCES.map((k) => [k, BALANCE.newCityMinResource])), gold: 500 };

describe(`${combat.processArmy.name}: settlers`, () => {
  it('found a city on the flat, with the goods, the troops and the hero as mayor', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      await admin.setPlayerFlags(g, p.name, { title: 1 });
      const flat = await tileNear(g, p.cityId, TileType.FLAT);
      const bean = await send(g, p, {
        targetTileId: flat.id,
        mission: Mission.BUILD_CITY,
        troops: { carriage: 10, lightCavalry: 5 },
        resources: goods,
        heroId,
      });
      await arrive(g, bean.armyId);

      expect(await armyRow(g, bean.armyId)).toBeUndefined();
      expect(g.events('army')).toEqual([]);
      const [, city] = await citiesOf(g, p.id);
      const name = `${p.name.slice(0, 12)} 2`;
      expect(city).toMatchObject({ name, playerId: p.id, tileId: flat.id, troops: { carriage: 10, lightCavalry: 5 }, ...goods });
      expect(await getTile(g, flat.id)).toMatchObject({ type: TileType.CASTLE, cityId: city.id, ownerPlayerId: p.id, ownerCityId: null });
      expect(await getHero(g, heroId)).toMatchObject({ cityId: city.id, status: HeroStatus.MAYOR });
      expect(g.pushes(PushCmd.CASTLE_UPDATE).at(-1)).toMatchObject({ playerIds: [p.id], data: { castleBean: expect.objectContaining({ id: city.id }) } });

      const report = await lastReport(g, p.id, 'report.title.newCityFounded');
      expect(report).toMatchObject({
        typeId: reports.ReportType.OTHER,
        armyType: Mission.BUILD_CITY,
        targetPos: msg('world.position.city', { name, x: flat.id % BALANCE.mapSize, y: Math.floor(flat.id / BALANCE.mapSize) }),
        body: { kind: 'text', text: msg('report.cityFounded', { name }) },
      });
    }));

  it('turn back when the land was taken first', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      await admin.setPlayerFlags(g, p.name, { title: 2 });
      const hero2 = await addHero(g, p);
      const flat = await tileNear(g, p.cityId, TileType.FLAT);
      const first = await send(g, p, { targetTileId: flat.id, mission: Mission.BUILD_CITY, troops: { carriage: 10 }, resources: goods, heroId });
      const second = await send(g, p, { targetTileId: flat.id, mission: Mission.BUILD_CITY, troops: { carriage: 10 }, resources: goods, heroId: hero2 });
      expect(second.reachTime).toBe(first.reachTime);
      await arrive(g, first.armyId); // both arrive, the first one settles

      expect(await citiesOf(g, p.id)).toHaveLength(2);
      expect(await armyRow(g, second.armyId)).toMatchObject({ direction: ArmyDirection.BACKWARD, resources: goods, troops: { carriage: 10 } });
      expect((await getHero(g, hero2)).status).toBe(HeroStatus.RETURN);
      expect((await lastReport(g, p.id, 'report.title.missionAborted')).body).toEqual({ kind: 'text', text: msg('army.landNotFree') });

      await arrive(g, second.armyId);
      expect(await getHero(g, hero2)).toMatchObject({ status: HeroStatus.IDLE, cityId: p.cityId });
      expect((await reportTitles(g, p.id)).at(-1)).toBe('report.title.returned');
      expect((await reloadCity(g, p.cityId)).troops.carriage).toBe(10);
    }));

  it('turn back when the lord may no longer have another city', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      await admin.setPlayerFlags(g, p.name, { title: 1 });
      const flat = await tileNear(g, p.cityId, TileType.FLAT);
      const bean = await send(g, p, { targetTileId: flat.id, mission: Mission.BUILD_CITY, troops: { carriage: 10 }, resources: goods, heroId });
      await admin.setPlayerFlags(g, p.name, { title: 0 });
      await arrive(g, bean.armyId);
      expect(await citiesOf(g, p.id)).toHaveLength(1);
      expect((await getTile(g, flat.id)).type).toBe(TileType.FLAT);
      expect((await armyRow(g, bean.armyId))!.direction).toBe(ArmyDirection.BACKWARD);
      expect((await lastReport(g, p.id, 'report.title.missionAborted')).body).toEqual({ kind: 'text', text: msg('army.cityLimit') });
    }));
});
