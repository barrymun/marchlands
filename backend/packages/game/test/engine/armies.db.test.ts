import { describe, expect, it } from 'vitest';

import { PushCmd } from '@marchlands/contracts';
import { ArmyDirection, BuildingType, HeroStatus, marchTimeMs, Mission, msg, ref, TechType, TileType, tileXY, TimedEventType } from '@marchlands/core';

import { armyRef, cityPosition, homeMarchMs, notifyArmyParties, sendBack, tileOwner, tilePosition, visibleArmies } from '#/engine/armies.ts';
import { type ArmyRow, getHero, getTile } from '#/repo.ts';
import { armyRow, arrive, lastPush, send, tileNear, valleyNear, warrior } from '#test/support/armies.ts';
import { addHero, cityBundle, reloadCity, setBuildings, setResearch } from '#test/support/factories.ts';
import { game } from '#test/support/game.ts';

describe(tilePosition.name, () => {
  it('names a city by its name, a valley or barbarian city by type and level, flat land by type', () =>
    game(async (g) => {
      const { p } = await warrior(g);
      const city = await reloadCity(g, p.cityId);
      expect(await tilePosition(g, await getTile(g, city.tileId))).toEqual(cityPosition(city.name, city.tileId));
      const npc = await tileNear(g, p.cityId, TileType.NPC);
      expect(await tilePosition(g, npc)).toEqual(msg('world.position.tile', { tile: ref.tile(TileType.NPC), level: npc.level, ...tileXY(npc.id) }));
      const valley = await valleyNear(g, p.cityId);
      expect(await tilePosition(g, valley)).toEqual(msg('world.position.tile', { tile: ref.tile(valley.type), level: valley.level, ...tileXY(valley.id) }));
      const flat = await tileNear(g, p.cityId, TileType.FLAT);
      expect(await tilePosition(g, flat)).toEqual(msg('world.position.place', { tile: ref.tile(TileType.FLAT), ...tileXY(flat.id) }));
    }));
});

describe(tileOwner.name, () => {
  it('is the owner of the city standing there, or nobody on free land', () =>
    game(async (g) => {
      const { p } = await warrior(g);
      const city = await reloadCity(g, p.cityId);
      expect(await tileOwner(g, await getTile(g, city.tileId))).toBe(p.id);
      expect(await tileOwner(g, await tileNear(g, p.cityId, TileType.NPC))).toBeNull();
      expect(await tileOwner(g, await valleyNear(g, p.cityId))).toBeNull();
    }));

  it('is the occupier of a valley', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g, { lightCavalry: 40_000 });
      const valley = await valleyNear(g, p.cityId, { level: 1 });
      const a = await send(g, p, { targetTileId: valley.id, mission: Mission.ATTACK, troops: { lightCavalry: 40_000 }, heroId });
      await arrive(g, a.armyId);
      expect(await tileOwner(g, await getTile(g, valley.id))).toBe(p.id);
    }));
});

describe(notifyArmyParties.name, () => {
  it('pushes fresh army lists to the sender and the target player', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      const { p: q } = await warrior(g);
      const target = await reloadCity(g, q.cityId);
      const bean = await send(g, p, { targetTileId: target.tileId, mission: Mission.ATTACK, troops: { lightCavalry: 10 }, heroId });
      g._pushes.length = 0;
      await notifyArmyParties(g, { playerId: p.id, targetPlayerId: q.id });
      for (const cmd of [PushCmd.SELF_ARMIES_UPDATE, PushCmd.FRIEND_ARMIES_UPDATE, PushCmd.ENEMY_ARMIES_UPDATE]) {
        expect(g.pushes(cmd).map((x) => x.playerIds)).toEqual([[p.id], [q.id]]);
      }
      expect(lastPush(g, PushCmd.SELF_ARMIES_UPDATE, p.id)?.data).toEqual({ armys: [expect.objectContaining({ armyId: bean.armyId })] });
      expect(lastPush(g, PushCmd.ENEMY_ARMIES_UPDATE, q.id)?.data).toEqual({ armys: [expect.objectContaining({ armyId: bean.armyId })] });
    }));

  it('pushes once when there is no target player', () =>
    game(async (g) => {
      const { p } = await warrior(g);
      await notifyArmyParties(g, { playerId: p.id, targetPlayerId: null });
      await notifyArmyParties(g, { playerId: p.id, targetPlayerId: p.id });
      expect(g.pushes(PushCmd.SELF_ARMIES_UPDATE)).toHaveLength(2);
    }));
});

describe(visibleArmies.name, () => {
  it('lists armies in the order they land, not the order they were sent', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      const second = await addHero(g, p);
      const third = await addHero(g, p);
      const npc = await tileNear(g, p.cityId, TileType.NPC);
      const land = Math.ceil((g.now + 3_600_000) / 1000) * 1000;
      const at = (s: number, hero: number) =>
        send(g, p, { targetTileId: npc.id, mission: Mission.ATTACK, troops: { lightCavalry: 10 }, heroId: hero, arriveAt: land + s * 1000 });
      const late = await at(8, heroId);
      const early = await at(0, second);
      const middle = await at(2, third);
      expect((await visibleArmies(g, p.id)).self.map((a) => a.armyId)).toEqual([early.armyId, middle.armyId, late.armyId]);
    }));
});

describe(sendBack.name, () => {
  it('turns the army around towards home, its hero returning', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      const npc = await tileNear(g, p.cityId, TileType.NPC);
      const bean = await send(g, p, { targetTileId: npc.id, mission: Mission.ATTACK, troops: { lightCavalry: 10 }, heroId, restTime: 60 });
      g.advance(5000);
      const a = (await armyRow(g, bean.armyId)) as ArmyRow;
      await sendBack(g, a, 7000);
      expect(await armyRow(g, bean.armyId)).toMatchObject({ direction: ArmyDirection.BACKWARD, startTime: g.now, reachTime: g.now + 7000, restTime: 0 });
      expect((await getHero(g, heroId)).status).toBe(HeroStatus.RETURN);
      expect(g.events(TimedEventType.ARMY)).toEqual([expect.objectContaining({ dueAt: g.now + 7000, refKey: armyRef(bean.armyId) })]);
      // never under a second
      await sendBack(g, a, 0);
      expect((await armyRow(g, bean.armyId))!.reachTime).toBe(g.now + 1000);
    }));
});

describe(homeMarchMs.name, () => {
  it('is the march from a tile back to the home city', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      await setResearch(g, p, TechType.HORSEBACK_RIDING, 3);
      await setBuildings(g, p, [[6, BuildingType.ACADEMY, 5]]);
      const npc = await tileNear(g, p.cityId, TileType.NPC);
      const bean = await send(g, p, { targetTileId: npc.id, mission: Mission.ATTACK, troops: { lightCavalry: 10 }, heroId });
      const a = (await armyRow(g, bean.armyId))!;
      const b = await cityBundle(g, p);
      expect(await homeMarchMs(g, a, npc.id)).toBe(marchTimeMs(npc.id, b.city.tileId, a.troops, b.player.research, b.city.buildings));
    }));

  it('is a second when the home city is gone', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      const npc = await tileNear(g, p.cityId, TileType.NPC);
      const bean = await send(g, p, { targetTileId: npc.id, mission: Mission.ATTACK, troops: { lightCavalry: 10 }, heroId });
      const a = (await armyRow(g, bean.armyId))!;
      expect(await homeMarchMs(g, { ...a, cityId: 2_000_000_000 }, npc.id)).toBe(1000);
    }));
});
