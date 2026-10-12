// processArmy for attacks on barbarian cities (plunder, loyalty, capture, regeneration), and raising their level.

import { describe, expect, it } from 'vitest';
import { BALANCE, HeroStatus, msg, TileType, valleyUpgradeCost } from '@marchlands/core';
import { PushCmd } from '@marchlands/contracts';
import { admin, combat } from '#/index.ts';
import { getHero, getTile } from '#/repo.ts';
import { roundTrip, tileNear, warrior } from '#test/support/armies.ts';
import { expectRefused } from '#test/support/expect.ts';
import { reloadCity, setResources } from '#test/support/factories.ts';
import { game } from '#test/support/game.ts';
import { attack } from '#test/support/combat.ts';

describe(combat.upgradeValley.name, () => {
  it('raises a barbarian city a level for gold; its garrison starts afresh', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      const npc = await tileNear(g, p.cityId, TileType.NPC, { level: 1 });
      await attack(g, p, heroId, npc.id);
      await setResources(g, p, { gold: 100_000 });
      const cost = valleyUpgradeCost(1)!;
      expect(await combat.upgradeValley(g, p.id, p.cityId, npc.id)).toEqual({ tileId: npc.id, level: 2, gold: cost, nextCost: valleyUpgradeCost(2) });
      expect(await getTile(g, npc.id)).toMatchObject({ level: 2, troops: null, forts: null, state: null, updatedAt: g.now });
      expect((await reloadCity(g, p.cityId)).gold).toBeCloseTo(100_000 - cost, 0);
      expect(g.pushes(PushCmd.RESOURCE_UPDATE).at(-1)?.playerIds).toEqual([p.id]);
    }));

  it('stops at the top level', () =>
    game(async (g) => {
      const { p } = await warrior(g);
      const npc = await tileNear(g, p.cityId, TileType.NPC, { level: 1 });
      let level = 1;
      while (valleyUpgradeCost(level) != null) level = (await combat.upgradeValley(g, p.id, p.cityId, npc.id)).level;
      expect(level).toBe(BALANCE.valleyUpgrade.maxLevel);
      await expectRefused(combat.upgradeValley(g, p.id, p.cityId, npc.id), msg('army.barbarianCityMaxLevel', { level }));
    }));

  it('a captured barbarian city is a lord’s city, not a target', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g, { lightCavalry: 30_000 });
      await admin.setPlayerFlags(g, p.name, { title: 1 });
      const npc = await tileNear(g, p.cityId, TileType.NPC, { level: 1 });
      for (let i = 0; i < 15; i++) {
        const { armyId, battle } = await attack(g, p, heroId, npc.id);
        await roundTrip(g, armyId);
        if (battle.captured) break;
      }
      await expectRefused(combat.upgradeValley(g, p.id, p.cityId, npc.id), msg('army.upgradeTarget'));
      expect((await getHero(g, heroId)).status).toBe(HeroStatus.IDLE);
    }));
});
