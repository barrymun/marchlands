import { describe, expect, it } from 'vitest';
import {
  armyLoad,
  ArmyDirection,
  BALANCE,
  BASIC_RESOURCES,
  BuildingType,
  DAY,
  HeroStatus,
  ItemId,
  marchTimeMs,
  maxArmyTroops,
  Mission,
  msg,
  ref,
  reliefMultiplier,
  TechType,
  TileType,
  tileXY,
  TroopType,
} from '@marchlands/core';
import { PushCmd } from '@marchlands/contracts';
import { admin, armies, getHero, getTile, interior, player, shop, type ArmyRow } from '../../src/index.ts';
import { allies, armyRow, arrive, lastReport, NO_RESOURCES, send, tileNear, valleyNear, WAR_ZONE, warCity, warrior } from '../support/armies.ts';
import { expectRefused } from '../support/expect.ts';
import { addHero, cityBundle, createTestPlayer, giveItems, reloadCity, setBuildings, setCityStats, setResearch, setResources } from '../support/factories.ts';
import { game, type TestGame } from '../support/game.ts';

const lastPush = (g: TestGame, cmd: PushCmd, playerId: number) =>
  g
    .pushes(cmd)
    .filter((x) => x.playerIds.includes(playerId))
    .at(-1);

describe(armies.tilePosition.name, () => {
  it('names a city by its name, a valley or barbarian city by type and level, flat land by type', () =>
    game(async (g) => {
      const { p } = await warrior(g);
      const city = await reloadCity(g, p.cityId);
      expect(await armies.tilePosition(g, await getTile(g, city.tileId))).toEqual(armies.cityPosition(city.name, city.tileId));
      const npc = await tileNear(g, p.cityId, TileType.NPC);
      expect(await armies.tilePosition(g, npc)).toEqual(msg('world.position.tile', { tile: ref.tile(TileType.NPC), level: npc.level, ...tileXY(npc.id) }));
      const valley = await valleyNear(g, p.cityId);
      expect(await armies.tilePosition(g, valley)).toEqual(
        msg('world.position.tile', { tile: ref.tile(valley.type), level: valley.level, ...tileXY(valley.id) }),
      );
      const flat = await tileNear(g, p.cityId, TileType.FLAT);
      expect(await armies.tilePosition(g, flat)).toEqual(msg('world.position.place', { tile: ref.tile(TileType.FLAT), ...tileXY(flat.id) }));
    }));
});

describe(armies.tileOwner.name, () => {
  it('is the owner of the city standing there, or nobody on free land', () =>
    game(async (g) => {
      const { p } = await warrior(g);
      const city = await reloadCity(g, p.cityId);
      expect(await armies.tileOwner(g, await getTile(g, city.tileId))).toBe(p.id);
      expect(await armies.tileOwner(g, await tileNear(g, p.cityId, TileType.NPC))).toBeNull();
      expect(await armies.tileOwner(g, await valleyNear(g, p.cityId))).toBeNull();
    }));

  it('is the occupier of a valley', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g, { lightCavalry: 40_000 });
      const valley = await valleyNear(g, p.cityId, { level: 1 });
      const a = await send(g, p, { targetTileId: valley.id, mission: Mission.ATTACK, troops: { lightCavalry: 40_000 }, heroId });
      await arrive(g, a.armyId);
      expect(await armies.tileOwner(g, await getTile(g, valley.id))).toBe(p.id);
    }));
});

describe(armies.armyMarchMs.name, () => {
  it('is the march time of the slowest troop', () =>
    game(async (g) => {
      const { p } = await warrior(g);
      const b = await cityBundle(g, p);
      const npc = await tileNear(g, p.cityId, TileType.NPC);
      const troops = { lightCavalry: 10, archer: 1 };
      expect(armies.armyMarchMs(b, b.city.tileId, npc.id, troops, false)).toBe(marchTimeMs(b.city.tileId, npc.id, troops, b.player.research, b.city.buildings));
    }));

  it('a Relief Station speeds up marches between own places only', () =>
    game(async (g) => {
      const { p } = await warrior(g);
      await setBuildings(g, p, [[5, BuildingType.RELIEF_STATION, 4]]);
      const b = await cityBundle(g, p);
      const npc = await tileNear(g, p.cityId, TileType.NPC);
      const troops = { archer: 1 };
      const ms = marchTimeMs(b.city.tileId, npc.id, troops, b.player.research, b.city.buildings);
      expect(armies.armyMarchMs(b, b.city.tileId, npc.id, troops, false)).toBe(ms);
      expect(armies.armyMarchMs(b, b.city.tileId, npc.id, troops, true)).toBe(Math.max(1000, Math.floor(ms / reliefMultiplier(b.city.buildings))));
      // never under a second
      expect(armies.armyMarchMs(b, b.city.tileId, b.city.tileId + 1, { scouter: 1 }, true)).toBeGreaterThanOrEqual(1000);
    }));
});

describe(armies.sendArmy.name, () => {
  it('sends an attack: troops leave the city, the hero marches, the arrival is scheduled', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      const npc = await tileNear(g, p.cityId, TileType.NPC);
      const before = await cityBundle(g, p);
      const troops = { lightCavalry: 1000, scouter: 10 };
      const bean = await send(g, p, { targetTileId: npc.id, mission: Mission.ATTACK, troops, heroId });

      const ms = marchTimeMs(before.city.tileId, npc.id, troops, before.player.research, before.city.buildings);
      const hero = await getHero(g, heroId);
      expect(bean).toMatchObject({
        playerId: p.id,
        cityId: p.cityId,
        king: p.name,
        hero: hero.name,
        heroLevel: hero.level,
        heroId,
        missionType: Mission.ATTACK,
        direction: ArmyDirection.FORWARD,
        startFieldId: before.city.tileId,
        targetFieldId: npc.id,
        startTime: g.now,
        reachTime: g.now + ms,
        restTime: 0,
        startPosName: armies.cityPosition(before.city.name, before.city.tileId),
        targetPosName: await armies.tilePosition(g, npc),
      });
      const row = (await armyRow(g, bean.armyId))!;
      expect(row).toMatchObject({ troops, resources: NO_RESOURCES, targetPlayerId: null, heroId });
      const city = await reloadCity(g, p.cityId);
      expect(city.troops.lightCavalry).toBe(before.city.troops.lightCavalry! - 1000);
      expect(city.troops.scouter).toBe(before.city.troops.scouter! - 10);
      expect(hero.status).toBe(HeroStatus.ATTACK);
      expect(g.events('army')).toEqual([
        expect.objectContaining({ dueAt: g.now + ms, playerId: p.id, cityId: p.cityId, refKey: armies.armyRef(bean.armyId), payload: { armyId: bean.armyId } }),
      ]);
      expect(lastPush(g, PushCmd.TROOP_UPDATE, p.id)?.data).toMatchObject({ castleId: p.cityId });
      expect(lastPush(g, PushCmd.SELF_ARMIES_UPDATE, p.id)?.data).toMatchObject({ armys: [expect.objectContaining({ armyId: bean.armyId })] });
      expect(lastPush(g, PushCmd.HERO_UPDATE, p.id)).toBeDefined();
      expect(lastPush(g, PushCmd.RESOURCE_UPDATE, p.id)).toBeDefined();
    }));

  it('carries resources out of the city', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      await setResources(g, p, { gold: 5000, food: 5000 });
      const npc = await tileNear(g, p.cityId, TileType.NPC);
      const bean = await send(g, p, {
        targetTileId: npc.id,
        mission: Mission.ATTACK,
        troops: { lightCavalry: 100 },
        heroId,
        resources: { gold: 1000, food: 2000 },
      });
      expect(bean.resource).toEqual({ ...NO_RESOURCES, gold: 1000, food: 2000 });
      const city = await reloadCity(g, p.cityId);
      expect(city.gold).toBeCloseTo(4000, 0);
      expect(city.food).toBeCloseTo(3000, 0);
    }));

  it('keeps the camping time within 0 and the maximum', () =>
    game(async (g) => {
      const { p } = await warrior(g);
      const valley = await valleyNear(g, p.cityId);
      const long = await send(g, p, { targetTileId: valley.id, mission: Mission.SCOUT, troops: { scouter: 1 }, restTime: 10 * DAY });
      expect(long.restTime).toBe(BALANCE.maxRestTimeMs);
      const short = await send(g, p, { targetTileId: valley.id, mission: Mission.SCOUT, troops: { scouter: 1 }, restTime: 90.7 });
      expect(short.restTime).toBe(90_000);
      const negative = await send(g, p, { targetTileId: valley.id, mission: Mission.SCOUT, troops: { scouter: 1 }, restTime: -5 });
      expect(negative.restTime).toBe(0);
    }));

  it('marches between own places faster with a Relief Station', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g, { lightCavalry: 40_000 });
      await setBuildings(g, p, [[5, BuildingType.RELIEF_STATION, 10]]);
      const valley = await valleyNear(g, p.cityId, { level: 1 });
      const a = await send(g, p, { targetTileId: valley.id, mission: Mission.ATTACK, troops: { lightCavalry: 40_000 }, heroId });
      const b = await cityBundle(g, p);
      const ms = marchTimeMs(b.city.tileId, valley.id, { lightCavalry: 1 }, b.player.research, b.city.buildings);
      expect(a.reachTime - a.startTime).toBe(ms); // the valley is not ours yet
      await arrive(g, a.armyId);
      await arrive(g, a.armyId);
      const r = await send(g, p, { targetTileId: valley.id, mission: Mission.REINFORCE, troops: { lightCavalry: 1 } });
      expect(r.reachTime - r.startTime).toBe(Math.max(1000, Math.floor(ms / reliefMultiplier(b.city.buildings))));
    }));

  it('tells the defender an army is coming', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      const { p: q } = await warrior(g);
      const target = await reloadCity(g, q.cityId);
      const bean = await send(g, p, { targetTileId: target.tileId, mission: Mission.ATTACK, troops: { lightCavalry: 10 }, heroId });
      expect((await armyRow(g, bean.armyId))!.targetPlayerId).toBe(q.id);
      expect(lastPush(g, PushCmd.ENEMY_ARMIES_UPDATE, q.id)?.data).toMatchObject({ armys: [expect.objectContaining({ armyId: bean.armyId })] });
    }));

  describe('refusals', () => {
    it('an unknown mission, bad troops or troops the city does not have', () =>
      game(async (g) => {
        const { p, heroId } = await warrior(g);
        const npc = await tileNear(g, p.cityId, TileType.NPC);
        const base = { targetTileId: npc.id, heroId };
        await expectRefused(send(g, p, { ...base, mission: 6, troops: { lightCavalry: 1 } }), msg('army.invalidMission'));
        await expectRefused(send(g, p, { ...base, mission: 0, troops: { lightCavalry: 1 } }), msg('army.invalidMission'));
        await expectRefused(send(g, p, { ...base, mission: Mission.ATTACK, troops: { dragons: 1 } }), msg('common.unknownTroopType', { key: 'dragons' }));
        await expectRefused(send(g, p, { ...base, mission: Mission.ATTACK, troops: { archer: 1.5 } }), msg('common.invalidTroopCount'));
        await expectRefused(send(g, p, { ...base, mission: Mission.ATTACK, troops: {} }), msg('common.noTroopsSelected'));
        await expectRefused(send(g, p, { ...base, mission: Mission.ATTACK, troops: { archer: 1 } }), msg('army.insufficientTroops'));
        await expectRefused(send(g, p, { ...base, mission: Mission.ATTACK, troops: { lightCavalry: 5001 } }), msg('army.insufficientTroops'));
        await expectRefused(
          send(g, p, { ...base, mission: Mission.ATTACK, troops: { lightCavalry: 1 }, resources: { gold: -1 } }),
          msg('common.invalidAmount'),
        );
        await expectRefused(
          send(g, p, { ...base, mission: Mission.ATTACK, troops: { lightCavalry: 1 }, resources: { gold: NaN } }),
          msg('common.invalidAmount'),
        );
        expect(g.events('army')).toHaveLength(0);
      }));

    it('more resources than the troops can carry', () =>
      game(async (g) => {
        const { p, heroId } = await warrior(g);
        const npc = await tileNear(g, p.cityId, TileType.NPC);
        const load = armyLoad({ lightCavalry: 10 }, {});
        await send(g, p, { targetTileId: npc.id, mission: Mission.ATTACK, troops: { lightCavalry: 10 }, heroId, resources: { food: load } });
        await expectRefused(
          send(g, p, { targetTileId: npc.id, mission: Mission.ATTACK, troops: { lightCavalry: 10 }, heroId, resources: { food: load, gold: 1 } }),
          msg('army.overloaded'),
        );
      }));

    it('resources the city does not have', () =>
      game(async (g) => {
        const { p, heroId } = await warrior(g);
        await setResources(g, p, { gold: 10 });
        const npc = await tileNear(g, p.cityId, TileType.NPC);
        await expectRefused(
          send(g, p, { targetTileId: npc.id, mission: Mission.ATTACK, troops: { lightCavalry: 10 }, heroId, resources: { gold: 500 } }),
          msg('common.notEnoughResources'),
        );
      }));

    it('no Rally Spot, too many armies out, too many troops in one army', () =>
      game(async (g) => {
        const { p, heroId } = await warrior(g, { lightCavalry: 20_000, scouter: 100 });
        const npc = await tileNear(g, p.cityId, TileType.NPC);
        const rally = ref.building(BuildingType.RALLY_SPOT);
        await setBuildings(g, p, [[0, BuildingType.RALLY_SPOT, 0]]);
        await expectRefused(
          send(g, p, { targetTileId: npc.id, mission: Mission.SCOUT, troops: { scouter: 1 } }),
          msg('army.rallySpotRequired', { building: rally }),
        );

        await setBuildings(g, p, [[0, BuildingType.RALLY_SPOT, 1]]);
        const cap = BALANCE.rallySpotTroopsPerLevel;
        await expectRefused(
          send(g, p, { targetTileId: npc.id, mission: Mission.ATTACK, troops: { lightCavalry: cap + 1 }, heroId }),
          msg('army.troopLimit', { building: rally, level: 1, count: cap }),
        );
        await send(g, p, { targetTileId: npc.id, mission: Mission.ATTACK, troops: { lightCavalry: cap }, heroId });
        await expectRefused(
          send(g, p, { targetTileId: npc.id, mission: Mission.SCOUT, troops: { scouter: 1 } }),
          msg('army.armyLimit', { building: rally, count: BALANCE.rallySpotArmiesPerLevel }),
        );
      }));

    it('a War Ensign raises the troop limit', () =>
      game(async (g) => {
        const { p, heroId } = await warrior(g, { lightCavalry: 20_000 });
        await setBuildings(g, p, [[0, BuildingType.RALLY_SPOT, 1]]);
        await giveItems(g, p, { [ItemId.WAR_ENSIGN]: 1 });
        await shop.useItem(g, p.id, ItemId.WAR_ENSIGN, p.cityId);
        const b = await cityBundle(g, p);
        const cap = maxArmyTroops(b.city.buildings, true);
        expect(cap).toBeGreaterThan(maxArmyTroops(b.city.buildings));
        const npc = await tileNear(g, p.cityId, TileType.NPC);
        await expectRefused(
          send(g, p, { targetTileId: npc.id, mission: Mission.ATTACK, troops: { lightCavalry: cap + 1 }, heroId }),
          msg('army.troopLimit', { building: ref.building(BuildingType.RALLY_SPOT), level: 1, count: cap }),
        );
        await send(g, p, { targetTileId: npc.id, mission: Mission.ATTACK, troops: { lightCavalry: cap }, heroId });
      }));

    it('its own city, or an unknown tile', () =>
      game(async (g) => {
        const { p, heroId } = await warrior(g);
        const city = await reloadCity(g, p.cityId);
        await expectRefused(send(g, p, { targetTileId: city.tileId, mission: Mission.ATTACK, troops: { lightCavalry: 1 }, heroId }), msg('army.invalidTarget'));
        await expectRefused(send(g, p, { targetTileId: -5, mission: Mission.ATTACK, troops: { lightCavalry: 1 }, heroId }), msg('common.invalidCoordinates'));
      }));

    it('heroes: attacks and settlers need one, idle and of this city', () =>
      game(async (g) => {
        const { p, heroId } = await warrior(g);
        const { p: q, heroId: otherHero } = await warrior(g);
        const npc = await tileNear(g, p.cityId, TileType.NPC);
        const attack = { targetTileId: npc.id, mission: Mission.ATTACK, troops: { lightCavalry: 1 } };
        await expectRefused(send(g, p, attack), msg('army.heroRequiredAttack'));
        await expectRefused(send(g, p, { ...attack, heroId: -1 }), msg('army.heroRequiredAttack'));
        await expectRefused(send(g, p, { ...attack, heroId: otherHero }), msg('common.heroNotFound'));
        await send(g, p, { ...attack, heroId });
        await expectRefused(send(g, p, { ...attack, heroId }), msg('hero.notIdle'));
        // scouting goes without one
        await send(g, q, { targetTileId: npc.id, mission: Mission.SCOUT, troops: { scouter: 1 } });
      }));

    it('transport: only to a friendly city, with resources', () =>
      game(async (g) => {
        const { p } = await warrior(g);
        const { p: q } = await warrior(g);
        const { p: r } = await warrior(g);
        await allies(g, p, q);
        const npc = await tileNear(g, p.cityId, TileType.NPC);
        const allyCity = await reloadCity(g, q.cityId);
        const strangerCity = await reloadCity(g, r.cityId);
        const goods = { troops: { carriage: 1 }, resources: { food: 100 } };
        await expectRefused(send(g, p, { targetTileId: npc.id, mission: Mission.TRANSPORT, ...goods }), msg('army.transportTarget'));
        await expectRefused(send(g, p, { targetTileId: strangerCity.tileId, mission: Mission.TRANSPORT, ...goods }), msg('army.transportTarget'));
        await expectRefused(send(g, p, { targetTileId: allyCity.tileId, mission: Mission.TRANSPORT, troops: { carriage: 1 } }), msg('army.noResources'));
        const bean = await send(g, p, { targetTileId: allyCity.tileId, mission: Mission.TRANSPORT, ...goods });
        expect(bean.resource).toMatchObject({ food: 100 });
      }));

    it('reinforce: only friendly cities that accept allied troops, and own valleys', () =>
      game(async (g) => {
        const { p } = await warrior(g, { lightCavalry: 40_000 });
        const { p: q } = await warrior(g);
        const { p: r } = await warrior(g);
        await allies(g, p, q);
        const allyCity = await reloadCity(g, q.cityId);
        const strangerCity = await reloadCity(g, r.cityId);
        const valley = await valleyNear(g, p.cityId, { level: 1 });
        const one = { troops: { lightCavalry: 1 } };
        await expectRefused(send(g, p, { targetTileId: strangerCity.tileId, mission: Mission.REINFORCE, ...one }), msg('army.reinforceTarget'));
        await expectRefused(send(g, p, { targetTileId: valley.id, mission: Mission.REINFORCE, ...one }), msg('army.reinforceTarget'));
        await expectRefused(send(g, p, { targetTileId: allyCity.tileId, mission: Mission.REINFORCE, ...one }), msg('army.alliedTroopsRefused'));
        await interior.setCityFlags(g, q.id, q.cityId, { allowAlliance: true });
        await send(g, p, { targetTileId: allyCity.tileId, mission: Mission.REINFORCE, ...one });

        // an ally's valley is not ours to garrison
        const qHero = await addHero(g, q);
        await setResources(g, q, { food: 1e7 });
        await setCityStats(g, q, { troops: { lightCavalry: 40_000 } });
        const qValley = await valleyNear(g, q.cityId, { level: 1 });
        const a = await send(g, q, { targetTileId: qValley.id, mission: Mission.ATTACK, troops: { lightCavalry: 40_000 }, heroId: qHero });
        await arrive(g, a.armyId);
        await expectRefused(send(g, p, { targetTileId: qValley.id, mission: Mission.REINFORCE, ...one }), msg('army.reinforceTarget'));
      }));

    it('scout and attack: scouts needed, not friends, not protected players, not flat land', () =>
      game(async (g) => {
        const { p, heroId } = await warrior(g);
        const { p: q } = await warrior(g);
        const { p: r } = await warrior(g);
        await allies(g, p, q);
        const allyCity = await reloadCity(g, q.cityId);
        const enemyCity = await reloadCity(g, r.cityId);
        const npc = await tileNear(g, p.cityId, TileType.NPC);
        const flat = await tileNear(g, p.cityId, TileType.FLAT);
        await expectRefused(
          send(g, p, { targetTileId: npc.id, mission: Mission.SCOUT, troops: { lightCavalry: 1 } }),
          msg('army.scoutsRequired', { troop: ref.troop(TroopType.SCOUT) }),
        );
        await expectRefused(send(g, p, { targetTileId: allyCity.tileId, mission: Mission.SCOUT, troops: { scouter: 1 } }), msg('army.invalidTarget'));
        await expectRefused(
          send(g, p, { targetTileId: allyCity.tileId, mission: Mission.ATTACK, troops: { lightCavalry: 1 }, heroId }),
          msg('army.invalidTarget'),
        );
        await expectRefused(send(g, p, { targetTileId: flat.id, mission: Mission.SCOUT, troops: { scouter: 1 } }), msg('army.nothingToAttack'));
        await expectRefused(send(g, p, { targetTileId: flat.id, mission: Mission.ATTACK, troops: { lightCavalry: 1 }, heroId }), msg('army.nothingToAttack'));

        // the target under beginner protection, or a truce
        await admin.setPlayerFlags(g, r.name, { beginner: true });
        await expectRefused(send(g, p, { targetTileId: enemyCity.tileId, mission: Mission.SCOUT, troops: { scouter: 1 } }), msg('player.protected.beginner'));
        await admin.setPlayerFlags(g, r.name, { beginner: false });
        await giveItems(g, r, { [ItemId.TRUCE_AGREEMENT]: 1 });
        await player.startTruce(g, r.id, ItemId.TRUCE_AGREEMENT, r.cityId);
        await expectRefused(
          send(g, p, { targetTileId: enemyCity.tileId, mission: Mission.ATTACK, troops: { lightCavalry: 1 }, heroId }),
          msg('player.protected.truce'),
        );
      }));

    it('a player under beginner protection or a truce may not attack', () =>
      game(async (g) => {
        const { p } = await warrior(g);
        const q = await createTestPlayer(g, { zone: WAR_ZONE });
        await warCity(g, q, { troops: { scouter: 10 }, beginner: true });
        const target = await reloadCity(g, p.cityId);
        await expectRefused(
          send(g, q, { targetTileId: target.tileId, mission: Mission.SCOUT, troops: { scouter: 1 } }),
          msg('army.beginnerProtection', {
            count: Math.round(BALANCE.beginnerProtectionMs / DAY),
            building: ref.building(BuildingType.TOWN_HALL),
            level: BALANCE.beginnerTownHallLevel,
          }),
        );
        // barbarian cities and valleys are fine for beginners
        const npc = await tileNear(g, q.cityId, TileType.NPC);
        await send(g, q, { targetTileId: npc.id, mission: Mission.SCOUT, troops: { scouter: 1 } });

        await giveItems(g, p, { [ItemId.TRUCE_AGREEMENT]: 1 });
        await player.startTruce(g, p.id, ItemId.TRUCE_AGREEMENT, p.cityId);
        const npc2 = await tileNear(g, p.cityId, TileType.NPC);
        await expectRefused(send(g, p, { targetTileId: npc2.id, mission: Mission.SCOUT, troops: { scouter: 1 } }), msg('army.truce'));
      }));

    it('settlers: flat free land, a free city slot, enough resources and a hero', () =>
      game(async (g) => {
        const { p, heroId } = await warrior(g);
        const npc = await tileNear(g, p.cityId, TileType.NPC);
        const [flat, flat2] = [await tileNear(g, p.cityId, TileType.FLAT), await tileNear(g, p.cityId, TileType.FLAT, { skip: 1 })];
        const goods = Object.fromEntries(BASIC_RESOURCES.map((k) => [k, BALANCE.newCityMinResource]));
        const settlers = { mission: Mission.BUILD_CITY, troops: { carriage: 10 }, resources: goods, heroId };
        await expectRefused(send(g, p, { ...settlers, targetTileId: npc.id }), msg('army.buildOnFlat'));
        await expectRefused(send(g, p, { ...settlers, targetTileId: flat.id }), msg('army.cityLimit'));
        await admin.setPlayerFlags(g, p.name, { title: 1 });
        await expectRefused(
          send(g, p, { ...settlers, targetTileId: flat.id, resources: { ...goods, iron: BALANCE.newCityMinResource - 1 } }),
          msg('army.newCityResources', { amount: BALANCE.newCityMinResource, resources: BASIC_RESOURCES.map((k) => ref.resource(k)) }),
        );
        await expectRefused(send(g, p, { ...settlers, targetTileId: flat.id, heroId: undefined }), msg('army.heroRequiredSettlers'));
        await send(g, p, { ...settlers, targetTileId: flat.id });
        // settlers on their way count against the city limit
        const otherHero = await addHero(g, p);
        await expectRefused(send(g, p, { ...settlers, targetTileId: flat2.id, heroId: otherHero }), msg('army.cityLimit'));
      }));
  });
});

describe(armies.notifyArmyParties.name, () => {
  it('pushes fresh army lists to the sender and the target player', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      const { p: q } = await warrior(g);
      const target = await reloadCity(g, q.cityId);
      const bean = await send(g, p, { targetTileId: target.tileId, mission: Mission.ATTACK, troops: { lightCavalry: 10 }, heroId });
      g._pushes.length = 0;
      await armies.notifyArmyParties(g, { playerId: p.id, targetPlayerId: q.id });
      for (const cmd of [PushCmd.SELF_ARMIES_UPDATE, PushCmd.FRIEND_ARMIES_UPDATE, PushCmd.ENEMY_ARMIES_UPDATE]) {
        expect(g.pushes(cmd).map((x) => x.playerIds)).toEqual([[p.id], [q.id]]);
      }
      expect(lastPush(g, PushCmd.SELF_ARMIES_UPDATE, p.id)?.data).toEqual({ armys: [expect.objectContaining({ armyId: bean.armyId })] });
      expect(lastPush(g, PushCmd.ENEMY_ARMIES_UPDATE, q.id)?.data).toEqual({ armys: [expect.objectContaining({ armyId: bean.armyId })] });
    }));

  it('pushes once when there is no target player', () =>
    game(async (g) => {
      const { p } = await warrior(g);
      await armies.notifyArmyParties(g, { playerId: p.id, targetPlayerId: null });
      await armies.notifyArmyParties(g, { playerId: p.id, targetPlayerId: p.id });
      expect(g.pushes(PushCmd.SELF_ARMIES_UPDATE)).toHaveLength(2);
    }));
});

describe(armies.sendBack.name, () => {
  it('turns the army around towards home, its hero returning', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      const npc = await tileNear(g, p.cityId, TileType.NPC);
      const bean = await send(g, p, { targetTileId: npc.id, mission: Mission.ATTACK, troops: { lightCavalry: 10 }, heroId, restTime: 60 });
      g.advance(5000);
      const a = (await armyRow(g, bean.armyId)) as ArmyRow;
      await armies.sendBack(g, a, 7000);
      expect(await armyRow(g, bean.armyId)).toMatchObject({ direction: ArmyDirection.BACKWARD, startTime: g.now, reachTime: g.now + 7000, restTime: 0 });
      expect((await getHero(g, heroId)).status).toBe(HeroStatus.RETURN);
      expect(g.events('army')).toEqual([expect.objectContaining({ dueAt: g.now + 7000, refKey: armies.armyRef(bean.armyId) })]);
      // never under a second
      await armies.sendBack(g, a, 0);
      expect((await armyRow(g, bean.armyId))!.reachTime).toBe(g.now + 1000);
    }));
});

describe(armies.homeMarchMs.name, () => {
  it('is the march from a tile back to the home city', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      await setResearch(g, p, TechType.HORSEBACK_RIDING, 3);
      await setBuildings(g, p, [[6, BuildingType.ACADEMY, 5]]);
      const npc = await tileNear(g, p.cityId, TileType.NPC);
      const bean = await send(g, p, { targetTileId: npc.id, mission: Mission.ATTACK, troops: { lightCavalry: 10 }, heroId });
      const a = (await armyRow(g, bean.armyId))!;
      const b = await cityBundle(g, p);
      expect(await armies.homeMarchMs(g, a, npc.id)).toBe(marchTimeMs(npc.id, b.city.tileId, a.troops, b.player.research, b.city.buildings));
    }));

  it('is a second when the home city is gone', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      const npc = await tileNear(g, p.cityId, TileType.NPC);
      const bean = await send(g, p, { targetTileId: npc.id, mission: Mission.ATTACK, troops: { lightCavalry: 10 }, heroId });
      const a = (await armyRow(g, bean.armyId))!;
      expect(await armies.homeMarchMs(g, { ...a, cityId: 2_000_000_000 }, npc.id)).toBe(1000);
    }));
});

describe(armies.recallArmy.name, () => {
  it('a marching army walks back the way it came, and gets home', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      const npc = await tileNear(g, p.cityId, TileType.NPC);
      const bean = await send(g, p, { targetTileId: npc.id, mission: Mission.ATTACK, troops: { lightCavalry: 10 }, heroId });
      g.advance(30_000);
      const back = await armies.recallArmy(g, p.id, bean.armyId);
      expect(back).toMatchObject({ armyId: bean.armyId, direction: ArmyDirection.BACKWARD, startTime: g.now, reachTime: g.now + 30_000 });
      expect((await getHero(g, heroId)).status).toBe(HeroStatus.RETURN);
      expect(g.pushes(PushCmd.SELF_ARMIES_UPDATE).length).toBeGreaterThan(0);

      await arrive(g, bean.armyId);
      expect(await armyRow(g, bean.armyId)).toBeUndefined();
      expect((await reloadCity(g, p.cityId)).troops.lightCavalry).toBe(5000);
      const hero = await getHero(g, heroId);
      expect(hero).toMatchObject({ status: HeroStatus.IDLE, cityId: p.cityId, experience: 0 });
      const report = await lastReport(g, p.id, 'report.title.attackReturned');
      expect(report).toMatchObject({ isBack: true, armyType: Mission.ATTACK, targetPos: bean.startPosName, startPos: bean.targetPosName });
    }));

  it('recalled at once, it takes a second to get back', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      const npc = await tileNear(g, p.cityId, TileType.NPC);
      const bean = await send(g, p, { targetTileId: npc.id, mission: Mission.ATTACK, troops: { lightCavalry: 10 }, heroId });
      expect((await armies.recallArmy(g, p.id, bean.armyId)).reachTime).toBe(g.now + 1000);
    }));

  it('a stationed army marches home from where it camps', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g, { lightCavalry: 40_000 });
      const valley = await valleyNear(g, p.cityId, { level: 1 });
      const a = await send(g, p, { targetTileId: valley.id, mission: Mission.ATTACK, troops: { lightCavalry: 40_000 }, heroId });
      await arrive(g, a.armyId);
      await arrive(g, a.armyId);
      const r = await send(g, p, { targetTileId: valley.id, mission: Mission.REINFORCE, troops: { lightCavalry: 100 } });
      await arrive(g, r.armyId);
      const camp = (await armyRow(g, r.armyId))!;
      expect(camp.direction).toBe(ArmyDirection.STAY);
      g.advance(3_600_000);
      const back = await armies.recallArmy(g, p.id, r.armyId);
      expect(back.reachTime - g.now).toBe(await armies.homeMarchMs(g, camp, valley.id));
    }));

  it('refuses armies that are not ours, unknown, or already coming back', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      const { p: q } = await warrior(g);
      const npc = await tileNear(g, p.cityId, TileType.NPC);
      const bean = await send(g, p, { targetTileId: npc.id, mission: Mission.ATTACK, troops: { lightCavalry: 10 }, heroId });
      await expectRefused(armies.recallArmy(g, q.id, bean.armyId), msg('army.notFound'));
      await expectRefused(armies.recallArmy(g, p.id, 2_000_000_000), msg('army.notFound'));
      await armies.recallArmy(g, p.id, bean.armyId);
      await expectRefused(armies.recallArmy(g, p.id, bean.armyId), msg('army.alreadyReturning'));
    }));
});

/** p reinforces its ally q's city (which accepts allied troops); returns the stationed army's id. */
async function stationAtAlly(g: TestGame) {
  const { p, heroId } = await warrior(g);
  const { p: q } = await warrior(g);
  await allies(g, p, q);
  await interior.setCityFlags(g, q.id, q.cityId, { allowAlliance: true });
  const host = await reloadCity(g, q.cityId);
  const bean = await send(g, p, { targetTileId: host.tileId, mission: Mission.REINFORCE, troops: { lightCavalry: 100 }, heroId });
  await arrive(g, bean.armyId);
  return { p, q, heroId, armyId: bean.armyId };
}

describe(armies.dismissGuest.name, () => {
  it('the host sends allied troops stationed in the city home', () =>
    game(async (g) => {
      const { p, q, heroId, armyId } = await stationAtAlly(g);
      const camp = (await armyRow(g, armyId))!;
      expect(camp.direction).toBe(ArmyDirection.STAY);
      await armies.dismissGuest(g, q.id, armyId);
      expect(await armyRow(g, armyId)).toMatchObject({
        direction: ArmyDirection.BACKWARD,
        reachTime: g.now + (await armies.homeMarchMs(g, camp, camp.targetTileId)),
      });
      expect((await getHero(g, heroId)).status).toBe(HeroStatus.RETURN);
      await arrive(g, armyId);
      expect(await armyRow(g, armyId)).toBeUndefined();
      expect((await reloadCity(g, p.cityId)).troops.lightCavalry).toBe(5000);
    }));

  it('refuses armies that are not guests of the host', () =>
    game(async (g) => {
      const { p, q, armyId } = await stationAtAlly(g);
      await expectRefused(armies.dismissGuest(g, p.id, armyId), msg('army.notFound'));
      await expectRefused(armies.dismissGuest(g, q.id, 2_000_000_000), msg('army.notFound'));
      // marching, not stationed yet
      const host = await reloadCity(g, q.cityId);
      const marching = await send(g, p, { targetTileId: host.tileId, mission: Mission.REINFORCE, troops: { lightCavalry: 1 } });
      await expectRefused(armies.dismissGuest(g, q.id, marching.armyId), msg('army.notFound'));
      // the host's own garrison in a valley is not a guest
      const qHero = await addHero(g, q);
      await setCityStats(g, q, { troops: { lightCavalry: 40_000 } });
      const valley = await valleyNear(g, q.cityId, { level: 1 });
      const a = await send(g, q, { targetTileId: valley.id, mission: Mission.ATTACK, troops: { lightCavalry: 40_000 }, heroId: qHero });
      await arrive(g, a.armyId);
      await arrive(g, a.armyId);
      const own = await send(g, q, { targetTileId: valley.id, mission: Mission.REINFORCE, troops: { lightCavalry: 1 } });
      await arrive(g, own.armyId);
      await expectRefused(armies.dismissGuest(g, q.id, own.armyId), msg('army.notFound'));
    }));
});

describe(armies.troopParams.name, () => {
  it('reports the research, Relief Station and Rally Spot parameters', () =>
    game(async (g) => {
      const { p } = await warrior(g);
      await setResearch(g, p, TechType.COMPASS, 2);
      await setResearch(g, p, TechType.LOGISTICS, 3);
      await setResearch(g, p, TechType.HORSEBACK_RIDING, 4);
      await setBuildings(g, p, [[5, BuildingType.RELIEF_STATION, 5]]);
      const b = await cityBundle(g, p);
      expect(await armies.troopParams(g, p.id, p.cityId)).toEqual({
        marchSkillParam: 2 * BALANCE.compassSpeedPerLevel,
        loadSkillParam: 3 * BALANCE.logisticsLoadPerLevel,
        driveSkillParam: 4 * BALANCE.horsebackSpeedPerLevel,
        transportStationParam: reliefMultiplier(b.city.buildings),
        maxArmies: 10 * BALANCE.rallySpotArmiesPerLevel,
        maxTroops: 10 * BALANCE.rallySpotTroopsPerLevel,
      });
    }));

  it('counts a running War Ensign in the troop limit', () =>
    game(async (g) => {
      const { p } = await warrior(g);
      await giveItems(g, p, { [ItemId.WAR_ENSIGN]: 1 });
      await shop.useItem(g, p.id, ItemId.WAR_ENSIGN, p.cityId);
      const b = await cityBundle(g, p);
      expect((await armies.troopParams(g, p.id, p.cityId)).maxTroops).toBe(maxArmyTroops(b.city.buildings, true));
    }));

  it('only for own cities', () =>
    game(async (g) => {
      const { p } = await warrior(g);
      const { p: q } = await warrior(g);
      await expectRefused(armies.troopParams(g, q.id, p.cityId), msg('common.invalidCastle'));
    }));
});

describe(armies.marchEstimate.name, () => {
  it('previews the march time and load', () =>
    game(async (g) => {
      const { p } = await warrior(g);
      await setResearch(g, p, TechType.LOGISTICS, 2);
      const b = await cityBundle(g, p);
      const npc = await tileNear(g, p.cityId, TileType.NPC);
      const troops = { archer: 100, carriage: 2 };
      expect(await armies.marchEstimate(g, p.id, p.cityId, npc.id, troops)).toEqual({
        marchTime: armies.armyMarchMs(b, b.city.tileId, npc.id, troops, false),
        load: armyLoad(troops, b.player.research),
      });
    }));

  it('counts the Relief Station towards own places', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g, { lightCavalry: 40_000 });
      await setBuildings(g, p, [[5, BuildingType.RELIEF_STATION, 10]]);
      const valley = await valleyNear(g, p.cityId, { level: 1 });
      const troops = { archer: 1 };
      const b = await cityBundle(g, p);
      const foreign = (await armies.marchEstimate(g, p.id, p.cityId, valley.id, troops)).marchTime;
      expect(foreign).toBe(armies.armyMarchMs(b, b.city.tileId, valley.id, troops, false));
      const a = await send(g, p, { targetTileId: valley.id, mission: Mission.ATTACK, troops: { lightCavalry: 40_000 }, heroId });
      await arrive(g, a.armyId);
      expect((await armies.marchEstimate(g, p.id, p.cityId, valley.id, troops)).marchTime).toBe(armies.armyMarchMs(b, b.city.tileId, valley.id, troops, true));
    }));

  it('refuses another lord’s city and bad troops', () =>
    game(async (g) => {
      const { p } = await warrior(g);
      const { p: q } = await warrior(g);
      const npc = await tileNear(g, p.cityId, TileType.NPC);
      await expectRefused(armies.marchEstimate(g, q.id, p.cityId, npc.id, { archer: 1 }), msg('common.invalidCastle'));
      await expectRefused(armies.marchEstimate(g, p.id, p.cityId, npc.id, {}), msg('common.noTroopsSelected'));
    }));
});

describe(armies.visibleArmies.name, () => {
  it('lists own armies, and hostile ones coming (details need a Beacon Tower)', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      const { p: q } = await warrior(g);
      const target = await reloadCity(g, q.cityId);
      const bean = await send(g, p, { targetTileId: target.tileId, mission: Mission.ATTACK, troops: { lightCavalry: 10 }, heroId });
      const hero = await getHero(g, heroId);

      const mine = await armies.visibleArmies(g, p.id);
      expect(mine).toEqual({ self: [expect.objectContaining({ armyId: bean.armyId, hero: hero.name, king: p.name })], friend: [], enemy: [] });

      let theirs = await armies.visibleArmies(g, q.id);
      expect(theirs.self).toEqual([]);
      expect(theirs.enemy).toEqual([expect.objectContaining({ armyId: bean.armyId, troop: null, resource: null, hero: '' })]);

      await setBuildings(g, q, [[7, BuildingType.BEACON_TOWER, 1]]);
      theirs = await armies.visibleArmies(g, q.id);
      expect(theirs.enemy).toEqual([expect.objectContaining({ armyId: bean.armyId, troop: expect.anything(), hero: '' })]);

      await setBuildings(g, q, [[7, BuildingType.BEACON_TOWER, 2]]);
      theirs = await armies.visibleArmies(g, q.id);
      expect(theirs.enemy).toEqual([expect.objectContaining({ armyId: bean.armyId, hero: hero.name, heroLevel: hero.level })]);

      // once it turns back it is no longer a threat
      await armies.recallArmy(g, p.id, bean.armyId);
      expect(await armies.visibleArmies(g, q.id)).toEqual({ self: [], friend: [], enemy: [] });
    }));

  it('lists allied troops stationed with me as friends', () =>
    game(async (g) => {
      const { p, q, armyId } = await stationAtAlly(g);
      const v = await armies.visibleArmies(g, q.id);
      expect(v).toEqual({ self: [], friend: [expect.objectContaining({ armyId, king: p.name })], enemy: [] });
    }));
});

describe(armies.stationedIn.name, () => {
  it('lists the allied armies stationed in a city', () =>
    game(async (g) => {
      const { p, q, heroId, armyId } = await stationAtAlly(g);
      const hero = await getHero(g, heroId);
      expect(await armies.stationedIn(g, q.id, q.cityId)).toEqual([
        expect.objectContaining({ armyId, king: p.name, hero: hero.name, direction: ArmyDirection.STAY, troop: expect.anything() }),
      ]);
      expect(await armies.stationedIn(g, p.id, p.cityId)).toEqual([]);
    }));

  it('only for own cities', () =>
    game(async (g) => {
      const { p, q } = await stationAtAlly(g);
      await expectRefused(armies.stationedIn(g, p.id, q.cityId), msg('common.invalidCastle'));
    }));
});
