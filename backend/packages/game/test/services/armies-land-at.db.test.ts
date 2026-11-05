// Camp times: an army set to land at a chosen second (docs/features/camp-times.md).

import { describe, expect, it } from 'vitest';

import { PushCmd } from '@marchlands/contracts';
import { ArmyDirection, BALANCE, dur, marchTimeMs, Mission, msg, TileType, TimedEventType } from '@marchlands/core';

import { armies } from '#/index.ts';
import { armyRow, arrive, reportsOf, send, tileNear, warrior } from '#test/support/armies.ts';
import { expectRefused } from '#test/support/expect.ts';
import { cityBundle, reloadCity } from '#test/support/factories.ts';
import { game, type TestGame } from '#test/support/game.ts';

/** The start of the second a minute and a half after the army could land at the soonest. */
const landingAfter = (g: TestGame, marchMs: number) => Math.ceil((g.now + marchMs + 90_000) / 1000) * 1000;

describe(armies.sendArmy.name, () => {
  it('waits at home and leaves in time to land at the start of the chosen second', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      const npc = await tileNear(g, p.cityId, TileType.NPC);
      const b = await cityBundle(g, p);
      const troops = { lightCavalry: 1000 };
      const ms = marchTimeMs(b.city.tileId, npc.id, troops, b.player.research, b.city.buildings);
      const land = landingAfter(g, ms);

      const bean = await send(g, p, { targetTileId: npc.id, mission: Mission.ATTACK, troops, heroId, arriveAt: land + 999 });

      expect(bean).toMatchObject({ direction: ArmyDirection.FORWARD, startTime: land - ms, reachTime: land });
      // the troops are committed at once
      expect((await reloadCity(g, p.cityId)).troops.lightCavalry).toBe(4000);
      expect(g.events(TimedEventType.ARMY_DEPART)).toEqual([expect.objectContaining({ dueAt: land - ms })]);
      expect(g.events(TimedEventType.ARMY)).toEqual([expect.objectContaining({ dueAt: land })]);

      await arrive(g, bean.armyId);
      expect(g.now).toBe(land);
      expect((await reportsOf(g, p.id)).length).toBe(1);
    }));

  it('refuses a landing time sooner than the march, or further ahead than allowed', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      const npc = await tileNear(g, p.cityId, TileType.NPC);
      const b = await cityBundle(g, p);
      const troops = { lightCavalry: 1000 };
      const ms = marchTimeMs(b.city.tileId, npc.id, troops, b.player.research, b.city.buildings);

      await expectRefused(
        send(g, p, { targetTileId: npc.id, mission: Mission.ATTACK, troops, heroId, arriveAt: g.now + ms - 2000 }),
        msg('army.landTooSoon', { time: dur(ms) }),
      );
      await expectRefused(
        send(g, p, { targetTileId: npc.id, mission: Mission.ATTACK, troops, heroId, arriveAt: g.now + BALANCE.landAtMaxAheadMs + 2000 }),
        msg('army.landTooLate', { time: dur(BALANCE.landAtMaxAheadMs) }),
      );
      // nothing left the city
      expect((await reloadCity(g, p.cityId)).troops.lightCavalry).toBe(5000);
    }));

  it('lands armies sent for the same second in the order they were sent', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      const { p: q, heroId: qHero } = await warrior(g);
      const npc = await tileNear(g, p.cityId, TileType.NPC);
      const land = landingAfter(g, 2 * 3_600_000);

      const first = await send(g, q, { targetTileId: npc.id, mission: Mission.SCOUT, troops: { scouter: 10 }, heroId: qHero, arriveAt: land });
      const second = await send(g, p, { targetTileId: npc.id, mission: Mission.SCOUT, troops: { scouter: 10 }, heroId, arriveAt: land });

      // both due at the same moment, in the order they were sent (the worker takes ties by when they were scheduled)
      expect(g.events(TimedEventType.ARMY).map((e) => [e.dueAt, e.payload?.armyId])).toEqual([
        [land, first.armyId],
        [land, second.armyId],
      ]);
    }));
});

describe(armies.visibleArmies.name, () => {
  it('keeps a waiting army from its target until it sets off', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      const { p: q } = await warrior(g);
      const target = await reloadCity(g, q.cityId);
      const b = await cityBundle(g, p);
      const troops = { lightCavalry: 10 };
      const ms = marchTimeMs(b.city.tileId, target.tileId, troops, b.player.research, b.city.buildings);
      const bean = await send(g, p, { targetTileId: target.tileId, mission: Mission.ATTACK, troops, heroId, arriveAt: landingAfter(g, ms) });

      expect((await armies.visibleArmies(g, p.id)).self).toEqual([expect.objectContaining({ armyId: bean.armyId })]);
      expect(await armies.visibleArmies(g, q.id)).toEqual({ self: [], friend: [], enemy: [] });
      expect(g.pushes(PushCmd.ENEMY_ARMIES_UPDATE).filter((m) => m.playerIds.includes(q.id))).toEqual([]);

      await g.runDue(bean.startTime);
      expect((await armies.visibleArmies(g, q.id)).enemy).toEqual([expect.objectContaining({ armyId: bean.armyId })]);
      expect(g.pushes(PushCmd.ENEMY_ARMIES_UPDATE).filter((m) => m.playerIds.includes(q.id))).toHaveLength(1);
    }));
});

describe(armies.recallArmy.name, () => {
  it('brings a waiting army back at once, and it never sets off', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      const npc = await tileNear(g, p.cityId, TileType.NPC);
      const b = await cityBundle(g, p);
      const troops = { lightCavalry: 1000 };
      const ms = marchTimeMs(b.city.tileId, npc.id, troops, b.player.research, b.city.buildings);
      const bean = await send(g, p, { targetTileId: npc.id, mission: Mission.ATTACK, troops, heroId, arriveAt: landingAfter(g, ms) });

      await armies.recallArmy(g, p.id, bean.armyId);
      expect(await armyRow(g, bean.armyId)).toMatchObject({ direction: ArmyDirection.BACKWARD, reachTime: g.now + 1000 });
      expect(g.events(TimedEventType.ARMY_DEPART)).toEqual([]);

      await arrive(g, bean.armyId);
      expect(await armyRow(g, bean.armyId)).toBeUndefined();
      expect((await reloadCity(g, p.cityId)).troops.lightCavalry).toBe(5000);
      // home again, as any recalled army reports, and no battle
      expect((await reportsOf(g, p.id)).map((r) => r.body.kind)).toEqual(['movement']);
    }));
});
