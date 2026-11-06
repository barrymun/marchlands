// Abandoning a city (docs/features/abandoning-a-city.md): the hour's notice, what stops it, and what goes when it's up.

import { and, eq, inArray } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { PushCmd } from '@marchlands/contracts';
import {
  ArmyDirection,
  BALANCE,
  BattleTarget,
  BuildingType,
  DAY,
  dur,
  FlowActionType,
  HeroStatus,
  HOUR,
  MarketSide,
  Mission,
  msg,
  ref,
  TechType,
  TileType,
  TimedEventType,
} from '@marchlands/core';
import { armies as armyRows, cities, heroes as heroRows, timedEvents, warPlanWaves } from '@marchlands/db';

import { completeAbandon } from '#/engine/abandon.ts';
import { armiesNowAimAtCity } from '#/engine/armies.ts';
import { ship } from '#/engine/market.ts';
import { abandon, armies, flows, heroes, interior, market, plans, research } from '#/index.ts';
import { citiesOf, getCity, getHero, getPlayer, getTile, saveCity, savePlayer } from '#/repo.ts';
import {
  allies,
  arrive,
  battleOf,
  cityTile,
  lastPush,
  lastReport,
  occupyValley,
  reportsOf,
  reportTitles,
  send,
  tileNear,
  warCity,
  warrior,
} from '#test/support/armies.ts';
import { expectRefused } from '#test/support/expect.ts';
import { addCity, addHero, createTestPlayer, setBuildings, setResources, type TestPlayer } from '#test/support/factories.ts';
import { armyPreset, flowOf, mayor, newFlow, runFlowIn, withHero } from '#test/support/flows.ts';
import { game, type TestGame } from '#test/support/game.ts';
import { makeSeat } from '#test/support/historic.ts';
import { Res } from '#test/support/market.ts';
import { withAcademy } from '#test/support/research.ts';

const PLENTY = { gold: 1_000_000, food: 1_000_000, wood: 1_000_000, stone: 1_000_000, iron: 1_000_000 };

/** A player ready for war with a second regular city, so their first may go. */
async function withSecondCity(g: TestGame) {
  const { p, heroId } = await warrior(g);
  const other = await addCity(g, p, 'Eastwold');
  return { p, heroId, other };
}

/** Start abandoning the player's first city and run its hour out, nothing else happening meanwhile. */
async function abandonNow(g: TestGame, p: TestPlayer) {
  await abandon.abandonCity(g, p.id, p.cityId);
  g.advance(BALANCE.abandon.delayMs);
  await completeAbandon(g, p.cityId);
}

const armyRow = async (g: TestGame, id: number) => (await g.tx.select().from(armyRows).where(eq(armyRows.id, id)))[0];

describe(abandon.abandonCity.name, () => {
  it('starts the real hour, the city staying as it was until then', () =>
    game(async (g) => {
      const { p } = await withSecondCity(g);
      const out = await abandon.abandonCity(g, p.id, p.cityId);
      const at = g.now + BALANCE.abandon.delayMs;
      expect(out).toEqual({ abandonAt: at });
      expect((await getCity(g, p.cityId)).abandonAt).toBe(at);
      expect(g.events(TimedEventType.CITY_ABANDON)).toMatchObject([{ dueAt: at, playerId: p.id, cityId: p.cityId, refKey: `abandon:${p.cityId}` }]);
      const pushed = lastPush(g, PushCmd.CASTLE_UPDATE, p.id);
      expect(pushed?.data).toMatchObject({ updateType: 2, castleBean: { id: p.cityId, abandonAt: at } });
    }));

  it('is refused for a player’s last city', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await expectRefused(abandon.abandonCity(g, p.id, p.cityId), msg('city.abandonKeepRegular'));
      expect((await getCity(g, p.cityId)).abandonAt).toBe(0);
    }));

  it('is refused for the last regular city, however many historic cities remain', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const other = await addCity(g, p);
      await saveCity(g, { ...(await getCity(g, other)), historicLevel: 12 });
      await expectRefused(abandon.abandonCity(g, p.id, p.cityId), msg('city.abandonKeepRegular'));
    }));

  it('lets a historic city go while a regular city remains', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const other = await addCity(g, p);
      await saveCity(g, { ...(await getCity(g, other)), historicLevel: 12 });
      await abandon.abandonCity(g, p.id, other);
      expect((await getCity(g, other)).abandonAt).toBeGreaterThan(0);
    }));

  it('is refused when the only other regular city is itself being abandoned, until that is called off', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const other = await addCity(g, p);
      await abandon.abandonCity(g, p.id, other);
      await expectRefused(abandon.abandonCity(g, p.id, p.cityId), msg('city.abandonKeepRegular'));
      await abandon.cancelAbandon(g, p.id, other);
      await abandon.abandonCity(g, p.id, p.cityId);
    }));

  it('is refused for a city already being abandoned, and for another player’s', () =>
    game(async (g) => {
      const { p } = await withSecondCity(g);
      const q = await createTestPlayer(g);
      await abandon.abandonCity(g, p.id, p.cityId);
      await expectRefused(abandon.abandonCity(g, p.id, p.cityId), msg('city.abandonAlready'));
      await expectRefused(abandon.abandonCity(g, q.id, p.cityId), msg('common.invalidCastle'));
    }));
});

describe(abandon.cancelAbandon.name, () => {
  it('keeps the city: its event goes and the hour no longer matters', () =>
    game(async (g) => {
      const { p } = await withSecondCity(g);
      await abandon.abandonCity(g, p.id, p.cityId);
      await abandon.cancelAbandon(g, p.id, p.cityId);
      expect((await getCity(g, p.cityId)).abandonAt).toBe(0);
      expect(g.events(TimedEventType.CITY_ABANDON)).toEqual([]);
      g.advance(BALANCE.abandon.delayMs);
      await completeAbandon(g, p.cityId);
      expect((await getCity(g, p.cityId)).id).toBe(p.cityId);
    }));

  it('is refused for a city not being abandoned, and for another player’s', () =>
    game(async (g) => {
      const { p } = await withSecondCity(g);
      const q = await createTestPlayer(g);
      await expectRefused(abandon.cancelAbandon(g, p.id, p.cityId), msg('city.abandonNotRunning'));
      await abandon.abandonCity(g, p.id, p.cityId);
      await expectRefused(abandon.cancelAbandon(g, q.id, p.cityId), msg('common.invalidCastle'));
    }));
});

describe(completeAbandon.name, () => {
  it('runs as a timed event once the hour is up', () =>
    game(async (g) => {
      const { p, other } = await withSecondCity(g);
      const { abandonAt } = await abandon.abandonCity(g, p.id, p.cityId);
      await g.runDue(abandonAt);
      expect((await citiesOf(g, p.id)).map((c) => c.id)).toEqual([other]);
    }));

  it('waits if called early, leaving the event for the hour’s end', () =>
    game(async (g) => {
      const { p } = await withSecondCity(g);
      const { abandonAt } = await abandon.abandonCity(g, p.id, p.cityId);
      g.advance(1000);
      await completeAbandon(g, p.cityId);
      expect((await getCity(g, p.cityId)).abandonAt).toBe(abandonAt);
      expect(g.events(TimedEventType.CITY_ABANDON)).toMatchObject([{ dueAt: abandonAt }]);
    }));

  it('leaves flat land of the level it had, reports it and tells the client', () =>
    game(async (g) => {
      const { p } = await withSecondCity(g);
      const tileId = await cityTile(g, p.cityId);
      const { level } = await getTile(g, tileId);
      await abandonNow(g, p);
      expect(await g.tx.select().from(cities).where(eq(cities.id, p.cityId))).toEqual([]);
      expect(await getTile(g, tileId)).toMatchObject({ type: TileType.FLAT, level, cityId: null, ownerPlayerId: null });
      expect((await reportsOf(g, p.id)).at(-1)).toMatchObject({ title: msg('report.title.cityAbandoned') });
      expect(lastPush(g, PushCmd.CASTLE_UPDATE, p.id)?.data).toEqual({ updateType: 1, castleBean: { id: p.cityId } });
    }));

  it('leaves a historic city standing whole, for the next to take', () =>
    game(async (g) => {
      const { p, other } = await withSecondCity(g);
      const seat = await makeSeat(g, p, { level: 14 });
      await abandonNow(g, p);
      expect(await getTile(g, seat.tileId)).toMatchObject({ type: TileType.HISTORIC, level: 14, cityId: null, ownerPlayerId: null, troops: null, state: null });
      expect((await citiesOf(g, p.id)).map((c) => c.id)).toEqual([other]);
    }));

  it('loses every hero there, the mayor and locked ones too, leaving the other city’s', () =>
    game(async (g) => {
      const { p, heroId, other } = await withSecondCity(g);
      const mayor = await addHero(g, p);
      await heroes.appointMayor(g, p.id, mayor);
      await heroes.setHeroLocked(g, p.id, heroId, true);
      const elsewhere = await addHero(g, p, 1, other);
      await heroes.appointMayor(g, p.id, elsewhere);
      await abandonNow(g, p);
      expect(
        await g.tx
          .select()
          .from(heroRows)
          .where(inArray(heroRows.id, [heroId, mayor])),
      ).toEqual([]);
      expect(await getHero(g, elsewhere)).toMatchObject({ cityId: other, status: HeroStatus.MAYOR });
    }));

  it('loses its armies in every state, with their heroes and events', () =>
    game(async (g) => {
      const { p, heroId } = await withSecondCity(g);
      const npc = await tileNear(g, p.cityId, TileType.NPC, { level: 1 });
      const leader = await addHero(g, p);
      const scout = { targetTileId: npc.id, mission: Mission.SCOUT, troops: { scouter: 1 } };
      const valley = await occupyValley(g, p, heroId);
      await send(g, p, { targetTileId: npc.id, mission: Mission.ATTACK, troops: { lightCavalry: 10 }, heroId: leader });
      await send(g, p, { ...scout, arriveAt: g.now + DAY / 2 });
      const stationed = await send(g, p, { targetTileId: valley.id, mission: Mission.REINFORCE, troops: { lightCavalry: 10 } });
      await arrive(g, stationed.armyId);
      const home = await send(g, p, scout);
      await arrive(g, home.armyId);
      const states = await g.tx.select().from(armyRows).where(eq(armyRows.cityId, p.cityId));
      expect(new Set(states.map((a) => a.direction))).toEqual(new Set([ArmyDirection.FORWARD, ArmyDirection.STAY, ArmyDirection.BACKWARD]));

      await abandonNow(g, p);

      expect(await g.tx.select().from(armyRows).where(eq(armyRows.playerId, p.id))).toEqual([]);
      expect(g.events(TimedEventType.ARMY).filter((e) => e.playerId === p.id)).toEqual([]);
      expect(g.events(TimedEventType.ARMY_DEPART).filter((e) => e.playerId === p.id)).toEqual([]);
      expect(await g.tx.select().from(heroRows).where(eq(heroRows.id, leader))).toEqual([]);
      await g.runDue(g.now + DAY);
    }));

  it('loses its orders, shipments and plan waves, cancels its research, and frees its valleys', () =>
    game(async (g) => {
      const { p, heroId, other } = await withSecondCity(g);
      const valley = await occupyValley(g, p, heroId);
      await withAcademy(g, p);
      await setBuildings(g, p, [[3, BuildingType.MARKETPLACE, 1]]);
      await setResources(g, p, PLENTY);
      const { level } = await research.startResearch(g, p.id, p.cityId, TechType.AGRICULTURE);
      await market.placeOrder(g, p.id, p.cityId, { resType: Res.STONE, side: MarketSide.BUY, amount: 10, price: 0.5 });
      await ship(g, { playerId: p.id, cityId: p.cityId, orderId: null, resType: Res.STONE, amount: 10, price: 1, ms: 60_000 });
      const plan = await plans.create(g, p.id, { name: 'Plan', targetTileId: valley.id, landAt: g.now + DAY, shared: false });
      await plans.addWave(g, p.id, plan.id, { cityId: p.cityId, mission: Mission.ATTACK, troops: { archer: 1 } });

      await abandonNow(g, p);

      expect(await market.myOrders(g, p.id)).toEqual([]);
      expect(await market.myShipments(g, p.id)).toEqual([]);
      expect(g.events(TimedEventType.SHIPMENT).filter((e) => e.playerId === p.id)).toEqual([]);
      expect(await g.tx.select().from(warPlanWaves).where(eq(warPlanWaves.playerId, p.id))).toEqual([]);
      expect((await getPlayer(g, p.id)).research[TechType.AGRICULTURE]).toEqual({ level });
      expect(g.events(TimedEventType.RESEARCH).filter((e) => e.playerId === p.id)).toEqual([]);
      expect(await getTile(g, valley.id)).toMatchObject({ ownerCityId: null, ownerPlayerId: null, troops: null, state: null });
      // it can start the research again elsewhere
      await withAcademy(g, p, other);
      await setResources(g, p, PLENTY, other);
      await research.startResearch(g, p.id, other, TechType.AGRICULTURE);
    }));

  it('leaves no timed event of the city’s behind, and none of another’s touched', () =>
    game(async (g) => {
      const { p, other } = await withSecondCity(g);
      const row = (cityId: number, refKey: string) => ({
        type: TimedEventType.BUILDING,
        dueAt: g.now + DAY,
        playerId: p.id,
        cityId,
        refKey,
        payload: { positionId: 0 },
        createdAt: g.now,
      });
      await g.tx.insert(timedEvents).values([row(p.cityId, 'gone-with-it'), row(other, 'still-there')]);
      await abandonNow(g, p);
      const left = await g.tx
        .select()
        .from(timedEvents)
        .where(inArray(timedEvents.refKey, ['gone-with-it', 'still-there']));
      expect(left.map((e) => e.refKey)).toEqual(['still-there']);
    }));

  it('takes back the prestige capturing it gave, within the window, and says so', () =>
    game(async (g) => {
      const { p } = await withSecondCity(g);
      const city = await getCity(g, p.cityId);
      await saveCity(g, { ...city, capturePrestige: 10_000, capturedAt: g.now });
      await savePlayer(g, { ...(await getPlayer(g, p.id)), prestige: 15_000 });
      await abandonNow(g, p);
      expect((await getPlayer(g, p.id)).prestige).toBe(5_000);
      expect((await reportsOf(g, p.id)).at(-1)?.body).toMatchObject({ text: msg('report.cityAbandonedPrestige', { name: city.name, prestige: 10_000 }) });
    }));

  it('never leaves prestige below 0', () =>
    game(async (g) => {
      const { p } = await withSecondCity(g);
      await saveCity(g, { ...(await getCity(g, p.cityId)), capturePrestige: 10_000, capturedAt: g.now });
      await savePlayer(g, { ...(await getPlayer(g, p.id)), prestige: 3_000 });
      await abandonNow(g, p);
      expect((await getPlayer(g, p.id)).prestige).toBe(0);
    }));

  it('takes nothing back once the window is over', () =>
    game(async (g) => {
      const { p } = await withSecondCity(g);
      await saveCity(g, { ...(await getCity(g, p.cityId)), capturePrestige: 10_000, capturedAt: g.now });
      await savePlayer(g, { ...(await getPlayer(g, p.id)), prestige: 3_000 });
      g.advance(BALANCE.abandon.prestigeBackMs);
      await abandonNow(g, p);
      expect((await getPlayer(g, p.id)).prestige).toBe(3_000);
    }));

  it('takes its targets off the player’s flows, which can be saved again', () =>
    game(async (g) => {
      const { p, other } = await withSecondCity(g);
      const preset = await armyPreset(g, p, 'Farm', { militia: 10 });
      const f = await newFlow(g, p, {
        name: 'Farm',
        actions: [{ type: FlowActionType.ATTACK_TARGETS, presetId: preset, targets: { [p.cityId]: [5], [other]: [6] } }],
      });
      await abandonNow(g, p);
      const saved = await flowOf(g, p, f.id);
      expect(saved.actions).toEqual([expect.objectContaining({ targets: { [other]: [6] } })]);
      expect(g.pushes(PushCmd.FLOW_UPDATE).at(-1)?.data).toMatchObject({ flowId: f.id });
      await flows.saveFlow(g, p.id, { id: f.id, name: 'Farm', actions: saved.actions });
    }));

  it('tells friends sent home, and stops showing attackers bound for its valleys as coming for the player', () =>
    game(async (g) => {
      const { p, heroId } = await withSecondCity(g);
      const valley = await occupyValley(g, p, heroId);

      const { p: friend, heroId: friendHero } = await warrior(g);
      await allies(g, p, friend);
      await interior.setCityFlags(g, p.id, p.cityId, { allowAlliance: true });
      const stationed = await send(g, friend, {
        targetTileId: await cityTile(g, p.cityId),
        mission: Mission.REINFORCE,
        troops: { lightCavalry: 100 },
        heroId: friendHero,
      });
      await arrive(g, stationed.armyId);
      const { p: rival, heroId: rivalHero } = await warrior(g);
      const attack = await send(g, rival, { targetTileId: valley.id, mission: Mission.ATTACK, troops: { lightCavalry: 100 }, heroId: rivalHero });
      expect((await armyRow(g, attack.armyId))?.targetPlayerId).toBe(p.id);
      const pushesToFriend = () => g.pushes(PushCmd.SELF_ARMIES_UPDATE).filter((x) => x.playerIds.includes(friend.id)).length;
      const before = pushesToFriend();

      await abandonNow(g, p);

      expect((await armyRow(g, attack.armyId))?.targetPlayerId).toBeNull();
      expect(pushesToFriend()).toBeGreaterThan(before);
    }));

  it('shows a new city’s owner an attacker still on its way to the tile', () =>
    game(async (g) => {
      const { p } = await withSecondCity(g);
      const tile = await cityTile(g, p.cityId);
      const { p: rival, heroId } = await warrior(g);
      const attack = await send(g, rival, { targetTileId: tile, mission: Mission.ATTACK, troops: { lightCavalry: 100 }, heroId });
      await abandonNow(g, p);
      const newcomer = await createTestPlayer(g);
      await armiesNowAimAtCity(g, tile, newcomer.id);
      expect((await armyRow(g, attack.armyId))?.targetPlayerId).toBe(newcomer.id);
      expect(lastPush(g, PushCmd.ENEMY_ARMIES_UPDATE, newcomer.id)?.data).toMatchObject({ armys: [expect.anything()] });
    }));

  it('leaves prestige (for a city never captured), honour and title as they were', () =>
    game(async (g) => {
      const { p } = await withSecondCity(g);
      const { prestige, honor, title, beginner } = await getPlayer(g, p.id);
      await abandonNow(g, p);
      expect(await getPlayer(g, p.id)).toMatchObject({ prestige, honor, title, beginner });
    }));

  it('sends home an army of the player’s other city on its way there, not lost', () =>
    game(async (g) => {
      const { p, other } = await withSecondCity(g);
      await warCity(g, p, { cityId: other, troops: { lightCavalry: 100, carriage: 10 } });
      const onTheWay = await armies.sendArmy(g, p.id, other, {
        targetTileId: await cityTile(g, p.cityId),
        mission: Mission.REINFORCE,
        troops: { lightCavalry: 10 },
      });
      await abandonNow(g, p);
      expect(await armyRow(g, onTheWay.armyId)).toMatchObject({ cityId: other, direction: ArmyDirection.BACKWARD });
    }));

  it('sends friends home, stationed or on their way, their troops and heroes safe', () =>
    game(async (g) => {
      const { p } = await withSecondCity(g);
      const { p: friend, heroId } = await warrior(g);
      await allies(g, p, friend);
      await interior.setCityFlags(g, p.id, p.cityId, { allowAlliance: true });
      const target = await cityTile(g, p.cityId);
      const stationed = await send(g, friend, { targetTileId: target, mission: Mission.REINFORCE, troops: { lightCavalry: 100 }, heroId });
      await arrive(g, stationed.armyId);
      expect((await armyRow(g, stationed.armyId))?.direction).toBe(ArmyDirection.STAY);
      const onTheWay = await send(g, friend, { targetTileId: target, mission: Mission.TRANSPORT, troops: { carriage: 1 }, resources: { gold: 1 } });

      await abandonNow(g, p);

      expect(await armyRow(g, stationed.armyId)).toMatchObject({ direction: ArmyDirection.BACKWARD });
      expect(await armyRow(g, onTheWay.armyId)).toMatchObject({ direction: ArmyDirection.BACKWARD });
      expect((await getHero(g, heroId)).status).toBe(HeroStatus.RETURN);
    }));

  it('lets attackers carry on: to nothing on flat land, and they turn back', () =>
    game(async (g) => {
      const { p } = await withSecondCity(g);
      const { p: rival, heroId } = await warrior(g);
      const attack = await send(g, rival, { targetTileId: await cityTile(g, p.cityId), mission: Mission.ATTACK, troops: { lightCavalry: 100 }, heroId });
      await abandonNow(g, p);
      expect(await armyRow(g, attack.armyId)).toMatchObject({ direction: ArmyDirection.FORWARD, targetPlayerId: null });
      await arrive(g, attack.armyId);
      expect(await armyRow(g, attack.armyId)).toMatchObject({ direction: ArmyDirection.BACKWARD });
      expect(lastPush(g, PushCmd.ENEMY_ARMIES_UPDATE, p.id)?.data).toEqual({ armys: [] });
    }));

  it('lets attackers carry on against a historic city, now nobody’s', () =>
    game(async (g) => {
      const { p } = await withSecondCity(g);
      await makeSeat(g, p);
      const { p: rival, heroId } = await warrior(g);
      const attack = await send(g, rival, { targetTileId: await cityTile(g, p.cityId), mission: Mission.ATTACK, troops: { lightCavalry: 100 }, heroId });
      await abandonNow(g, p);
      await arrive(g, attack.armyId);
      expect(battleOf((await reportsOf(g, rival.id)).at(-1)!, BattleTarget.NPC)).toBeTruthy();
    }));

  it('is called off and reported if no regular city would remain when the hour is up', () =>
    game(async (g) => {
      const { p, other } = await withSecondCity(g);
      const { abandonAt } = await abandon.abandonCity(g, p.id, p.cityId);
      // nothing in the game leaves it so: the check is the last guard of a player always keeping a city
      await saveCity(g, { ...(await getCity(g, other)), abandonAt });
      g.advance(BALANCE.abandon.delayMs);
      await completeAbandon(g, p.cityId);
      expect(await getCity(g, p.cityId)).toMatchObject({ abandonAt: 0 });
      expect(await reportTitles(g, p.id)).toContain('report.title.abandonCancelled');
    }));

  it('does nothing for a city already gone', () =>
    game(async (g) => {
      const { p } = await withSecondCity(g);
      await abandonNow(g, p);
      await completeAbandon(g, p.cityId);
      expect(
        await g.tx
          .select()
          .from(cities)
          .where(and(eq(cities.id, p.cityId))),
      ).toEqual([]);
    }));

  it('stops flows acting in a city being abandoned, saying why, and leaves its other cities running', () =>
    game(async (g) => {
      const { p, other } = await withSecondCity(g);
      await withHero(g, p, other);
      const f = await newFlow(g, p, { name: 'Mayors', actions: [mayor] });
      await abandon.abandonCity(g, p.id, p.cityId);
      await runFlowIn(g, p, f.id);
      const done = await flowOf(g, p, f.id);
      expect(done.lastRun?.cities.map((c) => c.cityId)).toEqual([other]);
      expect(done.lastRun?.skippedCities).toMatchObject([{ cityId: p.cityId, reason: msg('flow.skipAbandoning') }]);
    }));
});

/** A player with two more cities than their first, whose first is being abandoned with troops, injured troops and goods in it. */
async function movingOut(g: TestGame) {
  const { p, other, heroId } = await withSecondCity(g);
  const third = await addCity(g, p, 'Southmere');
  await setResources(g, p, { gold: 1001, food: 2001, wood: 3000, stone: 4000, iron: 5000 });
  for (const id of [other, third]) await setResources(g, p, { gold: 100, food: 100, wood: 100, stone: 100, iron: 100 }, id);
  await saveCity(g, { ...(await getCity(g, p.cityId)), troops: { archer: 5001, militia: 4 }, injuredTroops: { archer: 3 } });
  const { abandonAt } = await abandon.abandonCity(g, p.id, p.cityId);
  return { p, other, third, heroId, abandonAt };
}

describe(abandon.moveOutCity.name, () => {
  it('moves troops, injured troops and resources at once, shared evenly, the first chosen getting what is left over', () =>
    game(async (g) => {
      const { p, other, third } = await movingOut(g);
      await abandon.moveOutCity(g, p.id, p.cityId, [third, other]);
      expect(await getCity(g, third)).toMatchObject({
        troops: { archer: 2501, militia: 2 },
        injuredTroops: { archer: 2 },
        gold: 601,
        food: 1101,
        wood: 1600,
        stone: 2100,
        iron: 2600,
      });
      expect(await getCity(g, other)).toMatchObject({
        troops: { archer: 2500, militia: 2 },
        injuredTroops: { archer: 1 },
        gold: 600,
        food: 1100,
        wood: 1600,
        stone: 2100,
        iron: 2600,
      });
      expect(await getCity(g, p.cityId)).toMatchObject({ troops: {}, injuredTroops: {}, gold: 0, food: 0, wood: 0, stone: 0, iron: 0 });
    }));

  it('moves it all to one city, adding to what is there', () =>
    game(async (g) => {
      const { p, other } = await movingOut(g);
      await saveCity(g, { ...(await getCity(g, other)), troops: { archer: 10 } });
      await abandon.moveOutCity(g, p.id, p.cityId, [other]);
      expect(await getCity(g, other)).toMatchObject({ troops: { archer: 5011, militia: 4 }, injuredTroops: { archer: 3 }, gold: 1101 });
    }));

  it('leaves heroes, armies out and the hour as they were', () =>
    game(async (g) => {
      const { p, other, heroId, abandonAt } = await movingOut(g);
      await saveCity(g, { ...(await getCity(g, p.cityId)), troops: { archer: 100, lightCavalry: 100 } });
      const out = await send(g, p, { targetTileId: await cityTile(g, other), mission: Mission.REINFORCE, troops: { lightCavalry: 10 } });
      await abandon.moveOutCity(g, p.id, p.cityId, [other]);
      expect(await getHero(g, heroId)).toMatchObject({ cityId: p.cityId });
      expect(await armyRow(g, out.armyId)).toMatchObject({ cityId: p.cityId, direction: ArmyDirection.FORWARD, troops: { lightCavalry: 10 } });
      expect(await getCity(g, p.cityId)).toMatchObject({ abandonAt });
    }));

  it('tells the client about every city, and reports where it went', () =>
    game(async (g) => {
      const { p, other } = await movingOut(g);
      await abandon.moveOutCity(g, p.id, p.cityId, [other]);
      expect(lastPush(g, PushCmd.TROOP_UPDATE, p.id)?.data).toMatchObject({ castleId: other, troop: { archer: 5001 } });
      expect(lastPush(g, PushCmd.INJURED_TROOP_UPDATE, p.id)?.data).toMatchObject({ castleId: other, troop: { archer: 3 } });
      expect(
        g
          .pushes()
          .filter((m) => m.cmd === PushCmd.TROOP_UPDATE)
          .map((m) => (m.data as { castleId: number }).castleId),
      ).toContain(p.cityId);
      const report = await lastReport(g, p.id, 'report.title.cityMovedOut');
      expect(report.body).toMatchObject({ text: msg('report.cityMovedOut', { name: (await getCity(g, p.cityId)).name, cities: ['Eastwold'] }) });
    }));

  it('can go again during the hour, for what was produced meanwhile', () =>
    game(async (g) => {
      const { p, other } = await movingOut(g);
      await abandon.moveOutCity(g, p.id, p.cityId, [other]);
      await setResources(g, p, { gold: 50, food: 0, wood: 0, stone: 0, iron: 0 });
      await abandon.moveOutCity(g, p.id, p.cityId, [other]);
      expect((await getCity(g, other)).gold).toBe(1151);
    }));

  it('is refused for a city not being abandoned', () =>
    game(async (g) => {
      const { p, other } = await withSecondCity(g);
      await expectRefused(abandon.moveOutCity(g, p.id, p.cityId, [other]), msg('city.moveOutNotAbandoning'));
    }));

  it('is refused for another player’s city, and to another player’s', () =>
    game(async (g) => {
      const { p, other } = await movingOut(g);
      const { p: rival } = await warrior(g);
      await expectRefused(abandon.moveOutCity(g, rival.id, p.cityId, [rival.cityId]), msg('common.invalidCastle'));
      await expectRefused(abandon.moveOutCity(g, p.id, p.cityId, [other, rival.cityId]), msg('common.invalidCastle'));
    }));

  it('is refused to itself, to a city twice and to a city being abandoned, nothing having moved', () =>
    game(async (g) => {
      const { p, other, third } = await movingOut(g);
      await expectRefused(abandon.moveOutCity(g, p.id, p.cityId, [other, p.cityId]), msg('city.moveOutTarget'));
      await expectRefused(abandon.moveOutCity(g, p.id, p.cityId, [other, other]), msg('city.moveOutTarget'));
      await abandon.abandonCity(g, p.id, third);
      await expectRefused(abandon.moveOutCity(g, p.id, p.cityId, [other, third]), msg('city.moveOutTarget'));
      expect((await getCity(g, p.cityId)).troops).toMatchObject({ archer: 5001 });
    }));

  it('is refused with nothing to move, a fraction of a resource not counting', () =>
    game(async (g) => {
      const { p, other } = await movingOut(g);
      await saveCity(g, { ...(await getCity(g, p.cityId)), troops: {}, injuredTroops: {}, gold: 0.5, food: 0.5, wood: 0, stone: 0, iron: 0 });
      await expectRefused(abandon.moveOutCity(g, p.id, p.cityId, [other]), msg('city.moveOutNothing'));
    }));

  it('moves a city with only injured troops left in it', () =>
    game(async (g) => {
      const { p, other } = await movingOut(g);
      await saveCity(g, { ...(await getCity(g, p.cityId)), troops: {}, gold: 0, food: 0, wood: 0, stone: 0, iron: 0 });
      await abandon.moveOutCity(g, p.id, p.cityId, [other]);
      expect((await getCity(g, other)).injuredTroops).toMatchObject({ archer: 3 });
    }));

  describe('heroes', () => {
    /** The first city being abandoned with its heroes, its second city's Feasting Hall having this many slots and no hero. */
    async function withHeroes(g: TestGame, slots = 5) {
      const made = await movingOut(g);
      await warCity(g, made.p, { cityId: made.other, feastingHall: slots, troops: {} });
      const second = await addHero(g, made.p);
      return { ...made, second };
    }

    it('moves a chosen hero at once, alone if no city is chosen for the rest, as they were', () =>
      game(async (g) => {
        const { p, other, heroId } = await withHeroes(g);
        const { level } = await getHero(g, heroId);
        await abandon.moveOutCity(g, p.id, p.cityId, [], [{ heroId, cityId: other }]);
        expect(await getHero(g, heroId)).toMatchObject({ cityId: other, status: HeroStatus.IDLE, level });
        expect((await getCity(g, p.cityId)).troops).toMatchObject({ archer: 5001 });
      }));

    it('leaves the heroes not chosen', () =>
      game(async (g) => {
        const { p, other, heroId, second } = await withHeroes(g);
        await abandon.moveOutCity(g, p.id, p.cityId, [other]);
        expect(await getHero(g, heroId)).toMatchObject({ cityId: p.cityId });
        expect(await getHero(g, second)).toMatchObject({ cityId: p.cityId });
      }));

    it('moves heroes along with the troops and resources, each to its own city', () =>
      game(async (g) => {
        const { p, other, third, heroId, second } = await withHeroes(g);
        await warCity(g, p, { cityId: third, feastingHall: 1, troops: {} });
        await abandon.moveOutCity(
          g,
          p.id,
          p.cityId,
          [other],
          [
            { heroId, cityId: other },
            { heroId: second, cityId: third },
          ],
        );
        expect(await getHero(g, heroId)).toMatchObject({ cityId: other });
        expect(await getHero(g, second)).toMatchObject({ cityId: third });
        expect((await getCity(g, other)).troops).toMatchObject({ archer: 5001 });
      }));

    it('moves the mayor, the hero no longer being one and the city left with none', () =>
      game(async (g) => {
        const { p, other, heroId } = await withHeroes(g);
        await heroes.appointMayor(g, p.id, heroId);
        expect(await getHero(g, heroId)).toMatchObject({ status: HeroStatus.MAYOR });
        await abandon.moveOutCity(g, p.id, p.cityId, [], [{ heroId, cityId: other }]);
        expect(await getHero(g, heroId)).toMatchObject({ cityId: other, status: HeroStatus.IDLE });
      }));

    it('is refused for a hero out with an army, nothing having moved', () =>
      game(async (g) => {
        const { p, other, heroId } = await withHeroes(g);
        await saveCity(g, { ...(await getCity(g, p.cityId)), troops: { lightCavalry: 100, archer: 5 } });
        await send(g, p, { targetTileId: await cityTile(g, other), mission: Mission.REINFORCE, troops: { lightCavalry: 10 }, heroId });
        await expectRefused(abandon.moveOutCity(g, p.id, p.cityId, [other], [{ heroId, cityId: other }]), msg('hero.notIdle'));
        expect((await getCity(g, p.cityId)).troops).toMatchObject({ archer: 5 });
      }));

    it('is refused with no free Feasting Hall slot, nothing having moved', () =>
      game(async (g) => {
        const { p, other, heroId } = await withHeroes(g, 1);
        await addHero(g, p, 1, other);
        const noSlot = msg('hero.noVacancy', { building: ref.building(BuildingType.FEASTING_HALL) });
        await expectRefused(abandon.moveOutCity(g, p.id, p.cityId, [other], [{ heroId, cityId: other }]), noSlot);
        expect((await getCity(g, p.cityId)).troops).toMatchObject({ archer: 5001 });
        expect(await getHero(g, heroId)).toMatchObject({ cityId: p.cityId });
      }));

    it('counts the heroes chosen against the slots left', () =>
      game(async (g) => {
        const { p, other, heroId, second } = await withHeroes(g, 1);
        const moves = [
          { heroId, cityId: other },
          { heroId: second, cityId: other },
        ];
        await expectRefused(abandon.moveOutCity(g, p.id, p.cityId, [], moves), msg('hero.noVacancy', { building: ref.building(BuildingType.FEASTING_HALL) }));
      }));

    it('is refused for a hero of another city, for a hero twice, and to the city itself or one being abandoned', () =>
      game(async (g) => {
        const { p, other, third, heroId } = await withHeroes(g);
        const elsewhere = await addHero(g, p, 1, third);
        const twice = [
          { heroId, cityId: other },
          { heroId, cityId: other },
        ];
        await expectRefused(abandon.moveOutCity(g, p.id, p.cityId, [], [{ heroId: elsewhere, cityId: other }]), msg('common.heroNotFound'));
        await expectRefused(abandon.moveOutCity(g, p.id, p.cityId, [], twice), msg('common.heroNotFound'));
        await expectRefused(abandon.moveOutCity(g, p.id, p.cityId, [], [{ heroId, cityId: p.cityId }]), msg('city.moveOutTarget'));
        await abandon.abandonCity(g, p.id, third);
        await expectRefused(abandon.moveOutCity(g, p.id, p.cityId, [], [{ heroId, cityId: third }]), msg('city.moveOutTarget'));
      }));

    it('is refused under attack and during the wait, like the rest', () =>
      game(async (g) => {
        const { p, other, heroId } = await withHeroes(g);
        const { p: rival, heroId: rivalHero } = await warrior(g);
        const attack = await send(g, rival, {
          targetTileId: await cityTile(g, p.cityId),
          mission: Mission.ATTACK,
          troops: { lightCavalry: 100 },
          heroId: rivalHero,
        });
        await expectRefused(abandon.moveOutCity(g, p.id, p.cityId, [], [{ heroId, cityId: other }]), msg('city.moveOutUnderAttack'));
        await armies.recallArmy(g, rival.id, attack.armyId);
        await abandon.moveOutCity(g, p.id, p.cityId, [], [{ heroId, cityId: other }]);
        await abandon.cancelAbandon(g, p.id, p.cityId);
        expect((await getPlayer(g, p.id)).misc.moveOutBlockedUntil).toBe(g.now + BALANCE.abandon.moveOutCooldownMs);
      }));

    it('is safe when the hour ends, and reports where each went', () =>
      game(async (g) => {
        const { p, other, heroId, second } = await withHeroes(g);
        await abandon.moveOutCity(g, p.id, p.cityId, [], [{ heroId, cityId: other }]);
        const hero = await getHero(g, heroId);
        const report = await lastReport(g, p.id, 'report.title.cityMovedOut');
        const name = (await getCity(g, p.cityId)).name;
        expect(report.body).toMatchObject({
          text: msg('report.heroesMovedOut', { name, heroes: [msg('report.heroMovedTo', { hero: hero.name, city: 'Eastwold' })] }),
        });
        g.advance(BALANCE.abandon.delayMs);
        await completeAbandon(g, p.cityId);
        expect(await getHero(g, heroId)).toMatchObject({ cityId: other });
        await expect(getHero(g, second)).rejects.toThrow();
      }));

    it('is refused with neither a city nor a hero', () =>
      game(async (g) => {
        const { p } = await movingOut(g);
        await expectRefused(abandon.moveOutCity(g, p.id, p.cityId, []), msg('city.moveOutTarget'));
      }));
  });

  describe('a city’s own army coming home during the hour', () => {
    /** The first city being abandoned, its hour put off so that a march can end within it, and its own army home again. */
    async function cameHome(g: TestGame) {
      const { p, other, third } = await movingOut(g);
      await saveCity(g, { ...(await getCity(g, p.cityId)), troops: { lightCavalry: 100 }, abandonAt: g.now + 30 * DAY });
      const army = await send(g, p, { targetTileId: await cityTile(g, other), mission: Mission.REINFORCE, troops: { lightCavalry: 10 } });
      await armies.recallArmy(g, p.id, army.armyId);
      await arrive(g, army.armyId);
      expect((await getCity(g, p.cityId)).troops).toMatchObject({ lightCavalry: 100 });
      return { p, third };
    }

    it('is lost with the city', () =>
      game(async (g) => {
        const { p, third } = await cameHome(g);
        await saveCity(g, { ...(await getCity(g, p.cityId)), abandonAt: g.now });
        await completeAbandon(g, p.cityId);
        expect((await getCity(g, third)).troops).toEqual({});
      }));

    it('is safe if moved out again', () =>
      game(async (g) => {
        const { p, third } = await cameHome(g);
        await abandon.moveOutCity(g, p.id, p.cityId, [third]);
        expect((await getCity(g, third)).troops).toMatchObject({ lightCavalry: 100 });
      }));
  });

  describe('with an army on its way', () => {
    it('is refused for an enemy attack on its way, nothing having moved', () =>
      game(async (g) => {
        const { p, other } = await movingOut(g);
        const { p: rival, heroId } = await warrior(g);
        await send(g, rival, { targetTileId: await cityTile(g, p.cityId), mission: Mission.ATTACK, troops: { lightCavalry: 100 }, heroId });
        await expectRefused(abandon.moveOutCity(g, p.id, p.cityId, [other]), msg('city.moveOutUnderAttack'));
        expect((await getCity(g, p.cityId)).troops).toMatchObject({ archer: 5001 });
      }));

    it('goes ahead once that attack has turned back', () =>
      game(async (g) => {
        const { p, other } = await movingOut(g);
        const { p: rival, heroId } = await warrior(g);
        const attack = await send(g, rival, { targetTileId: await cityTile(g, p.cityId), mission: Mission.ATTACK, troops: { lightCavalry: 1 }, heroId });
        await armies.recallArmy(g, rival.id, attack.armyId);
        await abandon.moveOutCity(g, p.id, p.cityId, [other]);
        expect((await getCity(g, other)).gold).toBeGreaterThan(100);
      }));

    it('goes ahead for an attack still waiting to leave at a landing time, as the player can’t see it and a refusal would give it away', () =>
      game(async (g) => {
        const { p, other } = await movingOut(g);
        const { p: rival, heroId } = await warrior(g);
        await send(g, rival, {
          targetTileId: await cityTile(g, p.cityId),
          mission: Mission.ATTACK,
          troops: { lightCavalry: 100 },
          heroId,
          arriveAt: g.now + DAY / 2,
        });
        await abandon.moveOutCity(g, p.id, p.cityId, [other]);
        expect((await getCity(g, other)).troops).toMatchObject({ archer: 5001 });
      }));

    it('goes ahead for scouts', () =>
      game(async (g) => {
        const { p, other } = await movingOut(g);
        const { p: rival } = await warrior(g);
        await send(g, rival, { targetTileId: await cityTile(g, p.cityId), mission: Mission.SCOUT, troops: { scouter: 10 } });
        await abandon.moveOutCity(g, p.id, p.cityId, [other]);
        expect((await getCity(g, p.cityId)).troops).toEqual({});
      }));
  });

  describe('keeping the city afterwards', () => {
    it('brings nothing back, and stops every city moving out until the time is up', () =>
      game(async (g) => {
        const { p, other, third } = await movingOut(g);
        await abandon.moveOutCity(g, p.id, p.cityId, [other]);
        await abandon.cancelAbandon(g, p.id, p.cityId);
        expect((await getCity(g, p.cityId)).troops).toEqual({});
        expect((await getCity(g, other)).troops).toMatchObject({ archer: 5001 });
        const wait = BALANCE.abandon.moveOutCooldownMs;
        expect((await getPlayer(g, p.id)).misc.moveOutBlockedUntil).toBe(g.now + wait);

        await abandon.abandonCity(g, p.id, third);
        await expectRefused(abandon.moveOutCity(g, p.id, third, [other]), msg('city.moveOutCooldown', { time: dur(wait) }));
        g.advance(wait - 1000);
        await expectRefused(abandon.moveOutCity(g, p.id, third, [other]), msg('city.moveOutCooldown', { time: dur(1000) }));
        g.advance(1000);
        await abandon.cancelAbandon(g, p.id, third);
        await abandon.abandonCity(g, p.id, third);
        await abandon.moveOutCity(g, p.id, third, [other]);
      }));

    it('costs nothing if nothing was moved', () =>
      game(async (g) => {
        const { p, other } = await movingOut(g);
        await abandon.cancelAbandon(g, p.id, p.cityId);
        expect((await getPlayer(g, p.id)).misc.moveOutBlockedUntil).toBeUndefined();
        await abandon.abandonCity(g, p.id, p.cityId);
        await abandon.moveOutCity(g, p.id, p.cityId, [other]);
      }));

    it('counts only the hour moved in: starting again and keeping it adds no more time', () =>
      game(async (g) => {
        const { p, other } = await movingOut(g);
        await abandon.moveOutCity(g, p.id, p.cityId, [other]);
        await abandon.cancelAbandon(g, p.id, p.cityId);
        const { moveOutBlockedUntil } = (await getPlayer(g, p.id)).misc;
        g.advance(HOUR);
        await abandon.abandonCity(g, p.id, p.cityId);
        await abandon.cancelAbandon(g, p.id, p.cityId);
        expect((await getPlayer(g, p.id)).misc.moveOutBlockedUntil).toBe(moveOutBlockedUntil);
      }));
  });

  describe('when the hour ends', () => {
    it('leaves what moved out safe, at no cost, the city gone', () =>
      game(async (g) => {
        const { p, other } = await movingOut(g);
        await abandon.moveOutCity(g, p.id, p.cityId, [other]);
        g.advance(BALANCE.abandon.delayMs);
        await completeAbandon(g, p.cityId);
        expect((await citiesOf(g, p.id)).map((c) => c.id)).not.toContain(p.cityId);
        expect((await getCity(g, other)).troops).toMatchObject({ archer: 5001 });
        expect((await getPlayer(g, p.id)).misc.moveOutBlockedUntil).toBeUndefined();
      }));

    it('costs nothing if it’s the game that calls it off, no regular city remaining', () =>
      game(async (g) => {
        const { p, other, third, abandonAt } = await movingOut(g);
        await abandon.moveOutCity(g, p.id, p.cityId, [other]);
        // nothing in the game leaves it so: as in the test of that guard above
        for (const id of [other, third]) await saveCity(g, { ...(await getCity(g, id)), abandonAt });
        g.advance(BALANCE.abandon.delayMs);
        await completeAbandon(g, p.cityId);
        expect(await getCity(g, p.cityId)).toMatchObject({ abandonAt: 0 });
        expect((await getPlayer(g, p.id)).misc.moveOutBlockedUntil).toBeUndefined();
      }));
  });
});

describe('armies and a city being abandoned', () => {
  const GOLD = { gold: 1000, food: 0, wood: 0, stone: 0, iron: 0 };

  it('refuses a Reinforce and a Transport from the player’s other city, nothing leaving', () =>
    game(async (g) => {
      const { p, other } = await withSecondCity(g);
      await warCity(g, p, { cityId: other, troops: { lightCavalry: 100, carriage: 10 } });
      await abandon.abandonCity(g, p.id, p.cityId);
      const targetTileId = await cityTile(g, p.cityId);
      const refused = msg('army.destinationAbandoning');
      await expectRefused(armies.sendArmy(g, p.id, other, { targetTileId, mission: Mission.REINFORCE, troops: { lightCavalry: 10 } }), refused);
      await expectRefused(armies.sendArmy(g, p.id, other, { targetTileId, mission: Mission.TRANSPORT, troops: { carriage: 10 }, resources: GOLD }), refused);
      expect((await getCity(g, other)).troops).toMatchObject({ lightCavalry: 100, carriage: 10 });
    }));

  it('refuses a friend’s Reinforce and Transport too', () =>
    game(async (g) => {
      const { p } = await withSecondCity(g);
      const { p: friend } = await warrior(g);
      await allies(g, p, friend);
      await saveCity(g, { ...(await getCity(g, p.cityId)), allowAlliance: true });
      await abandon.abandonCity(g, p.id, p.cityId);
      const targetTileId = await cityTile(g, p.cityId);
      const refused = msg('army.destinationAbandoning');
      await expectRefused(send(g, friend, { targetTileId, mission: Mission.REINFORCE, troops: { lightCavalry: 10 } }), refused);
      await expectRefused(send(g, friend, { targetTileId, mission: Mission.TRANSPORT, troops: { carriage: 10 }, resources: GOLD }), refused);
    }));

  it('tells an enemy nothing: an attack and a scout may still set off', () =>
    game(async (g) => {
      const { p } = await withSecondCity(g);
      const { p: rival, heroId } = await warrior(g);
      await abandon.abandonCity(g, p.id, p.cityId);
      const targetTileId = await cityTile(g, p.cityId);
      await send(g, rival, { targetTileId, mission: Mission.ATTACK, troops: { lightCavalry: 10 }, heroId });
      await send(g, rival, { targetTileId, mission: Mission.SCOUT, troops: { scouter: 10 } });
    }));

  it('lets the leaving city’s own armies go elsewhere', () =>
    game(async (g) => {
      const { p, other } = await withSecondCity(g);
      await abandon.abandonCity(g, p.id, p.cityId);
      await send(g, p, { targetTileId: await cityTile(g, other), mission: Mission.REINFORCE, troops: { lightCavalry: 10 } });
    }));

  it('goes back to normal once the city is kept', () =>
    game(async (g) => {
      const { p, other } = await withSecondCity(g);
      await warCity(g, p, { cityId: other, troops: { lightCavalry: 100 } });
      await abandon.abandonCity(g, p.id, p.cityId);
      await abandon.cancelAbandon(g, p.id, p.cityId);
      await armies.sendArmy(g, p.id, other, { targetTileId: await cityTile(g, p.cityId), mission: Mission.REINFORCE, troops: { lightCavalry: 10 } });
    }));

  describe('already on the way when the hour starts', () => {
    /** Send this from the other city, then start the hour (put off, so that the march ends within it) and land the army. */
    async function landsDuring(g: TestGame, troops: Record<string, number>, mission: Mission, resources?: typeof GOLD) {
      const { p, other } = await withSecondCity(g);
      await warCity(g, p, { cityId: other, troops: { lightCavalry: 100, carriage: 10 } });
      const army = await armies.sendArmy(g, p.id, other, { targetTileId: await cityTile(g, p.cityId), mission, troops, resources });
      await abandon.abandonCity(g, p.id, p.cityId);
      await saveCity(g, { ...(await getCity(g, p.cityId)), abandonAt: g.now + 30 * DAY });
      const before = await getCity(g, p.cityId);
      await arrive(g, army.armyId);
      return { p, other, army, before };
    }

    it('turns a Reinforce back on arrival, telling the player, its troops safe', () =>
      game(async (g) => {
        const { p, army, before } = await landsDuring(g, { lightCavalry: 10 }, Mission.REINFORCE);
        expect(await armyRow(g, army.armyId)).toMatchObject({ direction: ArmyDirection.BACKWARD, troops: { lightCavalry: 10 } });
        expect((await getCity(g, p.cityId)).troops).toEqual(before.troops);
        expect((await lastReport(g, p.id, 'report.title.missionAborted')).body).toMatchObject({ text: msg('army.destinationAbandoning') });
      }));

    it('turns a Transport back on arrival, its goods safe', () =>
      game(async (g) => {
        const { p, army, before } = await landsDuring(g, { carriage: 10 }, Mission.TRANSPORT, GOLD);
        expect(await armyRow(g, army.armyId)).toMatchObject({ direction: ArmyDirection.BACKWARD, resources: GOLD });
        expect((await getCity(g, p.cityId)).gold).toBe(before.gold);
      }));

    it('gets the army home with everything it left with', () =>
      game(async (g) => {
        const { other, army } = await landsDuring(g, { lightCavalry: 10 }, Mission.REINFORCE);
        await arrive(g, army.armyId);
        expect((await getCity(g, other)).troops).toMatchObject({ lightCavalry: 100 });
      }));
  });
});
