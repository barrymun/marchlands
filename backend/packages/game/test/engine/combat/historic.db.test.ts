// processArmy against historic cities (docs/features/historical-cities.md): scouting one, and attacks on its garrison
// and loyalty. Capturing one comes with the next phase.

import { and, eq, inArray } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { PushCmd } from '@marchlands/contracts';
import {
  BALANCE,
  BuildingType,
  DAY,
  dur,
  factionRivals,
  HeroStatus,
  historicCities,
  historicCityBuildings,
  historicDay,
  historicGarrison,
  historicNameAt,
  type HistoricState,
  homeFaction,
  MarketSide,
  Mission,
  msg,
  nextAutoDraftAt,
  TechType,
  tileDistance,
  TileType,
  tileXY,
} from '@marchlands/core';
import { armies as armyRows, heroes as heroRows } from '@marchlands/db';

import { processArmy } from '#/engine/combat.ts';
import { ship } from '#/engine/market.ts';
import { abandon, admin, armies, buildings, heroes, interior, market, plans, player, research, world } from '#/index.ts';
import { getCity, getHero, getPlayer, getTile, saveCity, saveTile } from '#/repo.ts';
import { arrive, battleOf, reportsOf, scoutOf, send, tileNear, warrior } from '#test/support/armies.ts';
import { expectRefused } from '#test/support/expect.ts';
import { addHero, createTestPlayer, reloadCity, setResources, type TestPlayer } from '#test/support/factories.ts';
import { game, type TestGame } from '#test/support/game.ts';
import { Res } from '#test/support/market.ts';
import { withAcademy } from '#test/support/research.ts';

/** The nearest historic city with a name of its own to a player's city (a level 14, 16 or Atlantis), and its name. */
async function namedSeatNear(g: TestGame, p: TestPlayer) {
  const from = (await reloadCity(g, p.cityId)).tileId;
  const named = historicCities(BALANCE.mapSize).flatMap(({ x, y }) => {
    const name = historicNameAt(x, y);
    return name ? [{ id: y * BALANCE.mapSize + x, name }] : [];
  });
  const [nearest] = named.sort((a, b) => tileDistance(from, a.id) - tileDistance(from, b.id));
  if (!nearest) throw new Error('no named historic city');
  return { seat: await getTile(g, nearest.id), name: nearest.name };
}

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
async function lastWave(g: TestGame, p: TestPlayer, heroId: number, target?: Awaited<ReturnType<typeof getTile>>) {
  const seat = target ?? (await seatNear(g, p));
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

  it('keeps its own name at every level, which can’t be changed', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g, { archer: 120_000 });
      await admin.setPlayerFlags(g, p.name, { title: 2 });
      // a level 12 has its own name too (recorded or invented, LEVEL_12_NAMES)
      const { seat: twelve } = await lastWave(g, p, heroId);
      const twelveCity = (await getTile(g, twelve.id)).cityId!;
      const { x: tx, y: ty } = tileXY(twelve.id);
      const twelveName = historicNameAt(tx, ty)!;
      expect((await getCity(g, twelveCity)).name).toBe(twelveName);
      await expectRefused(interior.renameCity(g, p.id, twelveCity, 'Twelve'), msg('city.historicKeepsName', { name: twelveName }));
      // a level 14: renaming is refused, a new logo isn't
      const { seat, name } = await namedSeatNear(g, p);
      const { report } = await lastWave(g, p, await addHero(g, p), seat);
      expect(report.captured).toBe(true);
      const cityId = (await getTile(g, seat.id)).cityId!;
      expect((await getCity(g, cityId)).name).toBe(name);
      await expectRefused(interior.renameCity(g, p.id, cityId, 'Mine'), msg('city.historicKeepsName', { name }));
      await interior.renameCity(g, p.id, cityId, undefined, 'images/icon/cityLogo/x.png');
      expect(await getCity(g, cityId)).toMatchObject({ name, logoUrl: 'images/icon/cityLogo/x.png' });
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

  it('can’t be moved, its fields can be demolished, and a restart leaves it a historic city again', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g, { archer: 60_000 });
      await admin.setPlayerFlags(g, p.name, { title: 1 });
      const { seat } = await lastWave(g, p, heroId);
      const cityId = (await getTile(g, seat.id)).cityId!;
      const flat = await tileNear(g, p.cityId, TileType.FLAT);
      await expectRefused(interior.moveCity(g, p.id, cityId, flat.id), msg('city.historicCannotMove'));
      // its fields stand at its own level, and can be demolished and built back up to it (services/buildings-seat.db.test.ts)
      const field = (await getCity(g, cityId)).buildings.find((b) => b.positionId === 1001);
      expect(field).toMatchObject({ typeId: BuildingType.FARM, level: 12 });
      await buildings.demolish(g, p.id, cityId, 1001);
      expect((await getCity(g, cityId)).buildings.some((b) => b.positionId === 1001)).toBe(false);
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

  it('the win that leaves it at 0 hands it to the winner', () =>
    game(async (g) => {
      const { p, q, seat, cityId, attack } = await heldSeat(g);
      // as the waves before it left it: 3 loyalty as it lands; its holder had turned drafting by itself off
      const r = await attack(async (at) => saveCity(g, { ...(await getCity(g, cityId)), loyalty: 3, loyaltyAt: at, draftAuto: false }));
      expect(r.seat).toMatchObject({ loyaltyLeft: 0, captured: true });
      expect(await getCity(g, cityId)).toMatchObject({
        playerId: q.id,
        // it keeps its own name under its new holder
        name: historicNameAt(tileXY(seat.id).x, tileXY(seat.id).y),
        historicLevel: 12,
        loyalty: BALANCE.historic.loyalty,
        truceUntil: g.now + BALANCE.historic.truceMs,
        draftAuto: true,
        draftNextAt: nextAutoDraftAt(g.now),
      });
      expect((await getTile(g, seat.id)).ownerPlayerId).toBe(q.id);
      expect((await reportsOf(g, p.id)).at(-1)!.title).toEqual(msg('report.title.seatLost'));
    }));

  /** q's win that takes the seat: 3 loyalty left as it lands. */
  const takeIt = (g: TestGame, cityId: number, attack: (beforeLanding?: (at: number) => Promise<void>) => Promise<unknown>) =>
    attack(async (at) => saveCity(g, { ...(await getCity(g, cityId)), loyalty: 3, loyaltyAt: at }));

  it('loses all its old holder had in it, nothing moving to their other city', () =>
    game(async (g) => {
      const { p, cityId, attack } = await heldSeat(g);
      const seatHero = await addHero(g, p, 1, cityId);
      const seatMayor = await addHero(g, p, 1, cityId);
      await heroes.appointMayor(g, p.id, seatMayor);
      const leader = await addHero(g, p, 1, cityId);
      const home = await addHero(g, p, 1, p.cityId);
      await setResources(g, p, { gold: 1_000_000, food: 1_000_000 }, cityId);
      await saveCity(g, { ...(await getCity(g, cityId)), troops: { archer: 100 } });

      const target = await tileNear(g, p.cityId, TileType.NPC, { level: 1 });
      const out = await armies.sendArmy(g, p.id, cityId, { targetTileId: target.id, mission: Mission.ATTACK, troops: { archer: 100 }, heroId: leader });
      await market.placeOrder(g, p.id, cityId, { resType: Res.STONE, side: MarketSide.BUY, amount: 10, price: 0.5 });
      await ship(g, { playerId: p.id, cityId, orderId: null, resType: Res.STONE, amount: 10, price: 1, ms: 60_000 });
      const plan = await plans.create(g, p.id, { name: 'Plan', targetTileId: target.id, landAt: g.now + DAY, shared: false });
      await plans.addWave(g, p.id, plan.id, { cityId, mission: Mission.ATTACK, troops: { archer: 1 } });
      const offers = () =>
        g.tx
          .select({ id: heroRows.id })
          .from(heroRows)
          .where(and(eq(heroRows.cityId, cityId), eq(heroRows.inTavern, true)));
      const innOffers = await offers();

      await takeIt(g, cityId, attack);

      expect(
        await g.tx
          .select()
          .from(heroRows)
          .where(inArray(heroRows.id, [seatHero, seatMayor, leader])),
      ).toEqual([]);
      expect(await g.tx.select().from(armyRows).where(eq(armyRows.id, out.armyId))).toEqual([]);
      expect(await market.myOrders(g, p.id)).toEqual([]);
      expect(await market.myShipments(g, p.id)).toEqual([]);
      // the plan stays, without the wave: left on a city no longer theirs, the wave would refuse the whole list
      expect(await plans.list(g, p.id)).toMatchObject([{ id: plan.id, waves: [] }]);
      // the Inn's offers stay with the city, and nothing of their other city goes
      expect(await offers()).toEqual(innOffers);
      expect((await getHero(g, home)).cityId).toBe(p.cityId);
      // none of the lost things' timed events is left to run
      expect(
        g
          .events('army.depart')
          .concat(g.events('shipment'))
          .filter((e) => e.playerId === p.id),
      ).toEqual([]);
      await g.runDue(g.now + DAY);
    }));

  it('leaves their other city as it was, its mayor included', () =>
    game(async (g) => {
      const { p, cityId, attack } = await heldSeat(g);
      const mayor = await addHero(g, p, 1, p.cityId);
      await heroes.appointMayor(g, p.id, mayor);
      await takeIt(g, cityId, attack);
      expect((await getHero(g, mayor)).status).toBe(HeroStatus.MAYOR);
    }));

  it('cancels research running there, leaving research elsewhere running', () =>
    game(async (g) => {
      const { p, cityId, attack } = await heldSeat(g);
      const plenty = { gold: 1_000_000, food: 1_000_000, wood: 1_000_000, stone: 1_000_000, iron: 1_000_000 };
      await withAcademy(g, p);
      let level = -1;
      let elsewhere = 0;
      // started a moment before it lands, so neither is done by then
      await attack(async (at) => {
        g.advance(at - g.now - 1_000);
        await setResources(g, p, plenty, cityId);
        await setResources(g, p, plenty);
        ({ level } = await research.startResearch(g, p.id, cityId, TechType.AGRICULTURE));
        elsewhere = (await research.startResearch(g, p.id, p.cityId, TechType.LUMBERING)).endTime;
        await saveCity(g, { ...(await getCity(g, cityId)), loyalty: 3, loyaltyAt: at });
      });

      const after = await getPlayer(g, p.id);
      // back at the level it had, the level under way lost
      expect(after.research[TechType.AGRICULTURE]).toEqual({ level });
      expect(after.research[TechType.LUMBERING]).toMatchObject({ cityId: p.cityId, endTime: elsewhere });
      expect(g.events('research').map((e) => e.payload)).toEqual([{ techId: TechType.LUMBERING }]);
      expect(g.pushes(PushCmd.RESEARCH_UPDATE).at(-1)?.data).toEqual({ castleId: cityId, typeId: TechType.AGRICULTURE, endTime: 0 });
      // they can start it again in their other city
      await research.startResearch(g, p.id, p.cityId, TechType.AGRICULTURE);
    }));

  it('tells its old holder the city is lost, and calls off abandoning it', () =>
    game(async (g) => {
      const { p, cityId, attack } = await heldSeat(g);
      // started a moment before it lands, so its hour is still running
      await attack(async (at) => {
        g.advance(at - g.now - 1_000);
        await abandon.abandonCity(g, p.id, cityId);
        await saveCity(g, { ...(await getCity(g, cityId)), loyalty: 3, loyaltyAt: at });
      });
      expect((await getCity(g, cityId)).abandonAt).toBe(0);
      expect(g.events('city.abandon')).toEqual([]);
      expect(
        g
          .pushes(PushCmd.CASTLE_UPDATE)
          .filter((x) => x.playerIds.includes(p.id))
          .at(-1)?.data,
      ).toEqual({ updateType: 1, castleBean: { id: cityId } });
    }));

  it('tells whoever a lost army was marching on that it is gone', () =>
    game(async (g) => {
      const { p, cityId, attack } = await heldSeat(g);
      const other = await createTestPlayer(g);
      const leader = await addHero(g, p, 1, cityId);
      await saveCity(g, { ...(await getCity(g, cityId)), troops: { archer: 100 } });
      const target = await tileNear(g, p.cityId, TileType.NPC, { level: 1 });
      const out = await armies.sendArmy(g, p.id, cityId, { targetTileId: target.id, mission: Mission.ATTACK, troops: { archer: 100 }, heroId: leader });
      await g.tx.update(armyRows).set({ targetPlayerId: other.id }).where(eq(armyRows.id, out.armyId));
      await takeIt(g, cityId, attack);
      expect(
        g
          .pushes(PushCmd.ENEMY_ARMIES_UPDATE)
          .filter((x) => x.playerIds.includes(other.id))
          .at(-1)?.data,
      ).toEqual({ armys: [] });
    }));
});
