import { and, eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { BALANCE, msg, stateBounds, stateOf, TileType } from '@marchlands/core';
import { tiles, worldState } from '@marchlands/db';

import { pickOpenFlat, refreshZoneStats } from '#/engine/world.ts';
import { getTile } from '#/repo.ts';
import { expectRefused } from '#test/support/expect.ts';
import { createTestPlayer } from '#test/support/factories.ts';
import { game } from '#test/support/game.ts';
import { asDb, SIZE } from '#test/support/world.ts';

describe(refreshZoneStats.name, () => {
  it('counts the castles, barbarian cities and open flats of each zone', () =>
    game(async (g) => {
      const stats = await refreshZoneStats(asDb(g));
      expect(stats.map((s) => s.id)).toEqual(Array.from({ length: BALANCE.stateGrid ** 2 }, (_, i) => i));
      const { open } = (
        await g.tx.execute<{ open: number }>(
          sql`select count(*)::int as open from tiles where type = ${TileType.FLAT} and city_id is null and owner_city_id is null`,
        )
      ).rows[0]!;
      expect(stats.reduce((n, s) => n + s.openFlats, 0)).toBe(Number(open));
      for (const s of stats) {
        expect(s.castleCount).toBeGreaterThanOrEqual(s.playerCount);
        expect(s.settled).toBeGreaterThanOrEqual(0);
        expect(s.settled).toBeLessThanOrEqual(1);
      }
      const [cached] = await g.tx.select().from(worldState).where(eq(worldState.key, 'zones'));
      expect(cached!.value).toEqual(stats);
    }));

  it('a new city takes an open flat of its zone', () =>
    game(async (g) => {
      const before = (await refreshZoneStats(asDb(g)))[5]!;
      await createTestPlayer(g, { zone: 5 });
      const after = (await refreshZoneStats(asDb(g)))[5]!;
      expect(after).toMatchObject({ playerCount: before.playerCount + 1, castleCount: before.castleCount + 1, openFlats: before.openFlats - 1 });
      expect(after.settled).toBeGreaterThan(before.settled);
    }));
});

describe(pickOpenFlat.name, () => {
  it('picks a free flat in the zone asked for', () =>
    game(async (g) => {
      for (const zone of [0, 7, 15]) {
        const t = await getTile(g, await pickOpenFlat(g, zone));
        expect(t).toMatchObject({ type: TileType.FLAT, cityId: null, ownerCityId: null });
        expect(stateOf(t.id)).toBe(zone);
      }
    }));

  it('picks anywhere for a negative zone', () =>
    game(async (g) => {
      const t = await getTile(g, await pickOpenFlat(g, -1));
      expect(t).toMatchObject({ type: TileType.FLAT, cityId: null, ownerCityId: null });
    }));

  it('refuses a zone with no open flat', () =>
    game(async (g) => {
      const b = stateBounds(3);
      await g.tx
        .update(tiles)
        .set({ type: TileType.FOREST })
        .where(
          and(eq(tiles.type, TileType.FLAT), sql`${tiles.id} / ${SIZE} between ${b.y1} and ${b.y2} and ${tiles.id} % ${SIZE} between ${b.x1} and ${b.x2}`),
        );
      await expectRefused(pickOpenFlat(g, 3), msg('world.noOpenFlat'));
    }));
});
