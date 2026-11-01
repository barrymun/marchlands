// processArmy for scouts: barbarian cities and valleys are always scouted; lords' cities fight with their scouts.

import { describe, expect, it } from 'vitest';

import { PushCmd } from '@marchlands/contracts';
import {
  ArmyDirection,
  BuildingType,
  createGuardHero,
  freshNpcState,
  HeroStatus,
  Mission,
  npcBuildings,
  seededRng,
  stateOf,
  TechType,
  TileType,
} from '@marchlands/core';

import { processArmy } from '#/engine/combat.ts';
import { interior } from '#/index.ts';
import { getHero, getTile } from '#/repo.ts';
import {
  allies,
  armyRow,
  arrive,
  battleOf,
  cityTile,
  expectWipedHero,
  lastReport,
  occupyValley,
  reportTitles,
  scoutOf,
  send,
  tileNear,
  valleyNear,
  warrior,
} from '#test/support/armies.ts';
import { addHero, cityBundle, reloadCity, setBuildings, setResearch } from '#test/support/factories.ts';
import { game, type TestGame } from '#test/support/game.ts';
import { patchHero } from '#test/support/heroes.ts';

const guardOf = (tileId: number, seed: number, maxLevel: number) => createGuardHero(maxLevel, seededRng(`guard:${seed}`), stateOf(tileId));

/** p scouts q's city with `scouts` (q has `defenders` scouts); returns the army id. */
async function scoutCity(g: TestGame, scouts: number, defenders: number, opts: { extra?: Record<string, number> } = {}) {
  const { p, heroId } = await warrior(g, { scouter: scouts, ...opts.extra });
  const { p: q } = await warrior(g, { scouter: defenders, militia: 300 });
  const bean = await send(g, p, { targetTileId: await cityTile(g, q.cityId), mission: Mission.SCOUT, troops: { scouter: scouts, ...opts.extra }, heroId });
  return { p, q, heroId, armyId: bean.armyId };
}

describe(`${processArmy.name}: scouting a barbarian city`, () => {
  it('reports its resources, troops, fortifications, buildings and defending hero, and comes home', () =>
    game(async (g) => {
      const { p } = await warrior(g);
      const npc = await tileNear(g, p.cityId, TileType.NPC);
      expect(npc.state).toBeNull(); // untouched: full strength
      const bean = await send(g, p, { targetTileId: npc.id, mission: Mission.SCOUT, troops: { scouter: 20 } });
      await arrive(g, bean.armyId);

      const fresh = freshNpcState(npc.level, g.now);
      const tile = await getTile(g, npc.id);
      expect(tile).toMatchObject({ troops: fresh.troops, forts: fresh.forts, updatedAt: g.now });
      expect(tile.state).toMatchObject({ ...fresh.state, heroSeed: expect.any(Number) });
      const guard = guardOf(tile.id, tile.state!.heroSeed!, npc.level * 10);

      const report = await lastReport(g, p.id, 'report.title.scoutReport');
      expect(report).toMatchObject({ isAttack: true, armyType: Mission.SCOUT });
      expect(scoutOf(report, 'npc')).toEqual({
        target: 'npc',
        level: npc.level,
        success: true,
        loyalty: fresh.state.loyalty,
        population: fresh.state.population,
        resources: { gold: fresh.state.gold, food: fresh.state.food, wood: fresh.state.wood, stone: fresh.state.stone, iron: fresh.state.iron },
        troops: fresh.troops,
        fortifications: fresh.forts,
        wallLevel: npc.level,
        buildings: npcBuildings(npc.level),
        hero: { name: guard.name, level: guard.level },
      });
      expect(await armyRow(g, bean.armyId)).toMatchObject({ direction: ArmyDirection.BACKWARD, troops: { scouter: 20 } });
    }));

  it('the next attack meets the hero the scouts reported', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      const npc = await tileNear(g, p.cityId, TileType.NPC, { level: 1 });
      const scout = await send(g, p, { targetTileId: npc.id, mission: Mission.SCOUT, troops: { scouter: 20 } });
      await arrive(g, scout.armyId);
      const seen = scoutOf(await lastReport(g, p.id, 'report.title.scoutReport'), 'npc').hero;
      const attack = await send(g, p, { targetTileId: npc.id, mission: Mission.ATTACK, troops: { lightCavalry: 2000 }, heroId });
      await arrive(g, attack.armyId);
      const battle = battleOf(await lastReport(g, p.id, 'report.title.attackSucceeded'), 'npc');
      expect(battle.defender.hero).toMatchObject(seen);
    }));
});

describe(`${processArmy.name}: scouting a valley`, () => {
  it('a free valley: its garrison and defending hero', () =>
    game(async (g) => {
      const { p } = await warrior(g);
      const valley = await valleyNear(g, p.cityId);
      const bean = await send(g, p, { targetTileId: valley.id, mission: Mission.SCOUT, troops: { scouter: 20 } });
      await arrive(g, bean.armyId);
      const tile = await getTile(g, valley.id);
      expect(tile.state).toMatchObject({ regenAt: g.now, heroSeed: expect.any(Number) });
      const guard = guardOf(tile.id, tile.state!.heroSeed!, 20);
      expect(scoutOf(await lastReport(g, p.id, 'report.title.scoutReport'), 'valley')).toEqual({
        target: 'valley',
        type: valley.type,
        level: valley.level,
        owner: null,
        success: true,
        troops: tile.troops,
        hero: { name: guard.name, level: guard.level },
      });
      expect(Object.keys(tile.troops ?? {}).length).toBeGreaterThan(0);
      expect((await armyRow(g, bean.armyId))!.direction).toBe(ArmyDirection.BACKWARD);
    }));

  it('an occupied valley: its owner and the troops stationed there', () =>
    game(async (g) => {
      const { p: owner, heroId } = await warrior(g);
      const valley = await occupyValley(g, owner, heroId);
      const camp = await send(g, owner, { targetTileId: valley.id, mission: Mission.REINFORCE, troops: { lightCavalry: 123 } });
      await arrive(g, camp.armyId);
      const { p } = await warrior(g);
      const bean = await send(g, p, { targetTileId: valley.id, mission: Mission.SCOUT, troops: { scouter: 20 } });
      await arrive(g, bean.armyId);
      expect(scoutOf(await lastReport(g, p.id, 'report.title.scoutReport'), 'valley')).toEqual({
        target: 'valley',
        type: valley.type,
        level: valley.level,
        owner: owner.name,
        success: true,
        troops: { lightCavalry: 123 },
      });
    }));
});

describe(`${processArmy.name}: scouting a lord's city`, () => {
  it('outnumbering the defending scouts, reports the city to the scout and warns the defender', () =>
    game(async (g) => {
      const { p, q, armyId } = await scoutCity(g, 500, 10);
      await setBuildings(g, q, [[-2, BuildingType.WALLS, 3]]);
      await arrive(g, armyId);

      const report = await lastReport(g, p.id, 'report.title.scoutReport');
      const s = scoutOf(report, 'city');
      expect(s).toMatchObject({ target: 'city', owner: q.name, success: true });
      expect(s.battle.attackerScouts.before).toBe(500);
      expect(s.battle.defenderScouts).toMatchObject({ before: 10, after: 0 });
      const city = await reloadCity(g, q.cityId);
      expect(city.troops.scouter ?? 0).toBe(0);
      expect(s.intel).toEqual({
        resources: {
          gold: Math.floor(city.gold),
          food: Math.floor(city.food),
          wood: Math.floor(city.wood),
          stone: Math.floor(city.stone),
          iron: Math.floor(city.iron),
        },
        troops: city.troops,
        fortifications: city.forts,
        wallLevel: 3,
        population: Math.floor(city.population),
        stationed: [],
      });
      const theirs = await lastReport(g, q.id, 'report.title.enemyScouts');
      expect(scoutOf(theirs, 'cityDefender')).toEqual({ target: 'city', from: p.name, success: true, battle: s.battle });
      expect(g.pushes(PushCmd.TROOP_UPDATE).some((x) => x.playerIds.includes(q.id))).toBe(true);
      expect(await armyRow(g, armyId)).toMatchObject({ direction: ArmyDirection.BACKWARD, troops: { scouter: s.battle.attackerScouts.after } });
    }));

  it('Informatics shows the heroes (level 1) and the buildings (level 2)', () =>
    game(async (g) => {
      const { p, q, armyId } = await scoutCity(g, 500, 0);
      await setResearch(g, p, TechType.INFORMATICS, 1);
      await addHero(g, q);
      const qHeroes = (await cityBundle(g, q)).heroes;
      expect(qHeroes).toHaveLength(2);
      await arrive(g, armyId);
      const intel = scoutOf(await lastReport(g, p.id, 'report.title.scoutReport'), 'city').intel!;
      expect(intel.heroes).toEqual(qHeroes.map((h) => ({ name: h.name, level: h.level })));
      expect(intel.buildings).toBeUndefined();

      await setResearch(g, p, TechType.INFORMATICS, 2);
      await arrive(g, armyId); // home again
      const again = await send(g, p, { targetTileId: await cityTile(g, q.cityId), mission: Mission.SCOUT, troops: { scouter: 100 } });
      await arrive(g, again.armyId);
      const city = await reloadCity(g, q.cityId);
      expect(scoutOf(await lastReport(g, p.id, 'report.title.scoutReport'), 'city').intel!.buildings).toEqual(
        city.buildings.map((b) => ({ typeId: b.typeId, level: b.level })),
      );
    }));

  it('repelled: the scouts die, the defender loses the scouts the fight cost', () =>
    game(async (g) => {
      const { p, q, heroId, armyId } = await scoutCity(g, 20, 2000);
      const loyalty = (await getHero(g, heroId)).loyalty;
      await arrive(g, armyId);

      const s = scoutOf(await lastReport(g, p.id, 'report.title.scoutReport'), 'city');
      expect(s).toMatchObject({ success: false, intel: null, battle: { attackerScouts: { before: 20, after: 0 }, defenderScouts: { before: 2000 } } });
      expect((await reloadCity(g, q.cityId)).troops.scouter).toBe(s.battle.defenderScouts.after);
      expect(scoutOf(await lastReport(g, q.id, 'report.title.scoutsRepelled'), 'cityDefender')).toMatchObject({ from: p.name, success: false });
      expect(await armyRow(g, armyId)).toBeUndefined();
      expect(g.events('army')).toEqual([]);
      await expectWipedHero(g, heroId, loyalty, p, q);
      expect((await reloadCity(g, p.cityId)).troops.scouter ?? 0).toBe(0);
    }));

  it('repelled: other troops sent along come home', () =>
    game(async (g) => {
      const { p, armyId } = await scoutCity(g, 20, 2000, { extra: { lightCavalry: 50 } });
      await arrive(g, armyId);
      expect(scoutOf(await lastReport(g, p.id, 'report.title.scoutReport'), 'city').success).toBe(false);
      expect(await armyRow(g, armyId)).toMatchObject({ direction: ArmyDirection.BACKWARD, troops: { lightCavalry: 50 } });
    }));

  it('scouts of a city that keeps its troops in do not fight', () =>
    game(async (g) => {
      const { p, q, armyId } = await scoutCity(g, 20, 2000);
      await interior.setCityFlags(g, q.id, q.cityId, { goOutForBattle: false });
      await arrive(g, armyId);
      const s = scoutOf(await lastReport(g, p.id, 'report.title.scoutReport'), 'city');
      expect(s).toMatchObject({ success: true, battle: { attackerScouts: { before: 20, after: 20 }, defenderScouts: { before: 0, after: 0 } } });
      expect((await reloadCity(g, q.cityId)).troops.scouter).toBe(2000);
    }));

  it('a hero stationed in the city leads its scouts when it is stronger than the city’s own', () => {
    /** the same scouting with an ally's hero of `power` stationed in the city; the city's own hero is weak */
    const defendersLeft = (power: number) =>
      game(async (g) => {
        const { p, q, armyId } = await scoutCity(g, 300, 100);
        for (const h of (await cityBundle(g, q)).heroes) await patchHero(g, h.id, { power: 1, powerAdded: 0 });
        const { p: ally, heroId: allyHero } = await warrior(g, { scouter: 100 });
        await patchHero(g, allyHero, { power, powerAdded: 0 });
        await allies(g, q, ally);
        await interior.setCityFlags(g, q.id, q.cityId, { allowAlliance: true });
        const guard = await send(g, ally, {
          targetTileId: await cityTile(g, q.cityId),
          mission: Mission.REINFORCE,
          troops: { scouter: 100 },
          heroId: allyHero,
        });
        await arrive(g, guard.armyId);
        await arrive(g, armyId);
        return scoutOf(await lastReport(g, p.id, 'report.title.scoutReport'), 'city').battle.defenderScouts.after;
      });
    return (async () => {
      const weak = await defendersLeft(1);
      const strong = await defendersLeft(2000);
      // the same seeded battle, but the strong stationed hero's scouts kill more and lose fewer
      expect(strong).toBeGreaterThan(weak);
    })();
  });

  it('allied scouts stationed in the city fight too, sharing the losses', () =>
    game(async (g) => {
      const { p, q, armyId } = await scoutCity(g, 3000, 100);
      const { p: ally, heroId: allyHero } = await warrior(g, { scouter: 200 });
      await allies(g, q, ally);
      await interior.setCityFlags(g, q.id, q.cityId, { allowAlliance: true });
      const guard = await send(g, ally, { targetTileId: await cityTile(g, q.cityId), mission: Mission.REINFORCE, troops: { scouter: 200 }, heroId: allyHero });
      await arrive(g, guard.armyId);
      expect((await armyRow(g, guard.armyId))!.direction).toBe(ArmyDirection.STAY);
      expect((await armyRow(g, armyId))!.direction).toBe(ArmyDirection.FORWARD);
      await arrive(g, armyId);

      const s = scoutOf(await lastReport(g, p.id, 'report.title.scoutReport'), 'city');
      expect(s.battle.defenderScouts.before).toBe(300);
      const left = s.battle.defenderScouts.after;
      const city = await reloadCity(g, q.cityId);
      const stationed = await armyRow(g, guard.armyId);
      expect((city.troops.scouter ?? 0) + (stationed?.troops.scouter ?? 0)).toBe(left);
      if (!stationed) expect((await getHero(g, allyHero)).status).toBe(HeroStatus.IDLE); // an emptied army disbands
      expect(await reportTitles(g, ally.id)).not.toContain('report.title.enemyScouts');
    }));
});
