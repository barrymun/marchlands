// The game with PvP off (core Feature.PVP, docs/deviations.md): nothing a player holds can be attacked or scouted, by
// any route, and everything against the map's own cities and free valleys goes on as before. The other service tests
// run with it on (test/support/feature-flags.ts), so they cover it on; a few here switch it back to compare.

import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  ArmyDirection,
  BALANCE,
  BattleTarget,
  DAY,
  Feature,
  type HistoricState,
  HOUR,
  ItemId,
  Mission,
  msg,
  ReportBodyKind,
  setFeatureFlags,
  TileType,
  TimedEventType,
} from '@marchlands/core';
import { mails } from '@marchlands/db';

import { checkBeginner } from '#/engine/player.ts';
import { admin, alliance, interior, plans, player as players, shop, world } from '#/index.ts';
import { getTile, saveTile } from '#/repo.ts';
import {
  allies,
  armyRow,
  arrive,
  battleOf,
  cityTile,
  occupyValley,
  reportsOf,
  roundTrip,
  scoutOf,
  send,
  tileNear,
  valleyNear,
  warCity,
  warrior,
} from '#test/support/armies.ts';
import { expectRefused } from '#test/support/expect.ts';
import { addHero, createTestPlayer, giveItems, reloadCity, reloadPlayer, setCityStats, type TestPlayer } from '#test/support/factories.ts';
import { game, type TestGame } from '#test/support/game.ts';
import { makeSeat } from '#test/support/historic.ts';

const PVP_DISABLED = msg('army.pvpDisabled');
const pvp = (on: boolean) => setFeatureFlags({ [Feature.PVP]: on });

/** Runs with PvP on, for what a player holds or has sent before it's switched off. */
async function whilePvpOn<T>(fn: () => Promise<T>): Promise<T> {
  pvp(true);
  try {
    return await fn();
  } finally {
    pvp(false);
  }
}

/**
 * A historic city with its garrison broken as of `at` and nothing regenerating: the sides' counts (`sieges`, as they
 * stand if not given) and the shared loyalty as of then, so a test's marches take no time off them.
 */
async function breakSeat(g: TestGame, seatId: number, at: number, opts: { sieges?: Record<string, number>; loyalty?: number } = {}) {
  const tile = await getTile(g, seatId);
  const stored = tile.state as unknown as HistoricState | null;
  const counts = opts.sieges ?? Object.fromEntries(Object.entries(stored?.sieges ?? {}).map(([side, v]) => [side, v.loyalty]));
  const state: HistoricState = {
    gold: 0,
    food: 0,
    wood: 0,
    stone: 0,
    iron: 0,
    loyalty: opts.loyalty ?? stored?.loyalty ?? BALANCE.historic.loyalty,
    population: 0,
    regenAt: at,
    loyaltyAt: at,
    refillAt: at,
    day: Math.floor(at / DAY),
    sieges: Object.fromEntries(Object.entries(counts).map(([side, loyalty]) => [side, { loyalty, loyaltyAt: at }])),
  };
  await saveTile(g, { ...tile, troops: {}, forts: {}, state: state as unknown as typeof tile.state });
}

/** One winning wave of `p` on a broken historic city (breakSeat): the battle's report and the tile after it. */
async function waveOnSeat(g: TestGame, p: TestPlayer, heroId: number, seatId: number, opts: Parameters<typeof breakSeat>[3] = {}) {
  const bean = await send(g, p, { targetTileId: seatId, mission: Mission.ATTACK, troops: { archer: 60_000 }, heroId });
  await breakSeat(g, seatId, bean.reachTime, opts);
  await arrive(g, bean.armyId);
  return { report: battleOf((await reportsOf(g, p.id)).at(-1)!, BattleTarget.NPC), tile: await getTile(g, seatId) };
}

/** A player with the archers and hero for a wave, allowed more than one city. */
async function besieger(g: TestGame) {
  const { p, heroId } = await warrior(g, { archer: 60_000, scouter: 10 });
  await admin.setPlayerFlags(g, p.name, { title: 1 });
  return { p, heroId };
}

const seatTile = (g: TestGame, p: TestPlayer) => tileNear(g, p.cityId, TileType.HISTORIC, { radius: 30 });
const A_WIN = BALANCE.historic.loyaltyPerWin;

/** Two players ready for war. */
async function rivals(g: TestGame) {
  const a = await warrior(g);
  const b = await warrior(g);
  return { p: a.p, heroId: a.heroId, q: b.p, qHero: b.heroId };
}

const lastAborted = async (g: TestGame, playerId: number) => {
  const r = (await reportsOf(g, playerId)).at(-1)!;
  expect(r.title).toEqual(msg('report.title.missionAborted'));
  expect(r.body).toMatchObject({ kind: ReportBodyKind.TEXT, text: PVP_DISABLED });
};

beforeEach(() => pvp(false));
afterEach(() => pvp(true));

describe('sending an army', () => {
  it("refuses attacking or scouting another player's city, and sends nothing", () =>
    game(async (g) => {
      const { p, heroId, q } = await rivals(g);
      const target = await cityTile(g, q.cityId);
      const before = await reloadCity(g, p.cityId);
      await expectRefused(send(g, p, { targetTileId: target, mission: Mission.ATTACK, troops: { lightCavalry: 100 }, heroId }), PVP_DISABLED);
      await expectRefused(send(g, p, { targetTileId: target, mission: Mission.SCOUT, troops: { scouter: 10 } }), PVP_DISABLED);
      expect(g.events(TimedEventType.ARMY)).toHaveLength(0);
      expect((await reloadCity(g, p.cityId)).troops).toEqual(before.troops);
    }));

  it("refuses attacking or scouting another player's valley", () =>
    game(async (g) => {
      const { p, heroId, q, qHero } = await rivals(g);
      const valley = await whilePvpOn(() => occupyValley(g, q, qHero));
      await expectRefused(send(g, p, { targetTileId: valley.id, mission: Mission.ATTACK, troops: { lightCavalry: 100 }, heroId }), PVP_DISABLED);
      await expectRefused(send(g, p, { targetTileId: valley.id, mission: Mission.SCOUT, troops: { scouter: 10 } }), PVP_DISABLED);
    }));

  it('refuses attacking or scouting a historic city a player holds, truce over or not', () =>
    game(async (g) => {
      const { p, heroId, q } = await rivals(g);
      await makeSeat(g, q);
      const target = await cityTile(g, q.cityId);
      g.advance(BALANCE.historic.truceMs);
      await expectRefused(send(g, p, { targetTileId: target, mission: Mission.ATTACK, troops: { lightCavalry: 100 }, heroId }), PVP_DISABLED);
      await expectRefused(send(g, p, { targetTileId: target, mission: Mission.SCOUT, troops: { scouter: 10 } }), PVP_DISABLED);
    }));

  it('gives a new player the same reason, not their beginner protection', () =>
    game(async (g) => {
      const { q } = await rivals(g);
      const beginner = await createTestPlayer(g);
      await warCity(g, beginner, { troops: { scouter: 10 }, beginner: true });
      await expectRefused(send(g, beginner, { targetTileId: await cityTile(g, q.cityId), mission: Mission.SCOUT, troops: { scouter: 10 } }), PVP_DISABLED);
    }));

  it('still sends armies at what no player holds', () =>
    game(async (g) => {
      const { p, heroId } = await rivals(g);
      const npc = await tileNear(g, p.cityId, TileType.NPC);
      const valley = await valleyNear(g, p.cityId);
      const seat = await tileNear(g, p.cityId, TileType.HISTORIC, { radius: 30 });
      await send(g, p, { targetTileId: npc.id, mission: Mission.ATTACK, troops: { lightCavalry: 100 }, heroId });
      for (const t of [npc, valley, seat]) await send(g, p, { targetTileId: t.id, mission: Mission.SCOUT, troops: { scouter: 10 } });
      expect(g.events(TimedEventType.ARMY)).toHaveLength(4);
    }));

  it('still reinforces and supplies allies, and still refuses to attack them for the old reason', () =>
    game(async (g) => {
      const { p, heroId, q } = await rivals(g);
      await allies(g, p, q);
      await interior.setCityFlags(g, q.id, q.cityId, { allowAlliance: true });
      const target = await cityTile(g, q.cityId);
      await send(g, p, { targetTileId: target, mission: Mission.REINFORCE, troops: { lightCavalry: 100 } });
      await send(g, p, { targetTileId: target, mission: Mission.TRANSPORT, troops: { lightCavalry: 100 }, resources: { food: 100 } });
      await expectRefused(send(g, p, { targetTileId: target, mission: Mission.ATTACK, troops: { lightCavalry: 100 }, heroId }), msg('army.invalidTarget'));
    }));

  it('sends again once PvP is back on', () =>
    game(async (g) => {
      const { p, heroId, q } = await rivals(g);
      const target = await cityTile(g, q.cityId);
      await whilePvpOn(() => send(g, p, { targetTileId: target, mission: Mission.ATTACK, troops: { lightCavalry: 100 }, heroId }));
      expect(g.events(TimedEventType.ARMY)).toHaveLength(1);
    }));
});

describe('an army arriving', () => {
  it('turns back from a city it set out for before PvP went off, with no battle, and comes home whole', () =>
    game(async (g) => {
      const { p, heroId, q } = await rivals(g);
      const target = await cityTile(g, q.cityId);
      const bean = await whilePvpOn(() => send(g, p, { targetTileId: target, mission: Mission.ATTACK, troops: { lightCavalry: 100 }, heroId }));
      const home = await reloadCity(g, p.cityId);
      const defender = await reloadCity(g, q.cityId);

      await arrive(g, bean.armyId);
      await lastAborted(g, p.id);
      expect(await armyRow(g, bean.armyId)).toMatchObject({ direction: ArmyDirection.BACKWARD, troops: { lightCavalry: 100 } });
      const after = await reloadCity(g, q.cityId);
      expect({ troops: after.troops, food: after.food }).toEqual({ troops: defender.troops, food: defender.food });
      expect(await reportsOf(g, q.id)).toEqual([]);

      await roundTrip(g, bean.armyId);
      expect(await armyRow(g, bean.armyId)).toBeUndefined();
      expect((await reloadCity(g, p.cityId)).troops.lightCavalry).toBe((home.troops.lightCavalry ?? 0) + 100);
    }));

  it('fights as before if PvP is on when it lands', () =>
    game(async (g) => {
      const { p, heroId, q } = await rivals(g);
      const target = await cityTile(g, q.cityId);
      const bean = await whilePvpOn(() => send(g, p, { targetTileId: target, mission: Mission.ATTACK, troops: { lightCavalry: 100 }, heroId }));
      await whilePvpOn(() => arrive(g, bean.armyId));
      expect(battleOf((await reportsOf(g, p.id)).at(-1)!, BattleTarget.CITY)).toBeDefined();
    }));

  it("turns back a scout, and from a player's valley", () =>
    game(async (g) => {
      const { p, heroId, q, qHero } = await rivals(g);
      const valley = await whilePvpOn(() => occupyValley(g, q, qHero));
      const scout = await whilePvpOn(() => send(g, p, { targetTileId: valley.id, mission: Mission.SCOUT, troops: { scouter: 10 } }));
      await arrive(g, scout.armyId);
      await lastAborted(g, p.id);
      const attack = await whilePvpOn(() => send(g, p, { targetTileId: valley.id, mission: Mission.ATTACK, troops: { lightCavalry: 100 }, heroId }));
      await arrive(g, attack.armyId);
      await lastAborted(g, p.id);
      expect((await getTile(g, valley.id)).ownerPlayerId).toBe(q.id);
    }));

  it('turns back from a free valley a player took first while it marched, leaving no fight between them', () =>
    game(async (g) => {
      const { p, heroId, q, qHero } = await rivals(g);
      await setCityStats(g, p, { troops: { lightCavalry: 40_000 } });
      await setCityStats(g, q, { troops: { lightCavalry: 40_000 } });
      const valley = await valleyNear(g, p.cityId, { level: 1 });
      const mine = await send(g, p, { targetTileId: valley.id, mission: Mission.ATTACK, troops: { lightCavalry: 40_000 }, heroId });
      const theirs = await send(g, q, { targetTileId: valley.id, mission: Mission.ATTACK, troops: { lightCavalry: 40_000 }, heroId: qHero });
      await g.runDue(Math.max(mine.reachTime, theirs.reachTime));

      const holder = (await getTile(g, valley.id)).ownerPlayerId;
      expect([p.id, q.id]).toContain(holder);
      await lastAborted(g, holder === p.id ? q.id : p.id);
    }));

  it('fights barbarian cities and takes free valleys as before', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g, { lightCavalry: 80_000, scouter: 50 });
      const h2 = await addHero(g, p);
      const npc = await tileNear(g, p.cityId, TileType.NPC, { level: 1 });
      const attack = await send(g, p, { targetTileId: npc.id, mission: Mission.ATTACK, troops: { lightCavalry: 40_000 }, heroId });
      await arrive(g, attack.armyId);
      expect(battleOf((await reportsOf(g, p.id)).at(-1)!, BattleTarget.NPC)).toBeDefined();

      const scout = await send(g, p, { targetTileId: npc.id, mission: Mission.SCOUT, troops: { scouter: 5 } });
      await arrive(g, scout.armyId);
      expect(scoutOf((await reportsOf(g, p.id)).at(-1)!, BattleTarget.NPC)).toBeDefined();

      const valley = await valleyNear(g, p.cityId, { level: 1 });
      const capture = await send(g, p, { targetTileId: valley.id, mission: Mission.ATTACK, troops: { lightCavalry: 40_000 }, heroId: h2 });
      await arrive(g, capture.armyId);
      expect((await getTile(g, valley.id)).ownerPlayerId).toBe(p.id);
    }));
});

describe('the map', () => {
  it("offers nothing against another player's city or valley, and says the same of a held historic city", () =>
    game(async (g) => {
      const { p, q, qHero } = await rivals(g);
      const valley = await whilePvpOn(() => occupyValley(g, q, qHero));
      const none = { canLoot: false, canOccupy: false, canScout: false };
      expect(await world.fieldInfo(g, p.id, await cityTile(g, q.cityId))).toMatchObject(none);
      expect(await world.fieldInfo(g, p.id, valley.id)).toMatchObject(none);
      await makeSeat(g, q);
      expect(await world.fieldInfo(g, p.id, await cityTile(g, q.cityId))).toMatchObject({ ...none, historicLevel: 12 });
    }));

  it('still offers them with PvP on', () =>
    game(async (g) => {
      const { p, q, qHero } = await rivals(g);
      const valley = await whilePvpOn(() => occupyValley(g, q, qHero));
      const all = { canLoot: true, canOccupy: true, canScout: true };
      await whilePvpOn(async () => {
        expect(await world.fieldInfo(g, p.id, await cityTile(g, q.cityId))).toMatchObject(all);
        expect(await world.fieldInfo(g, p.id, valley.id)).toMatchObject(all);
      });
    }));

  it('still offers what no player holds, and sending to allies', () =>
    game(async (g) => {
      const { p, q } = await rivals(g);
      await allies(g, p, q);
      const all = { canLoot: true, canOccupy: true, canScout: true };
      expect(await world.fieldInfo(g, p.id, (await tileNear(g, p.cityId, TileType.NPC)).id)).toMatchObject(all);
      expect(await world.fieldInfo(g, p.id, (await valleyNear(g, p.cityId)).id)).toMatchObject(all);
      expect(await world.fieldInfo(g, p.id, (await tileNear(g, p.cityId, TileType.HISTORIC, { radius: 30 })).id)).toMatchObject(all);
      expect(await world.fieldInfo(g, p.id, await cityTile(g, q.cityId))).toMatchObject({ canLoot: false, canSend: true, canTrans: true });
    }));
});

describe('wave plans', () => {
  const landAt = (g: TestGame) => Math.floor((g.now + HOUR) / 1000) * 1000;

  it("refuses a plan on another player's city, and moving one there; one on a barbarian city is fine", () =>
    game(async (g) => {
      const { p, q } = await rivals(g);
      const theirs = await cityTile(g, q.cityId);
      await expectRefused(plans.create(g, p.id, { name: 'Raid', targetTileId: theirs, landAt: landAt(g), shared: false }), PVP_DISABLED);
      const npc = await tileNear(g, p.cityId, TileType.NPC);
      const { id } = await plans.create(g, p.id, { name: 'Break it', targetTileId: npc.id, landAt: landAt(g), shared: false });
      await expectRefused(plans.update(g, p.id, id, { name: 'Raid', targetTileId: theirs, landAt: landAt(g), shared: false }), PVP_DISABLED);
    }));

  it('refuses adding to or sending from a plan made while PvP was on', () =>
    game(async (g) => {
      const { p, heroId, q } = await rivals(g);
      const theirs = await cityTile(g, q.cityId);
      const wave = { cityId: p.cityId, mission: Mission.ATTACK, troops: { lightCavalry: 100 }, heroId };
      const { planId, waveId } = await whilePvpOn(async () => {
        const { id } = await plans.create(g, p.id, { name: 'Raid', targetTileId: theirs, landAt: landAt(g), shared: false });
        return { planId: id, waveId: (await plans.addWave(g, p.id, id, wave)).id };
      });
      await expectRefused(plans.addWave(g, p.id, planId, wave), PVP_DISABLED);
      await expectRefused(plans.sendWave(g, p.id, planId, waveId), PVP_DISABLED);
      expect(g.events(TimedEventType.ARMY)).toHaveLength(0);
    }));
});

describe('truces', () => {
  it('are not for sale and cannot be started, costing nothing', () =>
    game(async (g) => {
      const { p } = await rivals(g);
      const sold = shop.catalogue().flatMap((c) => c.items.map((i) => i.id));
      expect(sold).not.toContain(ItemId.TRUCE_AGREEMENT);
      expect(sold).toContain(ItemId.WAR_HORN);
      await expectRefused(shop.buyItemWithGold(g, p.id, p.cityId, ItemId.TRUCE_AGREEMENT, 1), msg('item.notForSale'));
      await giveItems(g, p, { [ItemId.TRUCE_AGREEMENT]: 1 });
      const { gold } = await reloadCity(g, p.cityId);
      await expectRefused(players.startTruce(g, p.id, ItemId.TRUCE_AGREEMENT, p.cityId), msg('player.truce.pvpDisabled'));
      expect((await reloadCity(g, p.cityId)).gold).toBe(gold);
      expect((await reloadPlayer(g, p)).items[ItemId.TRUCE_AGREEMENT]).toBe(1);
    }));

  it('are sold and started with PvP on', () =>
    game(async (g) => {
      const { p } = await rivals(g);
      await whilePvpOn(async () => {
        expect(shop.catalogue().flatMap((c) => c.items.map((i) => i.id))).toContain(ItemId.TRUCE_AGREEMENT);
        await players.startTruce(g, p.id, ItemId.TRUCE_AGREEMENT, p.cityId);
      });
    }));
});

describe('the end of beginner protection', () => {
  const mailsOf = (g: TestGame, playerId: number) => g.tx.select().from(mails).where(eq(mails.playerId, playerId));

  it('ends without the mail saying other players can now attack', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const row = await reloadPlayer(g, p);
      await checkBeginner(g, row, BALANCE.beginnerTownHallLevel);
      expect(row.beginner).toBe(false);
      expect(await mailsOf(g, p.id)).toEqual([]);
    }));

  it('sends it with PvP on', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const row = await reloadPlayer(g, p);
      await whilePvpOn(() => checkBeginner(g, row, BALANCE.beginnerTownHallLevel));
      expect(await mailsOf(g, p.id)).toHaveLength(1);
    }));
});

describe('besieging a historic city nobody holds', () => {
  const FULL = BALANCE.historic.loyalty;

  it('counts each player’s wins apart: a stranger’s wave starts from full', () =>
    game(async (g) => {
      const a = await besieger(g);
      const b = await besieger(g);
      const seat = await seatTile(g, a.p);
      const first = await waveOnSeat(g, a.p, a.heroId, seat.id);
      expect(first.report).toMatchObject({ loyaltyDamage: A_WIN, loyaltyLeft: FULL - A_WIN, captured: false });
      const second = await waveOnSeat(g, b.p, b.heroId, seat.id);
      expect(second.report).toMatchObject({ loyaltyDamage: A_WIN, loyaltyLeft: FULL - A_WIN, captured: false });
    }));

  it('a last wave can’t steal another side’s capture, however close they were', () =>
    game(async (g) => {
      const a = await besieger(g);
      const b = await besieger(g);
      const seat = await seatTile(g, a.p);
      const { report, tile } = await waveOnSeat(g, b.p, b.heroId, seat.id, { sieges: { [`player:${a.p.id}`]: 0 } });
      expect(report).toMatchObject({ captured: false, loyaltyLeft: FULL - A_WIN });
      expect(tile.type).toBe(TileType.HISTORIC);
    }));

  it('the side that wears down its own loyalty captures it, and everyone else’s progress and armies go', () =>
    game(async (g) => {
      const a = await besieger(g);
      const b = await besieger(g);
      const seat = await seatTile(g, a.p);
      // timed to land long after the capture
      const late = await send(g, b.p, { targetTileId: seat.id, mission: Mission.SCOUT, troops: { scouter: 1 }, arriveAt: g.now + 23 * HOUR });
      const sieges = { [`player:${a.p.id}`]: A_WIN, [`player:${b.p.id}`]: A_WIN };
      const { report, tile } = await waveOnSeat(g, a.p, a.heroId, seat.id, { sieges });
      expect(report).toMatchObject({ captured: true, loyaltyLeft: 0 });
      expect(tile).toMatchObject({ type: TileType.CASTLE, ownerPlayerId: a.p.id, state: null });
      await arrive(g, late.armyId);
      await lastAborted(g, b.p.id);
      await expectRefused(send(g, b.p, { targetTileId: seat.id, mission: Mission.ATTACK, troops: { archer: 100 }, heroId: b.heroId }), PVP_DISABLED);
    }));

  it('adds up the wins of an alliance’s members', () =>
    game(async (g) => {
      const a = await besieger(g);
      const b = await besieger(g);
      await allies(g, a.p, b.p);
      const seat = await seatTile(g, a.p);
      expect((await waveOnSeat(g, a.p, a.heroId, seat.id)).report.loyaltyLeft).toBe(FULL - A_WIN);
      expect((await waveOnSeat(g, b.p, b.heroId, seat.id)).report.loyaltyLeft).toBe(FULL - 2 * A_WIN);
    }));

  it('lets any member of the alliance land the last win, and the city is theirs', () =>
    game(async (g) => {
      const a = await besieger(g);
      const b = await besieger(g);
      const allianceId = await allies(g, a.p, b.p);
      const seat = await seatTile(g, a.p);
      const { report, tile } = await waveOnSeat(g, b.p, b.heroId, seat.id, { sieges: { [`alliance:${allianceId}`]: A_WIN } });
      expect(report).toMatchObject({ captured: true, loyaltyLeft: 0 });
      expect(tile.ownerPlayerId).toBe(b.p.id);
    }));

  it('leaves the alliance’s count behind when a player leaves it', () =>
    game(async (g) => {
      const a = await besieger(g);
      const b = await besieger(g);
      const allianceId = await allies(g, a.p, b.p);
      const seat = await seatTile(g, a.p);
      await alliance.leaveAlliance(g, b.p.id);
      const { report } = await waveOnSeat(g, b.p, b.heroId, seat.id, { sieges: { [`alliance:${allianceId}`]: A_WIN } });
      expect(report).toMatchObject({ captured: false, loyaltyLeft: FULL - A_WIN });
    }));

  it('stays at 0 for the same side’s next win when the winner can’t hold it', () =>
    game(async (g) => {
      const a = await besieger(g);
      const b = await besieger(g);
      const allianceId = await allies(g, a.p, b.p);
      await admin.setPlayerFlags(g, a.p.name, { title: 0 });
      const seat = await seatTile(g, a.p);
      const first = await waveOnSeat(g, a.p, a.heroId, seat.id, { sieges: { [`alliance:${allianceId}`]: A_WIN } });
      expect(first.report).toMatchObject({ captured: false, loyaltyLeft: 0 });
      const second = await waveOnSeat(g, b.p, b.heroId, seat.id);
      expect(second.report).toMatchObject({ captured: true, loyaltyDamage: 0, loyaltyLeft: 0 });
    }));

  it('a scout reports the scouting side’s own loyalty, and leaves every side’s as it was', () =>
    game(async (g) => {
      const a = await besieger(g);
      const b = await besieger(g);
      const seat = await seatTile(g, a.p);
      const sieges = { [`player:${a.p.id}`]: 40 };
      for (const [who, loyalty] of [
        [a, 40],
        [b, FULL],
      ] as const) {
        const scout = await send(g, who.p, { targetTileId: seat.id, mission: Mission.SCOUT, troops: { scouter: 1 } });
        await breakSeat(g, seat.id, scout.reachTime, { sieges });
        await arrive(g, scout.armyId);
        expect(scoutOf((await reportsOf(g, who.p.id)).at(-1)!, BattleTarget.NPC).loyalty).toBe(loyalty);
        const after = (await getTile(g, seat.id)).state as unknown as HistoricState;
        expect(after.sieges).toEqual({ [`player:${a.p.id}`]: { loyalty: 40, loyaltyAt: scout.reachTime } });
      }
    }));
});

describe('besieging a historic city with PvP on', () => {
  it('still counts every side’s wins together, so a rival can land the last one', () =>
    game(async (g) => {
      pvp(true);
      const a = await besieger(g);
      const b = await besieger(g);
      const seat = await seatTile(g, a.p);
      const first = await waveOnSeat(g, a.p, a.heroId, seat.id);
      expect(first.report).toMatchObject({ loyaltyLeft: BALANCE.historic.loyalty - A_WIN, captured: false });
      const last = await waveOnSeat(g, b.p, b.heroId, seat.id, { loyalty: A_WIN });
      expect(last.report).toMatchObject({ loyaltyLeft: 0, captured: true });
      expect(last.tile.ownerPlayerId).toBe(b.p.id);
    }));
});
