import { afterEach, describe, expect, it } from 'vitest';
import { BALANCE, BuffId, BuildingType, ItemId, msg, PlayerStatus, setGameSpeed, type BuffId as BuffIdType } from '@marchlands/core';
import { PushCmd } from '@marchlands/contracts';
import { buildings, dispatchEvent, shop, type EventRow, player as players } from '#/index.ts';
import { getPlayer, savePlayer } from '#/repo.ts';
import { setBuff } from '#/helpers.ts';
import { cityBundle, createTestPlayer, giveItems, reloadCity, reloadPlayer, setBuildings, setResources, type TestPlayer } from '#test/support/factories.ts';
import { game, type TestGame } from '#test/support/game.ts';

const HOUR = 3_600_000;

afterEach(() => setGameSpeed(1));

const expiry = (p: TestPlayer, buffId: string): EventRow => ({ id: 0, type: 'buff.expire', dueAt: 0, playerId: p.id, cityId: null, payload: { buffId } });

/** Give the player a buff ending at `endTime` (as an item would), dropping what that queued. */
async function withBuff(g: TestGame, p: TestPlayer, id: BuffIdType, endTime: number) {
  const row = await getPlayer(g, p.id);
  setBuff(g, row, id, msg('buff.buildingQueue'), endTime);
  await savePlayer(g, row);
  g._pushes.length = 0;
}

/** Overwrite a stored buff's end time (as a later item use extending it would). */
async function moveBuff(g: TestGame, p: TestPlayer, id: BuffIdType, endTime: number) {
  const row = await getPlayer(g, p.id);
  row.buffs = row.buffs.map((b) => (b.id === id ? { ...b, endTime } : b));
  await savePlayer(g, row);
}

describe(`${dispatchEvent.name}: buff.expire`, () => {
  it('removes a buff that is due, cancels its event and tells the player', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withBuff(g, p, BuffId.ATTACK, g.now + HOUR);
      g.advance(HOUR);
      await dispatchEvent(g, expiry(p, BuffId.ATTACK));

      expect((await reloadPlayer(g, p)).buffs).toEqual([]);
      expect(g.events('buff.expire')).toEqual([]);
      expect(g._unscheduled).toContain(`buff:${p.id}:${BuffId.ATTACK}`);
      expect(g.pushes(PushCmd.PLAYER_BUFF_UPDATE)).toEqual([
        {
          playerIds: [p.id],
          cmd: PushCmd.PLAYER_BUFF_UPDATE,
          data: { buffBean: { typeId: BuffId.ATTACK, desc: msg('buff.buildingQueue'), endTime: g.now }, updateType: 1 },
        },
      ]);
      expect(g.pushes(PushCmd.PLAYER_INFO_UPDATE)).toMatchObject([{ playerIds: [p.id], data: { playerInfo: { id: p.id } } }]);
    }));

  it('runs when the buff falls due (runDue), leaving other buffs alone', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withBuff(g, p, BuffId.ATTACK, g.now + HOUR);
      await withBuff(g, p, BuffId.DEFENSE, g.now + 2 * HOUR);
      await g.runDue(g.now + HOUR);
      expect((await reloadPlayer(g, p)).buffs.map((b) => b.id)).toEqual([BuffId.DEFENSE]);
      expect(g.events('buff.expire')).toMatchObject([{ refKey: `buff:${p.id}:${BuffId.DEFENSE}` }]);
    }));

  it('a buff that now ends later (extended since) is scheduled again for its new end', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withBuff(g, p, BuffId.ATTACK, g.now + HOUR);
      await moveBuff(g, p, BuffId.ATTACK, g.now + 3 * HOUR);
      g.advance(HOUR);
      await dispatchEvent(g, expiry(p, BuffId.ATTACK));

      expect((await reloadPlayer(g, p)).buffs).toMatchObject([{ id: BuffId.ATTACK, endTime: g.now + 2 * HOUR }]);
      expect(g.events('buff.expire')).toEqual([
        { type: 'buff.expire', dueAt: g.now + 2 * HOUR, playerId: p.id, refKey: `buff:${p.id}:${BuffId.ATTACK}`, payload: { buffId: BuffId.ATTACK } },
      ]);
      expect(g.pushes()).toEqual([]);
    }));

  it('does nothing when the player has no such buff (already removed)', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      g._pushes.length = 0;
      await dispatchEvent(g, expiry(p, BuffId.ATTACK));
      expect(g.pushes()).toEqual([]);
      expect(g.events()).toEqual([]);
    }));

  it('a truce ends in its cooldown (real time, whatever the game speed), and the player is no longer at truce', () =>
    game(async (g) => {
      setGameSpeed(4);
      const p = await createTestPlayer(g);
      await giveItems(g, p, { [ItemId.TRUCE_AGREEMENT]: 1 });
      await players.startTruce(g, p.id, ItemId.TRUCE_AGREEMENT, p.cityId);
      expect((await reloadPlayer(g, p)).status).toBe(PlayerStatus.TRUCE);
      const end = (await reloadPlayer(g, p)).buffs[0].endTime;

      await g.runDue(end);
      const row = await reloadPlayer(g, p);
      expect(row.status).toBe(PlayerStatus.NORMAL);
      const cooldown = { id: BuffId.TRUCE_COOLDOWN, desc: msg('buff.truceCooldown'), endTime: end + BALANCE.truceCooldownMs };
      expect(row.buffs).toEqual([cooldown]);
      expect(g.events('buff.expire')).toMatchObject([{ dueAt: cooldown.endTime, payload: { buffId: BuffId.TRUCE_COOLDOWN } }]);
      expect(g.pushes(PushCmd.PLAYER_INFO_UPDATE).at(-1)).toMatchObject({ data: { playerInfo: { status: PlayerStatus.NORMAL } } });

      await g.runDue(cooldown.endTime); // the cooldown expires in turn, with no new cooldown
      expect((await reloadPlayer(g, p)).buffs).toEqual([]);
      expect(g.events()).toEqual([]);
    }));

  it('a truce ending keeps a status other than truce', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withBuff(g, p, BuffId.TRUCE, g.now + HOUR);
      const row = await getPlayer(g, p.id);
      row.status = PlayerStatus.HOLIDAY;
      await savePlayer(g, row);
      await g.runDue(g.now + HOUR);
      expect(await reloadPlayer(g, p)).toMatchObject({ status: PlayerStatus.HOLIDAY, buffs: [{ id: BuffId.TRUCE_COOLDOWN }] });
    }));

  it('holiday mode ends with its buff', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await players.startFurlough(g, p.id, 1, p.cityId);
      expect((await reloadPlayer(g, p)).status).toBe(PlayerStatus.HOLIDAY);
      await g.runDue(g.now + 24 * HOUR);
      expect(await reloadPlayer(g, p)).toMatchObject({ status: PlayerStatus.NORMAL, buffs: [] });
    }));

  it('another buff ending leaves the status alone', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await players.startFurlough(g, p.id, 1, p.cityId);
      await withBuff(g, p, BuffId.ATTACK, g.now + HOUR);
      await g.runDue(g.now + HOUR);
      expect((await reloadPlayer(g, p)).status).toBe(PlayerStatus.HOLIDAY);
    }));

  it('a production boost ending first banks what the cities made at the boosted rate', () =>
    game(async (g) => {
      // two equal players with farms; only `boosted` uses Plowshares
      const make = async () => {
        const p = await createTestPlayer(g);
        await setBuildings(g, p, [[1000, BuildingType.FARM, 5]]);
        await setResources(g, p, { food: 0 });
        return p;
      };
      const boosted = await make();
      const plain = await make();
      await giveItems(g, boosted, { [ItemId.PLOWSHARES]: 1 });
      await shop.useItem(g, boosted.id, ItemId.PLOWSHARES, null);
      const end = (await reloadPlayer(g, boosted)).buffs[0].endTime;

      await g.runDue(end);
      expect((await reloadCity(g, boosted.cityId)).resourcesAt).toBe(end);
      // both settled to now: without banking first, the boosted city would have made only what the plain one did
      const food = async (p: TestPlayer) => (await cityBundle(g, p)).city.food;
      expect(await food(boosted)).toBeGreaterThan(await food(plain));
    }));

  it('a buff that does not change production leaves the cities unsettled', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const at = (await reloadCity(g, p.cityId)).resourcesAt;
      await withBuff(g, p, BuffId.ATTACK, g.now + HOUR);
      await g.runDue(g.now + HOUR);
      expect((await reloadCity(g, p.cityId)).resourcesAt).toBe(at);
    }));
});

describe(`${dispatchEvent.name}: work in progress`, () => {
  it('completes a construction from its stored event', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const bean = await buildings.construct(g, p.id, p.cityId, BuildingType.COTTAGE, 0);
      const [ev] = g.events('building');
      g._events.clear();
      g.advance(bean.endTime - g.now);
      await dispatchEvent(g, { id: 1, type: ev.type, dueAt: ev.dueAt, playerId: ev.playerId ?? null, cityId: ev.cityId ?? null, payload: ev.payload ?? {} });
      expect((await reloadCity(g, p.cityId)).buildings).toContainEqual(expect.objectContaining({ positionId: 0, typeId: BuildingType.COTTAGE, level: 1 }));
    }));

  it('a stale event does nothing (the work was already completed)', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await buildings.construct(g, p.id, p.cityId, BuildingType.COTTAGE, 0);
      const [ev] = g.events('building');
      await g.runDue(ev.dueAt);
      const before = (await reloadCity(g, p.cityId)).buildings;
      g._pushes.length = 0;
      await dispatchEvent(g, { id: 1, type: 'building', dueAt: ev.dueAt, playerId: p.id, cityId: p.cityId, payload: ev.payload ?? {} });
      expect((await reloadCity(g, p.cityId)).buildings).toEqual(before);
      expect(g.pushes()).toEqual([]);
    }));
});
