import { describe, expect, it } from 'vitest';

import { PushCmd } from '@marchlands/contracts';
import { BuffId, ItemId, msg, TimedEventType } from '@marchlands/core';

import { cityBean } from '#/dto.ts';
import { addItem, consumeItem, playerInfoOf, pushCity, pushPlayerInfo, pushResources, removeBuff, setBuff, useItemOrGold } from '#/helpers.ts';
import { getCity, getPlayer } from '#/repo.ts';
import { createTestAlliance } from '#test/support/alliance.ts';
import { expectRefused } from '#test/support/expect.ts';
import { addCity, cityBundle, createTestPlayer, setResources } from '#test/support/factories.ts';
import { game } from '#test/support/game.ts';

const HOUR = 3_600_000;
const ITEM = ItemId.KINGS_PEACE;

describe(addItem.name, () => {
  it('adds to the count, pushes the new count and counts it as gained', () =>
    game(async (g) => {
      const t = await createTestPlayer(g);
      const p = await getPlayer(g, t.id);
      addItem(g, p, ITEM, 2);
      addItem(g, p, ITEM, 3);
      expect(p.items[ITEM]).toBe(5);
      expect(g.pushes(PushCmd.ITEM_UPDATE).at(-1)).toEqual({ playerIds: [p.id], cmd: PushCmd.ITEM_UPDATE, data: { items: [{ id: ITEM, count: 5 }] } });
      expect(g._stats.get(`${p.id}|0`)).toMatchObject({ [`items.gained.${ITEM}`]: 5 });
    }));

  it('removes an item used up, never going below none, and counts what was used', () =>
    game(async (g) => {
      const t = await createTestPlayer(g);
      const p = await getPlayer(g, t.id);
      const items = p.items;
      addItem(g, p, ITEM, 1);
      expect(items).not.toHaveProperty(ITEM); // a new object: the row read earlier is not changed
      addItem(g, p, ITEM, -3);
      expect(p.items).not.toHaveProperty(ITEM);
      expect(g.pushes(PushCmd.ITEM_UPDATE).at(-1)?.data).toEqual({ items: [{ id: ITEM, count: 0 }] });
      expect(g._stats.get(`${p.id}|0`)).toMatchObject({ [`items.used.${ITEM}`]: 3 });
    }));
});

describe(consumeItem.name, () => {
  it('uses items the player holds', () =>
    game(async (g) => {
      const t = await createTestPlayer(g);
      const p = await getPlayer(g, t.id);
      addItem(g, p, ITEM, 3);
      consumeItem(g, p, ITEM);
      consumeItem(g, p, ITEM, 2);
      expect(p.items).not.toHaveProperty(ITEM);
    }));

  it('refuses when the player holds too few, taking none', () =>
    game(async (g) => {
      const t = await createTestPlayer(g);
      const p = await getPlayer(g, t.id);
      addItem(g, p, ITEM, 1);
      await expectRefused(
        Promise.resolve().then(() => consumeItem(g, p, ITEM, 2)),
        msg('common.insufficientItems'),
      );
      expect(p.items[ITEM]).toBe(1);
    }));
});

describe(useItemOrGold.name, () => {
  it('uses the item when the player holds one, leaving the gold', () =>
    game(async (g) => {
      const t = await createTestPlayer(g);
      await setResources(g, t, { gold: 1000 });
      const p = await getPlayer(g, t.id);
      const c = await getCity(g, t.cityId);
      addItem(g, p, ITEM, 1);
      useItemOrGold(g, p, c, ITEM, 500);
      expect(p.items).not.toHaveProperty(ITEM);
      expect(c.gold).toBe(1000);
    }));

  it("otherwise buys it with the city's gold, counting the gold and the item used", () =>
    game(async (g) => {
      const t = await createTestPlayer(g);
      await setResources(g, t, { gold: 1000 });
      const p = await getPlayer(g, t.id);
      const c = await getCity(g, t.cityId);
      g._stats.clear();
      useItemOrGold(g, p, c, ITEM, 400);
      expect(c.gold).toBe(600);
      expect(g._stats.get(`${p.id}|${c.id}`)).toEqual({ 'spent.items.gold': 400, [`items.used.${ITEM}`]: 1 });
      await expectRefused(
        Promise.resolve().then(() => useItemOrGold(g, p, c, ITEM, 601)),
        msg('common.notEnoughGoldFor', { amount: 601 }),
      );
    }));
});

describe(setBuff.name, () => {
  it('starts a buff, schedules its expiry and tells the player', () =>
    game(async (g) => {
      const t = await createTestPlayer(g);
      const p = await getPlayer(g, t.id);
      const desc = msg('buff.truce');
      setBuff(g, p, BuffId.TRUCE, desc, g.now + HOUR, { param: 3, itemId: ITEM });
      expect(p.buffs).toEqual([{ id: BuffId.TRUCE, desc, endTime: g.now + HOUR, param: 3, itemId: ITEM }]);
      expect(g.events(TimedEventType.BUFF_EXPIRE)).toEqual([
        { type: TimedEventType.BUFF_EXPIRE, dueAt: g.now + HOUR, playerId: p.id, refKey: `buff:${p.id}:${BuffId.TRUCE}`, payload: { buffId: BuffId.TRUCE } },
      ]);
      expect(g.pushes(PushCmd.PLAYER_BUFF_UPDATE)).toEqual([
        { playerIds: [p.id], cmd: PushCmd.PLAYER_BUFF_UPDATE, data: { buffBean: { typeId: BuffId.TRUCE, desc, endTime: g.now + HOUR }, updateType: 0 } },
      ]);
    }));

  it('replaces a running buff of the same kind, or extends it by the new length with `extend`', () =>
    game(async (g) => {
      const t = await createTestPlayer(g);
      const p = await getPlayer(g, t.id);
      const desc = msg('buff.truce');
      setBuff(g, p, BuffId.ATTACK, desc, g.now + HOUR);
      setBuff(g, p, BuffId.ATTACK, desc, g.now + 2 * HOUR);
      expect(p.buffs).toMatchObject([{ id: BuffId.ATTACK, endTime: g.now + 2 * HOUR }]);
      setBuff(g, p, BuffId.ATTACK, desc, g.now + HOUR, { extend: true });
      expect(p.buffs).toMatchObject([{ id: BuffId.ATTACK, endTime: g.now + 3 * HOUR }]);
      expect(g.events(TimedEventType.BUFF_EXPIRE)).toMatchObject([{ dueAt: g.now + 3 * HOUR }]);
    }));

  it('`extend` starts afresh when the buff has ended, and drops ended buffs', () =>
    game(async (g) => {
      const t = await createTestPlayer(g);
      const p = await getPlayer(g, t.id);
      const desc = msg('buff.truce');
      setBuff(g, p, BuffId.ATTACK, desc, g.now + HOUR);
      setBuff(g, p, BuffId.DEFENSE, desc, g.now + HOUR);
      g.advance(HOUR);
      setBuff(g, p, BuffId.ATTACK, desc, g.now + HOUR, { extend: true });
      expect(p.buffs).toEqual([{ id: BuffId.ATTACK, desc, endTime: g.now + HOUR }]);
    }));
});

describe(removeBuff.name, () => {
  it('ends the buff, cancels its expiry and tells the player', () =>
    game(async (g) => {
      const t = await createTestPlayer(g);
      const p = await getPlayer(g, t.id);
      const desc = msg('buff.truce');
      setBuff(g, p, BuffId.TRUCE, desc, g.now + HOUR);
      setBuff(g, p, BuffId.ATTACK, desc, g.now + HOUR);
      removeBuff(g, p, BuffId.TRUCE);
      expect(p.buffs.map((b) => b.id)).toEqual([BuffId.ATTACK]);
      expect(g.events(TimedEventType.BUFF_EXPIRE).map((e) => e.refKey)).toEqual([`buff:${p.id}:${BuffId.ATTACK}`]);
      expect(g._unscheduled).toEqual(new Set([`buff:${p.id}:${BuffId.TRUCE}`]));
      expect(g.pushes(PushCmd.PLAYER_BUFF_UPDATE).at(-1)?.data).toEqual({ buffBean: { typeId: BuffId.TRUCE, desc, endTime: g.now + HOUR }, updateType: 1 });
    }));

  it('a buff the player does not have only cancels its expiry, with no push', () =>
    game(async (g) => {
      const t = await createTestPlayer(g);
      const p = await getPlayer(g, t.id);
      g._pushes.length = 0;
      removeBuff(g, p, BuffId.TRUCE);
      expect(g.pushes()).toEqual([]);
      expect(g._unscheduled).toEqual(new Set([`buff:${p.id}:${BuffId.TRUCE}`]));
    }));
});

describe('pushes', () => {
  it("pushResources and pushCity send the city's resources and the city to its owner", () =>
    game(async (g) => {
      const t = await createTestPlayer(g);
      const b = await cityBundle(g, t);
      g._pushes.length = 0;
      pushResources(g, b);
      pushCity(g, b);
      expect(g.pushes(PushCmd.RESOURCE_UPDATE)).toMatchObject([{ playerIds: [t.id], data: { castleId: t.cityId, resource: expect.any(Object) } }]);
      expect(g.pushes(PushCmd.CASTLE_UPDATE)).toEqual([
        { playerIds: [t.id], cmd: PushCmd.CASTLE_UPDATE, data: { updateType: 2, castleBean: cityBean(b, g.now) } },
      ]);
    }));
});

describe(playerInfoOf.name, () => {
  it('counts the cities, with no alliance name for a player without one', () =>
    game(async (g) => {
      const t = await createTestPlayer(g);
      await addCity(g, t);
      expect(await playerInfoOf(g, await getPlayer(g, t.id))).toMatchObject({ id: t.id, userName: t.name, castleCount: 2, alliance: '' });
    }));

  it("names the player's alliance", () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const p = await getPlayer(g, a.host.id);
      expect(await playerInfoOf(g, p)).toMatchObject({ alliance: a.name });
    }));

  it('pushPlayerInfo sends it to the player', () =>
    game(async (g) => {
      const t = await createTestPlayer(g);
      const p = await getPlayer(g, t.id);
      g._pushes.length = 0;
      await pushPlayerInfo(g, p);
      expect(g.pushes(PushCmd.PLAYER_INFO_UPDATE)).toEqual([
        { playerIds: [p.id], cmd: PushCmd.PLAYER_INFO_UPDATE, data: { playerInfo: await playerInfoOf(g, p) } },
      ]);
    }));
});
