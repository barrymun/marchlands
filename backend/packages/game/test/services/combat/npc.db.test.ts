// processArmy for attacks on barbarian cities (plunder, loyalty, capture, regeneration), and raising their level.

import { describe, expect, it } from 'vitest';
import {
  ArmyDirection,
  armyLoad,
  BALANCE,
  freshNpcState,
  HeroStatus,
  injuredOf,
  Mission,
  msg,
  npcTemplate,
  regenerateNpc,
  TechType,
  TileType,
  totalResources,
  valleyUpgradeCost,
  type NpcState,
  type ResourceSet,
} from '@marchlands/core';
import { PushCmd } from '@marchlands/contracts';
import { admin, citiesOf, combat, getHero, getTile } from '../../../src/index.ts';
import { armyRow, arrive, battleOf, expectWipedHero, reportsOf, roundTrip, send, tileNear, warrior } from '../../support/armies.ts';
import { expectRefused } from '../../support/expect.ts';
import { reloadCity, reloadPlayer, setResearch, setResources, type TestPlayer } from '../../support/factories.ts';
import { game, type TestGame } from '../../support/game.ts';

const KEYS = ['gold', 'food', 'wood', 'stone', 'iron'] as const;

/** Attack the barbarian city with light cavalry and run the march to the battle; returns the battle report. */
async function attack(g: TestGame, p: TestPlayer, heroId: number, tileId: number, lightCavalry = 2000) {
  const bean = await send(g, p, { targetTileId: tileId, mission: Mission.ATTACK, troops: { lightCavalry }, heroId });
  await arrive(g, bean.armyId);
  const r = (await reportsOf(g, p.id)).at(-1)!;
  return { armyId: bean.armyId, report: r, battle: battleOf(r, 'npc') };
}

describe(`${combat.processArmy.name}: attacking a barbarian city`, () => {
  it('a won battle: plunder, loyalty damage, honor, medals and hero experience', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      const npc = await tileNear(g, p.cityId, TileType.NPC, { level: 1 });
      const { armyId, report, battle: b } = await attack(g, p, heroId, npc.id);
      const fresh = freshNpcState(1, g.now);

      expect(report).toMatchObject({ title: msg('report.title.attackSucceeded'), isAttack: true, armyType: Mission.ATTACK });
      expect(b).toMatchObject({ result: 'attackerWon', captured: false, level: 1, defender: { player: '', wallLevel: 1, troops: { before: fresh.troops } } });
      const [lo, hi] = BALANCE.npcLoyaltyDamagePerAttack;
      expect(b.loyaltyDamage).toBeGreaterThanOrEqual(lo);
      expect(b.loyaltyDamage).toBeLessThanOrEqual(hi);
      expect(b.loyaltyLeft).toBe(npcTemplate(1).loyalty - b.loyaltyDamage);

      const loot = b.plunder as ResourceSet;
      const pp = await reloadPlayer(g, p);
      expect(totalResources(loot)).toBeGreaterThan(0);
      expect(totalResources(loot)).toBeLessThanOrEqual(armyLoad(b.attacker.troops.after, pp.research));
      const tile = await getTile(g, npc.id);
      expect(tile).toMatchObject({ type: TileType.NPC, troops: b.defender.troops.after, forts: b.defender.forts!.after, updatedAt: g.now });
      const state = tile.state as unknown as NpcState;
      for (const k of KEYS) expect(state[k]).toBeCloseTo(fresh.state[k] - loot[k], 6);
      expect(state.loyalty).toBe(b.loyaltyLeft);

      expect(pp.honor).toBe(b.attacker.honor);
      for (const [id, n] of Object.entries(b.medals ?? {})) expect(pp.items[id]).toBe(n);
      const hero = await getHero(g, heroId);
      expect(hero.experience).toBe(b.attacker.heroExp);
      expect(b.attacker.hero).toEqual({ id: hero.id, name: hero.name, level: hero.level, logoUrl: hero.logoUrl });

      expect(await armyRow(g, armyId)).toMatchObject({ direction: ArmyDirection.BACKWARD, troops: b.attacker.troops.after, resources: loot });
    }));

  it('Medicine sends part of the fallen home injured', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      await setResearch(g, p, TechType.MEDICINE, 6);
      const npc = await tileNear(g, p.cityId, TileType.NPC, { level: 1 });
      const { battle: b } = await attack(g, p, heroId, npc.id);
      const injured = injuredOf(b.attacker.troops.lost, (await reloadPlayer(g, p)).research);
      expect(Object.keys(injured).length).toBeGreaterThan(0);
      expect(b.attacker.injured).toEqual(injured);
      expect((await reloadCity(g, p.cityId)).injuredTroops).toEqual(injured);
      expect(g.pushes(PushCmd.INJURED_TROOP_UPDATE).at(-1)).toMatchObject({ playerIds: [p.id], data: { castleId: p.cityId } });
    }));

  it('a lost battle: the army dies, its hero limps home, the barbarians keep their losses', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      const loyalty = (await getHero(g, heroId)).loyalty;
      const npc = await tileNear(g, p.cityId, TileType.NPC, { level: 1 });
      const { armyId, report, battle: b } = await attack(g, p, heroId, npc.id, 5);
      expect(report.title).toEqual(msg('report.title.attackFailed'));
      expect(b).toMatchObject({ result: 'defenderWon', loyaltyDamage: 0, captured: false, plunder: { gold: 0, food: 0, wood: 0, stone: 0, iron: 0 } });
      expect(b.loyaltyLeft).toBe(npcTemplate(1).loyalty);
      expect(await armyRow(g, armyId)).toBeUndefined();
      expect((await getTile(g, npc.id)).troops).toEqual(b.defender.troops.after);
      await expectWipedHero(g, heroId, loyalty, p, null);
    }));

  it('its garrison and fortifications regenerate over time', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      const npc = await tileNear(g, p.cityId, TileType.NPC, { level: 1 });
      await attack(g, p, heroId, npc.id);
      const hit = await getTile(g, npc.id);
      g.advance(3 * BALANCE.npcRegenMs);
      const expected = regenerateNpc(1, hit.state as unknown as NpcState, hit.troops!, hit.forts!, g.now);
      const scout = await send(g, p, { targetTileId: npc.id, mission: Mission.SCOUT, troops: { scouter: 5 } });
      await g.runDue(scout.reachTime);
      const now = regenerateNpc(1, hit.state as unknown as NpcState, hit.troops!, hit.forts!, g.now);
      const tile = await getTile(g, npc.id);
      expect(tile.troops).toEqual(now.troops);
      expect(tile.forts).toEqual(now.forts);
      expect(Object.values(expected.troops).some((n) => n > 0)).toBe(true);
    }));

  it('captured once its loyalty is gone, when the lord has room for another city', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g, { lightCavalry: 30_000 });
      await admin.setPlayerFlags(g, p.name, { title: 1 });
      const npc = await tileNear(g, p.cityId, TileType.NPC, { level: 1 });
      const prestige = (await reloadPlayer(g, p)).prestige;
      let last;
      for (let i = 0; i < 15; i++) {
        last = await attack(g, p, heroId, npc.id);
        await roundTrip(g, last.armyId);
        if (last.battle.captured) break;
      }
      const b = last!.battle;
      expect(b).toMatchObject({ captured: true, loyaltyLeft: 0 });
      expect(last!.report.title).toEqual(msg('report.title.attackSucceeded'));

      const [, keep] = await citiesOf(g, p.id);
      expect(keep).toMatchObject({ name: `${p.name.slice(0, 12)} Keep`, tileId: npc.id, playerId: p.id, buildings: combat.npcCityBuildings(1) });
      expect(keep.population).toBe(npcTemplate(1).population);
      expect(await getTile(g, npc.id)).toMatchObject({
        type: TileType.CASTLE,
        cityId: keep.id,
        ownerPlayerId: p.id,
        ownerCityId: null,
        troops: null,
        forts: null,
        state: null,
      });
      expect((await reloadPlayer(g, p)).prestige - prestige).toBeGreaterThanOrEqual(1000);
      expect(g.pushes(PushCmd.CASTLE_UPDATE).some((x) => (x.data as { castleBean: { id: number } }).castleBean.id === keep.id)).toBe(true);
    }));

  it('not captured when the lord has no room for another city', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g, { lightCavalry: 30_000 });
      const npc = await tileNear(g, p.cityId, TileType.NPC, { level: 1 });
      let left = npcTemplate(1).loyalty;
      for (let i = 0; i < 15 && left > 0; i++) {
        const { armyId, battle: b } = await attack(g, p, heroId, npc.id);
        await roundTrip(g, armyId);
        expect(b.captured).toBe(false);
        left = b.loyaltyLeft;
      }
      expect(left).toBe(0);
      expect(await citiesOf(g, p.id)).toHaveLength(1);
      const tile = await getTile(g, npc.id);
      expect(tile).toMatchObject({ type: TileType.NPC, cityId: null });
      expect((tile.state as unknown as NpcState).loyalty).toBe(0);
    }));
});

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
