// processArmy: the timed event of an army (arrival, camping time over, coming home). The missions'
// arrivals have their own files: reinforce, settle, scout, attack (lords' cities), npc, valley.

import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { PushCmd } from '@marchlands/contracts';
import { ArmyDirection, HeroStatus, Mission, msg, TileType } from '@marchlands/core';
import { armies as armiesTable } from '@marchlands/db';

import { armyRef, homeMarchMs } from '#/engine/armies.ts';
import { processArmy } from '#/engine/combat.ts';
import { getHero } from '#/repo.ts';
import { armyRow, arrive, lastReport, NO_RESOURCES, occupyValley, reportTitles, send, tileNear, warrior } from '#test/support/armies.ts';
import { reloadCity } from '#test/support/factories.ts';
import { game } from '#test/support/game.ts';

describe(processArmy.name, () => {
  it('does nothing for an army that is gone', () =>
    game(async (g) => {
      await processArmy(g, 2_000_000_000);
      expect(g.events()).toEqual([]);
      expect(g.pushes()).toEqual([]);
    }));

  it('an army not there yet is rescheduled for its arrival', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      const npc = await tileNear(g, p.cityId, TileType.NPC);
      const bean = await send(g, p, { targetTileId: npc.id, mission: Mission.ATTACK, troops: { lightCavalry: 10 }, heroId });
      g._events.clear();
      await processArmy(g, bean.armyId);
      expect(g.events('army')).toEqual([expect.objectContaining({ dueAt: bean.reachTime, refKey: armyRef(bean.armyId), payload: { armyId: bean.armyId } })]);
      expect(await armyRow(g, bean.armyId)).toMatchObject({ direction: ArmyDirection.FORWARD, troops: { lightCavalry: 10 } });
      expect(await reportTitles(g, p.id)).toEqual([]);
    }));

  it('an army coming home brings its troops, goods and hero back', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      const npc = await tileNear(g, p.cityId, TileType.NPC, { level: 1 });
      const bean = await send(g, p, { targetTileId: npc.id, mission: Mission.ATTACK, troops: { lightCavalry: 2000 }, heroId });
      await arrive(g, bean.armyId);
      const back = (await armyRow(g, bean.armyId))!;
      expect(back.direction).toBe(ArmyDirection.BACKWARD);
      expect((await getHero(g, heroId)).status).toBe(HeroStatus.RETURN);
      const before = await reloadCity(g, p.cityId);

      await arrive(g, bean.armyId);
      expect(await armyRow(g, bean.armyId)).toBeUndefined();
      expect(g.events('army')).toEqual([]);
      const city = await reloadCity(g, p.cityId);
      expect(city.troops.lightCavalry).toBe(before.troops.lightCavalry! + back.troops.lightCavalry!);
      // the loot arrives (production meanwhile is small next to it)
      expect(city.wood - before.wood).toBeGreaterThan(back.resources.wood * 0.99);
      expect(city.gold - before.gold).toBeGreaterThan(back.resources.gold * 0.99);
      expect(await getHero(g, heroId)).toMatchObject({ status: HeroStatus.IDLE, cityId: p.cityId });

      const report = await lastReport(g, p.id, 'report.title.attackReturned');
      expect(report).toMatchObject({ isBack: true, armyType: Mission.ATTACK, startPos: back.targetPosName, targetPos: back.startPosName });
      const hero = await getHero(g, heroId);
      expect(report.body).toEqual({
        kind: 'movement',
        movement: { hero: { id: hero.id, name: hero.name, level: hero.level, logoUrl: hero.logoUrl }, troops: back.troops, resources: back.resources },
      });
      expect(g.pushes(PushCmd.TROOP_UPDATE).at(-1)).toMatchObject({ playerIds: [p.id], data: { castleId: p.cityId } });
    }));

  it('names the return report after the mission', () =>
    game(async (g) => {
      const { p } = await warrior(g);
      const npc = await tileNear(g, p.cityId, TileType.NPC);
      const scout = await send(g, p, { targetTileId: npc.id, mission: Mission.SCOUT, troops: { scouter: 10 } });
      await arrive(g, scout.armyId);
      await arrive(g, scout.armyId);
      expect(await reportTitles(g, p.id)).toEqual(['report.title.scoutReport', 'report.title.scoutReturned']);
    }));

  it('a camping army goes home once its camping time is over', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      const valley = await occupyValley(g, p, heroId);
      const bean = await send(g, p, { targetTileId: valley.id, mission: Mission.REINFORCE, troops: { lightCavalry: 100 }, restTime: 600 });
      await arrive(g, bean.armyId);
      const camp = (await armyRow(g, bean.armyId))!;
      expect(camp).toMatchObject({ direction: ArmyDirection.STAY, reachTime: g.now, restTime: 600_000 });
      expect(g.events('army')).toEqual([expect.objectContaining({ dueAt: g.now + 600_000, refKey: armyRef(bean.armyId) })]);

      // an early wake-up changes nothing
      await processArmy(g, bean.armyId);
      expect((await armyRow(g, bean.armyId))!.direction).toBe(ArmyDirection.STAY);

      await g.runDue(g.now + 600_000);
      const home = await homeMarchMs(g, camp, valley.id);
      expect(await armyRow(g, bean.armyId)).toMatchObject({ direction: ArmyDirection.BACKWARD, restTime: 0, reachTime: g.now + home });
      await arrive(g, bean.armyId);
      expect(await armyRow(g, bean.armyId)).toBeUndefined();
    }));

  it('a camping army without a time limit stays until recalled', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      const valley = await occupyValley(g, p, heroId);
      const bean = await send(g, p, { targetTileId: valley.id, mission: Mission.REINFORCE, troops: { lightCavalry: 100 } });
      await arrive(g, bean.armyId);
      expect(g.events('army')).toEqual([]);
      g.advance(30 * 86_400_000);
      await processArmy(g, bean.armyId);
      expect((await armyRow(g, bean.armyId))!.direction).toBe(ArmyDirection.STAY);
    }));

  it('an army with an unknown mission turns back', () =>
    game(async (g) => {
      const { p } = await warrior(g);
      const npc = await tileNear(g, p.cityId, TileType.NPC);
      const bean = await send(g, p, { targetTileId: npc.id, mission: Mission.SCOUT, troops: { scouter: 10 } });
      // not reachable through sendArmy: a stored mission the game no longer knows
      await g.tx.update(armiesTable).set({ mission: 9 }).where(eq(armiesTable.id, bean.armyId));
      await arrive(g, bean.armyId);
      expect(await armyRow(g, bean.armyId)).toMatchObject({ direction: ArmyDirection.BACKWARD, troops: { scouter: 10 }, resources: NO_RESOURCES });
      const report = await lastReport(g, p.id, 'report.title.missionAborted');
      expect(report.body).toEqual({ kind: 'text', text: msg('army.unknownMission') });
    }));

  it('an attack finding nothing on the tile turns back', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      const npc = await tileNear(g, p.cityId, TileType.NPC);
      const flat = await tileNear(g, p.cityId, TileType.FLAT);
      const bean = await send(g, p, { targetTileId: npc.id, mission: Mission.ATTACK, troops: { lightCavalry: 10 }, heroId });
      // not reachable through the game (a city cannot move away with an army on its way): point the army at flat land
      await g.tx.update(armiesTable).set({ targetTileId: flat.id }).where(eq(armiesTable.id, bean.armyId));
      await arrive(g, bean.armyId);
      expect((await armyRow(g, bean.armyId))!.direction).toBe(ArmyDirection.BACKWARD);
      expect((await lastReport(g, p.id, 'report.title.missionAborted')).body).toEqual({ kind: 'text', text: msg('army.nothingToAttack') });
      expect((await getHero(g, heroId)).status).toBe(HeroStatus.RETURN);
    }));
});
