import { readFileSync } from 'node:fs';

import { eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { BuildingType, FortType, msg, RESOURCE_KEYS, type Resources, trainCost } from '@marchlands/core';
import { mails } from '@marchlands/db';

import { training } from '#/index.ts';
import { saveCity, savePlayer } from '#/repo.ts';
import { createTestPlayer, reloadCity, reloadPlayer, setBuildings, setCityStats, setResources, type TestPlayer } from '#test/support/factories.ts';
import { game, type TestGame } from '#test/support/game.ts';
import { WALLS_QUEUE } from '#test/support/training.ts';

// Migration 0025 takes down the fortifications that no longer fit a city's walls once wall space per fortification grew.
const MIGRATION = readFileSync(new URL('../../../db/migrations/0025_fort_wall_space.sql', import.meta.url), 'utf8');

async function migrate(g: TestGame) {
  for (const statement of MIGRATION.split('--> statement-breakpoint')) await g.tx.execute(sql.raw(statement));
}

/** A city with level 2 walls (3,000 space), these fortifications, and plenty of resources and population. */
async function cityWithForts(g: TestGame, forts: Record<string, number>): Promise<TestPlayer> {
  const p = await createTestPlayer(g);
  await setBuildings(g, p, [
    [-2, BuildingType.WALLS, 2],
    [20, BuildingType.COTTAGE, 10],
  ]);
  await setCityStats(g, p, { population: 1000 });
  await setResources(g, p, { gold: 1e7, food: 1e7, wood: 1e7, stone: 1e7, iron: 1e7 });
  const c = await reloadCity(g, p.cityId);
  c.forts = forts;
  await saveCity(g, c);
  return p;
}

const resourcesOf = (c: Resources): Resources => ({ gold: c.gold, food: c.food, wood: c.wood, stone: c.stone, iron: c.iron });

describe('migration 0025_fort_wall_space', () => {
  it('takes down forts over capacity in proportion, refunds their full cost, uses up their refund credit and sends a mail', () =>
    game(async (g) => {
      const p = await cityWithForts(g, {});
      // 300 traps still in the queue count as used: 2,700 of the 3,000 space is left for the built ones
      await training.train(g, p.id, p.cityId, FortType.TRAP, 300, WALLS_QUEUE);
      const c = await reloadCity(g, p.cityId);
      c.forts = { trap: 1000, abatis: 1000, arrowTower: 500 }; // 1,000 + 2,000 + 1,500 = 4,500 space
      await saveCity(g, c);
      const pl = await reloadPlayer(g, p);
      pl.misc = { ...pl.misc, refundCredit: { trap: 1000, abatis: 100, arrowTower: 500, militia: 5 } };
      await savePlayer(g, pl);
      const before = resourcesOf(await reloadCity(g, p.cityId));

      await migrate(g);

      // 2,700 / 4,500 = 0.6 of each type stays
      const after = await reloadCity(g, p.cityId);
      expect(after.forts).toEqual({ trap: 600, abatis: 600, arrowTower: 300 });
      expect(after.fortQueue.queue).toHaveLength(1);
      const refund = [trainCost(FortType.TRAP, 400), trainCost(FortType.ABATIS, 400), trainCost(FortType.ARCHER_TOWER, 200)];
      for (const k of RESOURCE_KEYS) expect(after[k] - before[k], k).toBe(refund.reduce((s, r) => s + r[k], 0));
      expect((await reloadPlayer(g, p)).misc.refundCredit).toEqual({ trap: 600, arrowTower: 300, militia: 5 });
      const sent = await g.tx.select().from(mails).where(eq(mails.playerId, p.id));
      expect(sent).toMatchObject([
        {
          type: 2,
          system: {
            title: msg('training.mail.wallSpaceRefund.title'),
            content: msg('training.mail.wallSpaceRefund.content', { city: after.name, count: 1000 }),
          },
        },
      ]);
    }));

  it('leaves walls that still have room alone', () =>
    game(async (g) => {
      const forts = { trap: 1000, abatis: 500, arrowTower: 300 }; // 1,000 + 1,000 + 900 = 2,900 space
      const p = await cityWithForts(g, forts);
      const before = resourcesOf(await reloadCity(g, p.cityId));
      await migrate(g);
      const after = await reloadCity(g, p.cityId);
      expect(after.forts).toEqual(forts);
      expect(resourcesOf(after)).toEqual(before);
      expect(await g.tx.select().from(mails).where(eq(mails.playerId, p.id))).toEqual([]);
    }));
});
