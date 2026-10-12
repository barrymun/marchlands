// processArmy for attacks on valleys (free or another lord's), occupation and its limit; giving a valley up
// and raising a free valley's level.

import { describe, expect, it } from 'vitest';
import { ArmyDirection, BALANCE, HeroStatus, Mission, msg, TileType, valleyUpgradeCost } from '@marchlands/core';
import { PushCmd } from '@marchlands/contracts';
import { combat } from '#/index.ts';
import { getHero, getTile, valleysOfCity } from '#/repo.ts';
import { armyRow, arrive, occupyValley, send, valleyNear, warrior } from '#test/support/armies.ts';
import { expectRefused } from '#test/support/expect.ts';
import { cityBundle, setResources } from '#test/support/factories.ts';
import { game } from '#test/support/game.ts';
import { homeMarchMs } from '#/engine/armies.ts';

describe(combat.abandonValley.name, () => {
  it('releases the valley; its garrison marches home', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      const valley = await occupyValley(g, p, heroId);
      const camp = await send(g, p, { targetTileId: valley.id, mission: Mission.REINFORCE, troops: { lightCavalry: 100 }, heroId });
      await arrive(g, camp.armyId);
      const row = (await armyRow(g, camp.armyId))!;

      await combat.abandonValley(g, p.id, valley.id);
      expect(await getTile(g, valley.id)).toMatchObject({ ownerCityId: null, ownerPlayerId: null, troops: null, state: null, updatedAt: g.now });
      expect(await valleysOfCity(g, p.cityId)).toEqual([]);
      expect(g.pushes(PushCmd.RESOURCE_UPDATE).at(-1)?.playerIds).toEqual([p.id]);
      expect(await armyRow(g, camp.armyId)).toMatchObject({
        direction: ArmyDirection.BACKWARD,
        reachTime: g.now + (await homeMarchMs(g, row, valley.id)),
      });
      expect((await getHero(g, heroId)).status).toBe(HeroStatus.RETURN);
    }));

  it('refuses a valley the lord does not hold', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      const { p: q } = await warrior(g);
      const free = await valleyNear(g, p.cityId);
      await expectRefused(combat.abandonValley(g, p.id, free.id), msg('army.valleyNotHeld'));
      const mine = await occupyValley(g, p, heroId);
      await expectRefused(combat.abandonValley(g, q.id, mine.id), msg('army.valleyNotHeld'));
      await expectRefused(combat.abandonValley(g, p.id, (await cityBundle(g, p)).city.tileId), msg('army.valleyNotHeld'));
    }));
});

describe(combat.upgradeValley.name, () => {
  it('raises a free valley a level for gold', () =>
    game(async (g) => {
      const { p } = await warrior(g);
      await setResources(g, p, { gold: 50_000 });
      const valley = await valleyNear(g, p.cityId, { level: 1 });
      const cost = valleyUpgradeCost(1)!;
      expect(await combat.upgradeValley(g, p.id, p.cityId, valley.id)).toEqual({ tileId: valley.id, level: 2, gold: cost, nextCost: valleyUpgradeCost(2) });
      expect(await getTile(g, valley.id)).toMatchObject({ level: 2, troops: null, forts: null, state: null });
      expect((await cityBundle(g, p)).city.gold).toBeCloseTo(50_000 - cost, 0);
    }));

  it('refuses held valleys, cities, the top level and a city short of gold', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      const { p: q } = await warrior(g);
      const held = await occupyValley(g, p, heroId);
      await expectRefused(combat.upgradeValley(g, p.id, p.cityId, held.id), msg('army.upgradeHeld'));
      await expectRefused(combat.upgradeValley(g, p.id, p.cityId, (await cityBundle(g, q)).city.tileId), msg('army.upgradeTarget'));
      const valley = await valleyNear(g, p.cityId, { level: 1 });
      await expectRefused(combat.upgradeValley(g, q.id, p.cityId, valley.id), msg('common.invalidCastle'));

      await setResources(g, p, { gold: valleyUpgradeCost(1)! - 1 });
      await expectRefused(combat.upgradeValley(g, p.id, p.cityId, valley.id), msg('common.notEnoughGoldFor', { amount: valleyUpgradeCost(1)! }));

      await setResources(g, p, { gold: 10_000_000 });
      let level = 1;
      while (valleyUpgradeCost(level) != null) level = (await combat.upgradeValley(g, p.id, p.cityId, valley.id)).level;
      expect(level).toBe(BALANCE.valleyUpgrade.maxLevel);
      await expectRefused(combat.upgradeValley(g, p.id, p.cityId, valley.id), msg('army.valleyMaxLevel', { level }));
      expect((await getTile(g, valley.id)).type).not.toBe(TileType.NPC);
    }));
});
