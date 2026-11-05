// Abandoning a city (docs/features/abandoning-a-city.md): the hour's notice, what stops it, and what goes when it's up.

import { and, eq, inArray } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { PushCmd } from '@marchlands/contracts';
import { ArmyDirection, BALANCE, BuildingType, DAY, HeroStatus, MarketSide, Mission, msg, TechType, TileType } from '@marchlands/core';
import { armies as armyRows, cities, heroes as heroRows, timedEvents, warPlanWaves } from '@marchlands/db';

import { completeAbandon } from '#/engine/abandon.ts';
import { armiesNowAimAtCity } from '#/engine/armies.ts';
import { ship } from '#/engine/market.ts';
import { abandon, armies, flows, heroes, interior, market, plans, research } from '#/index.ts';
import { citiesOf, getCity, getHero, getPlayer, getTile, saveCity, savePlayer } from '#/repo.ts';
import { allies, arrive, battleOf, cityTile, lastPush, occupyValley, reportsOf, reportTitles, send, tileNear, warCity, warrior } from '#test/support/armies.ts';
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
      expect(g.events('city.abandon')).toMatchObject([{ dueAt: at, playerId: p.id, cityId: p.cityId, refKey: `abandon:${p.cityId}` }]);
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
      expect(g.events('city.abandon')).toEqual([]);
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
      expect(g.events('city.abandon')).toMatchObject([{ dueAt: abandonAt }]);
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
      expect(g.events('army').filter((e) => e.playerId === p.id)).toEqual([]);
      expect(g.events('army.depart').filter((e) => e.playerId === p.id)).toEqual([]);
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
      expect(g.events('shipment').filter((e) => e.playerId === p.id)).toEqual([]);
      expect(await g.tx.select().from(warPlanWaves).where(eq(warPlanWaves.playerId, p.id))).toEqual([]);
      expect((await getPlayer(g, p.id)).research[TechType.AGRICULTURE]).toEqual({ level });
      expect(g.events('research').filter((e) => e.playerId === p.id)).toEqual([]);
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
        type: 'building',
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
      const f = await newFlow(g, p, { name: 'Farm', actions: [{ type: 'attackTargets', presetId: preset, targets: { [p.cityId]: [5], [other]: [6] } }] });
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
      expect(battleOf((await reportsOf(g, rival.id)).at(-1)!, 'npc')).toBeTruthy();
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
