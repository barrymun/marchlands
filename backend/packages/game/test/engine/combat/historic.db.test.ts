// processArmy against historic cities (docs/features/historical-cities.md): scouting one, and attacks on its garrison
// and loyalty. Capturing one comes with the next phase.

import { describe, expect, it } from 'vitest';

import {
  BALANCE,
  BuildingType,
  DAY,
  dur,
  factionRivals,
  historicCityBuildings,
  historicDay,
  historicGarrison,
  type HistoricState,
  homeFaction,
  Mission,
  msg,
  nextAutoDraftAt,
  ref,
  TileType,
  tileXY,
} from '@marchlands/core';

import { processArmy } from '#/engine/combat.ts';
import { admin, armies, buildings, interior, player, world } from '#/index.ts';
import { getCity, getHero, getTile, saveCity, saveTile } from '#/repo.ts';
import { arrive, battleOf, reportsOf, scoutOf, send, tileNear, warrior } from '#test/support/armies.ts';
import { expectRefused } from '#test/support/expect.ts';
import { addHero, reloadCity, type TestPlayer } from '#test/support/factories.ts';
import { game, type TestGame } from '#test/support/game.ts';

/** The nearest level 12 historic city to a player's city (they stand every 18 tiles, so one is always near). */
async function seatNear(g: TestGame, p: TestPlayer) {
  const { x, y } = tileXY((await reloadCity(g, p.cityId)).tileId);
  const found = (await world.searchTiles(g, x, y, 30, TileType.HISTORIC)).find((t) => t.level === 12);
  if (!found) throw new Error('no level 12 historic city near');
  return getTile(g, found.id);
}

describe(`${processArmy.name}: historic cities`, () => {
  it('a scout sees the day’s whole garrison, its fortifications and its loyalty', () =>
    game(async (g) => {
      const { p } = await warrior(g);
      const seat = await seatNear(g, p);
      const scout = await send(g, p, { targetTileId: seat.id, mission: Mission.SCOUT, troops: { scouter: 1 } });
      await arrive(g, scout.armyId);
      const s = scoutOf((await reportsOf(g, p.id)).at(-1)!, 'npc');
      const full = historicGarrison(12, historicDay(seat.id, Math.floor(scout.reachTime / DAY)));
      expect(s).toMatchObject({ level: 12, loyalty: BALANCE.historic.loyalty, troops: full.troops, fortifications: full.forts, wallLevel: 12 });
    }));

  it('a small attack fails and leaves the garrison a little weaker', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      const seat = await seatNear(g, p);
      const bean = await send(g, p, { targetTileId: seat.id, mission: Mission.ATTACK, troops: { lightCavalry: 2000 }, heroId });
      await arrive(g, bean.armyId);
      const r = (await reportsOf(g, p.id)).at(-1)!;
      expect(r.title).toEqual(msg('report.title.attackFailed'));
      const b = battleOf(r, 'npc');
      expect(b).toMatchObject({ level: 12, loyaltyDamage: 0, loyaltyLeft: BALANCE.historic.loyalty, captured: false });
      // even a lost attack costs standing with the faction whose state it stands in
      const change = -BALANCE.reputation.attackPerLevel * 12;
      expect(b.standing).toEqual({ faction: homeFaction(seat.id)!.id, change, now: change });
      expect(b.rivals).toBeUndefined();
      const tile = await getTile(g, seat.id);
      expect(tile.troops).toEqual(b.defender.troops.after);
      expect((tile.state as unknown as HistoricState).loyalty).toBe(BALANCE.historic.loyalty);
    }));

  it('a won attack on a broken garrison takes its share of loyalty and some loot', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g, { archer: 60_000 });
      const seat = await seatNear(g, p);
      // as the waves before it left it: no troops or fortifications, loyalty full
      const bean = await send(g, p, { targetTileId: seat.id, mission: Mission.ATTACK, troops: { archer: 60_000 }, heroId });
      const day = Math.floor(bean.reachTime / DAY);
      const state = {
        gold: 0,
        food: 1_000_000,
        wood: 0,
        stone: 0,
        iron: 0,
        loyalty: BALANCE.historic.loyalty,
        population: 0,
        regenAt: bean.reachTime,
        loyaltyAt: bean.reachTime,
        refillAt: bean.reachTime,
        day,
      };
      await saveTile(g, { ...seat, troops: {}, forts: {}, state });
      await arrive(g, bean.armyId);
      const b = battleOf((await reportsOf(g, p.id)).at(-1)!, 'npc');
      expect(b).toMatchObject({
        result: 'attackerWon',
        loyaltyDamage: BALANCE.historic.loyaltyPerWin,
        loyaltyLeft: BALANCE.historic.loyalty - BALANCE.historic.loyaltyPerWin,
        captured: false,
      });
      expect(b.plunder.food).toBeGreaterThan(0);
      expect((await getTile(g, seat.id)).type).toBe(TileType.HISTORIC);
    }));
});

/** p wins the last loyalty off a level 12 historic city near it (its garrison broken, 3 loyalty left); returns its tile. */
async function lastWave(g: TestGame, p: TestPlayer, heroId: number) {
  const seat = await seatNear(g, p);
  const bean = await send(g, p, { targetTileId: seat.id, mission: Mission.ATTACK, troops: { archer: 60_000 }, heroId });
  const day = Math.floor(bean.reachTime / DAY);
  const at = bean.reachTime;
  const state = {
    gold: 0,
    food: 0,
    wood: 0,
    stone: 0,
    iron: 0,
    loyalty: BALANCE.historic.loyaltyPerWin,
    population: 0,
    regenAt: at,
    loyaltyAt: at,
    refillAt: at,
    day,
  };
  await saveTile(g, { ...seat, troops: {}, forts: {}, state });
  await arrive(g, bean.armyId);
  return { seat, report: battleOf((await reportsOf(g, p.id)).at(-1)!, 'npc') };
}

describe(`${processArmy.name}: capturing a historic city`, () => {
  it('the win that leaves it at 0 loyalty makes it the attacker’s city: level 10 buildings, fields at its level, a truce', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g, { archer: 60_000 });
      await admin.setPlayerFlags(g, p.name, { title: 1 });
      const { seat, report } = await lastWave(g, p, heroId);
      expect(report).toMatchObject({ captured: true, loyaltyLeft: 0 });
      // its faction loses the capture's standing too, and its rivals each gain a share of that
      const R = BALANCE.reputation;
      const cost = R.capture * R.seat.captureFactor[12];
      const own = homeFaction(seat.id)!;
      expect(report.standing).toMatchObject({ faction: own.id, change: -(R.attackPerLevel * 12 + cost) });
      expect(report.rivals?.map((r) => r.faction)).toEqual(factionRivals(own.id).map((f) => f.id));
      expect(report.rivals?.every((r) => r.change === cost * R.seat.rivalShare)).toBe(true);
      const tile = await getTile(g, seat.id);
      expect(tile).toMatchObject({ type: TileType.CASTLE, ownerPlayerId: p.id });
      const city = await getCity(g, tile.cityId!);
      expect(city).toMatchObject({ playerId: p.id, historicLevel: 12, truceUntil: g.now + BALANCE.historic.truceMs });
      // it drafts by itself from the next part of the day, not making up the parts before its capture
      expect(city).toMatchObject({ draftAuto: true, draftNextAt: nextAutoDraftAt(g.now) });
      expect(city.buildings).toEqual(historicCityBuildings(12));
      // its Rally Spot (level 10) sends a quarter more
      expect((await armies.troopParams(g, p.id, city.id)).maxTroops).toBe(125_000);
    }));

  it('is not taken without a free city slot: it stays at 0 loyalty for the next win', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g, { archer: 60_000 });
      const { seat, report } = await lastWave(g, p, heroId);
      expect(report).toMatchObject({ captured: false, loyaltyLeft: 0 });
      expect((await getTile(g, seat.id)).type).toBe(TileType.HISTORIC);
    }));

  it('is not taken past the limit of its level', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g, { archer: 60_000 * (BALANCE.historic.holdLimit[12] + 1) });
      await admin.setPlayerFlags(g, p.name, { title: 9 });
      const held = BALANCE.historic.holdLimit[12];
      for (let i = 0; i < held; i++) {
        const { report } = await lastWave(g, p, await addHero(g, p));
        expect(report.captured).toBe(true);
      }
      const { report } = await lastWave(g, p, heroId);
      expect(report.captured).toBe(false);
    }));

  it('holds a truce of its own: others are refused until it ends, and then its holder’s protection doesn’t cover it', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g, { archer: 60_000 });
      await admin.setPlayerFlags(g, p.name, { title: 1 });
      const { seat } = await lastWave(g, p, heroId);
      // the holder under beginner protection, which would keep any other city of theirs safe
      await admin.setPlayerFlags(g, p.name, { beginner: true });
      const { p: q, heroId: qHero } = await warrior(g);
      const attack = () => send(g, q, { targetTileId: seat.id, mission: Mission.ATTACK, troops: { lightCavalry: 10 }, heroId: qHero });
      await expectRefused(attack(), msg('army.historicTruce', { time: dur(BALANCE.historic.truceMs) }));
      g.advance(BALANCE.historic.truceMs);
      expect((await attack()).missionType).toBe(Mission.ATTACK);
    }));

  it('can’t be moved, its high fields can’t be demolished, and a restart leaves it a historic city again', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g, { archer: 60_000 });
      await admin.setPlayerFlags(g, p.name, { title: 1 });
      const { seat } = await lastWave(g, p, heroId);
      const cityId = (await getTile(g, seat.id)).cityId!;
      const flat = await tileNear(g, p.cityId, TileType.FLAT);
      await expectRefused(interior.moveCity(g, p.id, cityId, flat.id), msg('city.historicCannotMove'));
      await expectRefused(buildings.demolish(g, p.id, cityId, 1001), msg('building.historicField', { building: ref.building(BuildingType.FARM), level: 12 }));
      await player.restartPlayer(g, p.id);
      expect(await getTile(g, seat.id)).toMatchObject({ type: TileType.HISTORIC, level: 12, cityId: null, ownerPlayerId: null, state: null });
    }));
});

describe(`${processArmy.name}: taking a held historic city`, () => {
  /** p holds a level 12 seat (captured as lastWave does); q, ready to take one too, attacks it once its truce is over. */
  async function heldSeat(g: TestGame) {
    const { p, heroId } = await warrior(g, { archer: 60_000 });
    await admin.setPlayerFlags(g, p.name, { title: 1 });
    const { seat } = await lastWave(g, p, heroId);
    const cityId = (await getTile(g, seat.id)).cityId!;
    const { p: q, heroId: qHero } = await warrior(g, { archer: 60_000 });
    await admin.setPlayerFlags(g, q.name, { title: 1 });
    g.advance(BALANCE.historic.truceMs);
    /** q's attack; `beforeLanding` runs once it's sent, with its landing time */
    const attack = async (beforeLanding?: (at: number) => Promise<void>) => {
      const bean = await send(g, q, { targetTileId: seat.id, mission: Mission.ATTACK, troops: { archer: 20_000 }, heroId: qHero });
      await beforeLanding?.(bean.reachTime);
      await arrive(g, bean.armyId);
      return battleOf((await reportsOf(g, q.id)).at(-1)!, 'city');
    };
    return { p, q, seat, cityId, attack };
  }

  it('a rival’s win takes 3 loyalty off it, which comes back over time', () =>
    game(async (g) => {
      const { cityId, attack } = await heldSeat(g);
      const r = await attack();
      expect(r.result).toBe('attackerWon');
      expect(r.seat).toEqual({ level: 12, loyaltyDamage: 3, loyaltyLeft: BALANCE.historic.loyalty - 3, captured: false });
      expect((await getCity(g, cityId)).loyalty).toBe(BALANCE.historic.loyalty - 3);
    }));

  it('the win that leaves it at 0 hands it to the winner, its old holder’s heroes going to their other city', () =>
    game(async (g) => {
      const { p, q, seat, cityId, attack } = await heldSeat(g);
      const pHero = await addHero(g, p, 1, cityId);
      // as the waves before it left it: 3 loyalty as it lands; its holder had turned drafting by itself off
      const r = await attack(async (at) => saveCity(g, { ...(await getCity(g, cityId)), loyalty: 3, loyaltyAt: at, draftAuto: false }));
      expect(r.seat).toMatchObject({ loyaltyLeft: 0, captured: true });
      expect(await getCity(g, cityId)).toMatchObject({
        playerId: q.id,
        historicLevel: 12,
        loyalty: BALANCE.historic.loyalty,
        truceUntil: g.now + BALANCE.historic.truceMs,
        draftAuto: true,
        draftNextAt: nextAutoDraftAt(g.now),
      });
      expect((await getTile(g, seat.id)).ownerPlayerId).toBe(q.id);
      expect((await getHero(g, pHero)).cityId).toBe(p.cityId);
      expect((await reportsOf(g, p.id)).at(-1)!.title).toEqual(msg('report.title.seatLost'));
    }));
});
