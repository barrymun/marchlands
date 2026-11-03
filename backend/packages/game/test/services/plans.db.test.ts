// Wave plans (camp times, docs/features/camp-times.md, phases 2 and 3): waves landing on one target in one second, in
// the plan's order, whoever sends first.

import { describe, expect, it } from 'vitest';

import { BALANCE, dur, HOUR, Mission, msg, TileType } from '@marchlands/core';

import { plans } from '#/index.ts';
import { getArmy } from '#/repo.ts';
import { allies, tileNear, warrior } from '#test/support/armies.ts';
import { expectRefused } from '#test/support/expect.ts';
import { game, type TestGame } from '#test/support/game.ts';

/** A plan landing in an hour on a barbarian city near `p`'s city. */
async function planOn(g: TestGame, p: { id: number; cityId: number }, shared = false) {
  const target = await tileNear(g, p.cityId, TileType.NPC);
  const landAt = Math.floor((g.now + HOUR) / 1000) * 1000;
  const { id } = await plans.create(g, p.id, { name: 'Break it', targetTileId: target.id, landAt, shared });
  return { id, landAt, target };
}

describe(plans.create.name, () => {
  it('makes a plan the player sees, with no waves yet', () =>
    game(async (g) => {
      const { p } = await warrior(g);
      const { id, landAt, target } = await planOn(g, p);
      expect(await plans.list(g, p.id)).toMatchObject([{ id, name: 'Break it', playerId: p.id, shared: false, targetTileId: target.id, landAt, waves: [] }]);
    }));

  it('refuses a landing second past or too far ahead, sharing without an alliance, and more than the limit', () =>
    game(async (g) => {
      const { p } = await warrior(g);
      const target = await tileNear(g, p.cityId, TileType.NPC);
      const body = { name: 'X', targetTileId: target.id, landAt: g.now + HOUR, shared: false };
      await expectRefused(plans.create(g, p.id, { ...body, landAt: g.now - 1000 }), msg('army.planLandAt', { time: dur(BALANCE.landAtMaxAheadMs) }));
      await expectRefused(plans.create(g, p.id, { ...body, shared: true }), msg('army.planNoAlliance'));
      for (let i = 0; i < BALANCE.warPlans.maxPlans; i++) await plans.create(g, p.id, body);
      await expectRefused(plans.create(g, p.id, body), msg('army.planLimit', { count: BALANCE.warPlans.maxPlans }));
    }));
});

describe(plans.update.name, () => {
  it('changes the name, target, landing second and sharing', () =>
    game(async (g) => {
      const { p } = await warrior(g);
      const { p: q } = await warrior(g);
      await allies(g, p, q);
      const { id, landAt } = await planOn(g, p);
      const elsewhere = await tileNear(g, p.cityId, TileType.NPC, { skip: 1 });
      await plans.update(g, p.id, id, { name: 'Take Rome', targetTileId: elsewhere.id, landAt: landAt + HOUR + 999, shared: true });
      expect(await plans.list(g, q.id)).toMatchObject([{ id, name: 'Take Rome', targetTileId: elsewhere.id, landAt: landAt + HOUR, shared: true }]);
    }));

  it('is its maker’s alone', () =>
    game(async (g) => {
      const { p } = await warrior(g);
      const { p: q } = await warrior(g);
      await allies(g, p, q);
      const { id, landAt, target } = await planOn(g, p, true);
      await expectRefused(plans.update(g, q.id, id, { name: 'Mine', targetTileId: target.id, landAt, shared: true }), msg('army.planNotOwner'));
    }));

  it('keeps the target and landing second once a wave is sent, but can still be renamed', () =>
    game(async (g) => {
      const { p } = await warrior(g);
      const { id, landAt, target } = await planOn(g, p);
      const w = await plans.addWave(g, p.id, id, { cityId: p.cityId, mission: Mission.SCOUT, troops: { scouter: 1 } });
      await plans.sendWave(g, p.id, id, w.id);
      const body = { name: 'Break it', targetTileId: target.id, landAt, shared: false };
      await expectRefused(plans.update(g, p.id, id, { ...body, landAt: landAt + 60_000 }), msg('army.planMoveSent'));
      const other = await tileNear(g, p.cityId, TileType.NPC, { skip: 1 });
      await expectRefused(plans.update(g, p.id, id, { ...body, targetTileId: other.id }), msg('army.planMoveSent'));
      await plans.update(g, p.id, id, { ...body, name: 'Renamed' });
      expect(await plans.list(g, p.id)).toMatchObject([{ name: 'Renamed', targetTileId: target.id, landAt }]);
    }));

  it('checks a new landing second, but not one left as it was however near', () =>
    game(async (g) => {
      const { p } = await warrior(g);
      const { id, landAt, target } = await planOn(g, p);
      const body = { name: 'Break it', targetTileId: target.id, landAt, shared: false };
      await expectRefused(plans.update(g, p.id, id, { ...body, landAt: g.now - 1000 }), msg('army.planLandAt', { time: dur(BALANCE.landAtMaxAheadMs) }));
      await expectRefused(
        plans.update(g, p.id, id, { ...body, landAt: g.now + BALANCE.landAtMaxAheadMs + 1000 }),
        msg('army.planLandAt', { time: dur(BALANCE.landAtMaxAheadMs) }),
      );
      g.advance(HOUR + 1000);
      await plans.update(g, p.id, id, { ...body, name: 'Too late to move' });
      expect((await plans.list(g, p.id))[0]?.name).toBe('Too late to move');
    }));

  it('stays shared while other players have waves in it, and needs an alliance to share', () =>
    game(async (g) => {
      const { p } = await warrior(g);
      const { p: q } = await warrior(g);
      const { p: loner } = await warrior(g);
      await allies(g, p, q);
      const { id, landAt, target } = await planOn(g, p, true);
      const body = { name: 'Break it', targetTileId: target.id, landAt, shared: false };
      const theirs = await plans.addWave(g, q.id, id, { cityId: q.cityId, mission: Mission.SCOUT, troops: { scouter: 1 } });
      await expectRefused(plans.update(g, p.id, id, body), msg('army.planKeepShared'));
      await plans.removeWave(g, q.id, id, theirs.id);
      await plans.update(g, p.id, id, body);
      expect(await plans.list(g, q.id)).toEqual([]);
      const own = await planOn(g, loner);
      await expectRefused(
        plans.update(g, loner.id, own.id, { ...body, targetTileId: own.target.id, landAt: own.landAt, shared: true }),
        msg('army.planNoAlliance'),
      );
    }));
});

describe(plans.sendWave.name, () => {
  it('lands each wave its place in the order, in milliseconds, into the plan’s second', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      const { id, landAt } = await planOn(g, p);
      const scouts = await plans.addWave(g, p.id, id, { cityId: p.cityId, mission: Mission.SCOUT, troops: { scouter: 10 } });
      const attack = await plans.addWave(g, p.id, id, { cityId: p.cityId, mission: Mission.ATTACK, troops: { lightCavalry: 100 }, heroId });
      // sent the other way round, they still land in the plan's order
      const second = await plans.sendWave(g, p.id, id, attack.id);
      const first = await plans.sendWave(g, p.id, id, scouts.id);
      expect((await getArmy(g, first.armyId))?.reachTime).toBe(landAt);
      expect((await getArmy(g, second.armyId))?.reachTime).toBe(landAt + 1);
      const [plan] = await plans.list(g, p.id);
      expect(plan?.waves.map((w) => [w.id, w.armyId])).toEqual([
        [scouts.id, first.armyId],
        [attack.id, second.armyId],
      ]);
      await expectRefused(plans.sendWave(g, p.id, id, scouts.id), msg('army.planWaveSent'));
    }));

  it('reorders unsent waves for the plan’s maker, but never past a sent one', () =>
    game(async (g) => {
      const { p } = await warrior(g);
      const { id } = await planOn(g, p);
      const a = await plans.addWave(g, p.id, id, { cityId: p.cityId, mission: Mission.SCOUT, troops: { scouter: 1 } });
      const b = await plans.addWave(g, p.id, id, { cityId: p.cityId, mission: Mission.SCOUT, troops: { scouter: 2 } });
      await plans.moveWave(g, p.id, id, b.id, -1);
      expect((await plans.list(g, p.id))[0]?.waves.map((w) => w.id)).toEqual([b.id, a.id]);
      await plans.sendWave(g, p.id, id, b.id);
      await expectRefused(plans.moveWave(g, p.id, id, a.id, -1), msg('army.planWaveSent'));
    }));
});

describe('a shared plan', () => {
  it('lets the maker’s alliance add and send their own waves, which keep the plan’s order', () =>
    game(async (g) => {
      const { p } = await warrior(g);
      const { p: q } = await warrior(g);
      await allies(g, p, q);
      const { id, landAt } = await planOn(g, p, true);
      const mine = await plans.addWave(g, p.id, id, { cityId: p.cityId, mission: Mission.SCOUT, troops: { scouter: 1 } });
      const theirs = await plans.addWave(g, q.id, id, { cityId: q.cityId, mission: Mission.SCOUT, troops: { scouter: 1 } });
      const [plan] = await plans.list(g, q.id);
      expect(plan?.waves.map((w) => [w.player, w.marchMs == null])).toEqual([
        [p.name, true],
        [q.name, false],
      ]);
      // q can't send p's wave, delete the plan or reorder it
      await expectRefused(plans.sendWave(g, q.id, id, mine.id), msg('army.planWaveSent'));
      await expectRefused(plans.remove(g, q.id, id), msg('army.planNotOwner'));
      await expectRefused(plans.moveWave(g, q.id, id, theirs.id, -1), msg('army.planNotOwner'));
      const sent = await plans.sendWave(g, q.id, id, theirs.id);
      expect((await getArmy(g, sent.armyId))?.reachTime).toBe(landAt + 1);
    }));

  it('is no one else’s to see', () =>
    game(async (g) => {
      const { p } = await warrior(g);
      const { p: stranger } = await warrior(g);
      const { id } = await planOn(g, p, false);
      expect(await plans.list(g, stranger.id)).toEqual([]);
      await expectRefused(
        plans.addWave(g, stranger.id, id, { cityId: stranger.cityId, mission: Mission.SCOUT, troops: { scouter: 1 } }),
        msg('army.planNotFound'),
      );
    }));
});
