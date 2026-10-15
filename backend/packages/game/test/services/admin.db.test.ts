import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { PushCmd } from '@marchlands/contracts';
import {
  buildingLevel,
  buildingMaxLevel,
  BuildingType,
  heroGearBonus,
  innHeroMaxLevel,
  ItemId,
  lordGear,
  MailType,
  msg,
  researchMaxLevel,
  TechType,
} from '@marchlands/core';
import { accounts, heroes } from '@marchlands/db';

import { admin, mail } from '#/index.ts';
import { getHero } from '#/repo.ts';
import { expectRefused } from '#test/support/expect.ts';
import { createTestPlayer, reloadCity, reloadPlayer } from '#test/support/factories.ts';
import { game } from '#test/support/game.ts';

describe(admin.grantItems.name, () => {
  it('adds items to what the player has, and takes them away with a negative count', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await admin.grantItems(g, a.name, { [ItemId.TRUCE_AGREEMENT]: 3, [ItemId.CROSS_MEDAL]: 1 });
      await admin.grantItems(g, a.name.toUpperCase(), { [ItemId.TRUCE_AGREEMENT]: -1 });
      const p = await reloadPlayer(g, a);
      expect(p.items).toMatchObject({ [ItemId.TRUCE_AGREEMENT]: 2, [ItemId.CROSS_MEDAL]: 1, [ItemId.NEWBIES_PACKAGE]: 1 });
      expect(g.pushes(PushCmd.ITEM_UPDATE).at(-1)).toMatchObject({ playerIds: [a.id], data: { items: [{ id: ItemId.TRUCE_AGREEMENT, count: 2 }] } });
    }));

  it('removing more than the player has leaves none', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await admin.grantItems(g, a.name, { [ItemId.NEWBIES_PACKAGE]: -5 });
      expect((await reloadPlayer(g, a)).items).not.toHaveProperty(ItemId.NEWBIES_PACKAGE);
    }));

  it('rejects an unknown player, an unknown item and a zero or fractional count', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await expectRefused(admin.grantItems(g, 'Nobody Here', { [ItemId.CROSS_MEDAL]: 1 }), msg('common.playerNamedNotFound', { name: 'Nobody Here' }));
      await expectRefused(admin.grantItems(g, a.name, { 'no.such.item': 1 }), msg('admin.unknownItem', { id: 'no.such.item' }));
      await expectRefused(admin.grantItems(g, a.name, { [ItemId.CROSS_MEDAL]: 0 }), msg('common.invalidAmount'));
      await expectRefused(admin.grantItems(g, a.name, { [ItemId.CROSS_MEDAL]: 1.5 }), msg('common.invalidAmount'));
      expect((await reloadPlayer(g, a)).items).not.toHaveProperty(ItemId.CROSS_MEDAL);
    }));
});

describe(admin.setResources.name, () => {
  it('sets the listed resources, never below zero, and leaves the others', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await admin.setResources(g, a.cityId, a.id, { gold: 5, food: -100 });
      const c = await reloadCity(g, a.cityId);
      expect({ gold: c.gold, food: c.food, wood: c.wood }).toEqual({ gold: 5, food: 0, wood: 100_000 });
      expect(g.pushes(PushCmd.CASTLE_UPDATE).at(-1)).toMatchObject({ playerIds: [a.id], data: { updateType: 2, castleBean: { id: a.cityId } } });
    }));

  it("refuses another player's city", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await expectRefused(admin.setResources(g, b.cityId, a.id, { gold: 1 }), msg('common.invalidCastle'));
    }));
});

describe(admin.setBuilding.name, () => {
  it('puts a building at a position, replaces it, and removes it at level 0', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await admin.setBuilding(g, a.cityId, a.id, 5, BuildingType.COTTAGE, 3);
      expect((await reloadCity(g, a.cityId)).buildings.find((x) => x.positionId === 5)).toMatchObject({ typeId: BuildingType.COTTAGE, level: 3, status: 0 });
      await admin.setBuilding(g, a.cityId, a.id, 5, BuildingType.BARRACKS, 2);
      const after = (await reloadCity(g, a.cityId)).buildings.filter((x) => x.positionId === 5);
      expect(after).toEqual([expect.objectContaining({ typeId: BuildingType.BARRACKS, level: 2 })]);
      await admin.setBuilding(g, a.cityId, a.id, 5, BuildingType.BARRACKS, 0);
      const city = await reloadCity(g, a.cityId);
      expect(city.buildings.some((x) => x.positionId === 5)).toBe(false);
      expect(buildingLevel(city.buildings, BuildingType.TOWN_HALL)).toBe(1);
      expect(g.pushes(PushCmd.CASTLE_UPDATE)).toHaveLength(3);
    }));

  it('rejects a level outside 0..max', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const max = buildingMaxLevel(BuildingType.COTTAGE);
      await expectRefused(admin.setBuilding(g, a.cityId, a.id, 5, BuildingType.COTTAGE, max + 1), msg('admin.invalidLevel', { max }));
      await expectRefused(admin.setBuilding(g, a.cityId, a.id, 5, BuildingType.COTTAGE, -1), msg('admin.invalidLevel', { max }));
      // an unknown building type has no levels at all
      await expectRefused(admin.setBuilding(g, a.cityId, a.id, 5, 999, 1), msg('admin.invalidLevel', { max: 0 }));
    }));
});

describe(admin.setTechnology.name, () => {
  it('sets a research level, keeping the others', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await admin.setTechnology(g, a.name, TechType.AGRICULTURE, 4);
      await admin.setTechnology(g, a.name, TechType.MASONRY, 2);
      await admin.setTechnology(g, a.name, TechType.AGRICULTURE, 0);
      expect((await reloadPlayer(g, a)).research).toEqual({ [TechType.AGRICULTURE]: { level: 0 }, [TechType.MASONRY]: { level: 2 } });
    }));

  it('Hero Enhancement re-fits the gear of every hero of the player', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const heroId = await admin.addHero(g, a.cityId, a.id, 1);
      await g.tx.update(heroes).set({ level: 50 }).where(eq(heroes.id, heroId));
      await admin.setTechnology(g, a.name, TechType.HERO_ENHANCEMENT, 3);
      const h = await getHero(g, heroId);
      const bonus = heroGearBonus(50, lordGear(await reloadPlayer(g, a)));
      expect(bonus).toBeGreaterThan(0);
      expect(h.powerAdded + h.managementAdded + h.stratagemAdded).toBe(bonus);
      expect(g.pushes(PushCmd.HERO_UPDATE).at(-1)).toMatchObject({ data: { updateType: 2 } });
    }));

  it('rejects an unknown player and a level outside 0..max', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const max = researchMaxLevel(TechType.AGRICULTURE);
      await expectRefused(admin.setTechnology(g, 'Nobody Here', TechType.AGRICULTURE, 1), msg('common.playerNamedNotFound', { name: 'Nobody Here' }));
      await expectRefused(admin.setTechnology(g, a.name, TechType.AGRICULTURE, max + 1), msg('admin.invalidLevel', { max }));
      await expectRefused(admin.setTechnology(g, a.name, TechType.AGRICULTURE, -1), msg('admin.invalidLevel', { max }));
    }));
});

describe(admin.addHero.name, () => {
  it('hires a hero into the city, of up to the Inn level allows', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const ids = [];
      for (let i = 0; i < 5; i++) ids.push(await admin.addHero(g, a.cityId, a.id, 2));
      for (const id of ids) {
        const h = await getHero(g, id);
        expect(h).toMatchObject({ playerId: a.id, cityId: a.cityId, inTavern: false, createdAt: g.now });
        expect(h.level).toBeGreaterThanOrEqual(1);
        expect(h.level).toBeLessThanOrEqual(innHeroMaxLevel(2));
      }
      expect(g.pushes(PushCmd.HERO_UPDATE)).toHaveLength(5);
      expect(g.pushes(PushCmd.HERO_UPDATE)[0]).toMatchObject({ playerIds: [a.id], data: { castleId: a.cityId, updateType: 0 } });
    }));

  it('clamps the Inn level to 1..20', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      for (let i = 0; i < 10; i++) expect((await getHero(g, await admin.addHero(g, a.cityId, a.id, -3))).level).toBeLessThanOrEqual(innHeroMaxLevel(1));
      const levels = [];
      for (let i = 0; i < 20; i++) levels.push((await getHero(g, await admin.addHero(g, a.cityId, a.id, 99))).level);
      expect(Math.max(...levels)).toBeLessThanOrEqual(innHeroMaxLevel(20));
      expect(Math.max(...levels)).toBeGreaterThan(innHeroMaxLevel(1));
    }));

  it("refuses another player's city", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await expectRefused(admin.addHero(g, b.cityId, a.id, 1), msg('common.invalidCastle'));
    }));
});

describe(admin.setBan.name, () => {
  it('bans an account with a reason and lifts the ban', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const account = async () => (await g.tx.select().from(accounts).where(eq(accounts.id, a.accountId)))[0];
      await admin.setBan(g, a.accountId, true, 'cheating');
      expect(await account()).toMatchObject({ status: 1, banReason: 'cheating' });
      await admin.setBan(g, a.accountId, false);
      expect(await account()).toMatchObject({ status: 0, banReason: '' });
    }));
});

describe(admin.mute.name, () => {
  it('denies chat for the given minutes', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await admin.mute(g, a.name, 30);
      expect((await reloadPlayer(g, a)).misc.denyChatUntil).toBe(g.now + 30 * 60_000);
    }));

  it('rejects an unknown player', () =>
    game(async (g) => {
      await expectRefused(admin.mute(g, 'Nobody Here', 30), msg('common.playerNamedNotFound', { name: 'Nobody Here' }));
    }));
});

describe(admin.broadcast.name, () => {
  it('sends a system message to everyone online, on the ticker by default', () =>
    game(async (g) => {
      admin.broadcast(g, 'Server restarts soon');
      admin.broadcast(g, 'Quiet one', false);
      expect(g.pushes(PushCmd.SYSTEM_INFO_MESSAGE)).toEqual([
        {
          playerIds: [],
          cmd: PushCmd.SYSTEM_INFO_MESSAGE,
          data: { alliance: false, tV: true, noSenderSystemInfo: true, msg: msg('admin.broadcast', { text: 'Server restarts soon' }) },
        },
        {
          playerIds: [],
          cmd: PushCmd.SYSTEM_INFO_MESSAGE,
          data: { alliance: false, tV: false, noSenderSystemInfo: true, msg: msg('admin.broadcast', { text: 'Quiet one' }) },
        },
      ]);
    }));
});

describe(admin.mailPlayer.name, () => {
  it('files a system mail for the player', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await admin.mailPlayer(g, a.name, 'Notice', 'Maintenance tonight');
      const [m] = (await mail.listMail(g, a.id, MailType.SYSTEM, 1, 10)).mails;
      expect(m).toMatchObject({ title: 'Notice', sender: null, isRead: false });
      expect(g.pushes(PushCmd.NEW_MAIL).at(-1)).toMatchObject({ playerIds: [a.id], data: { count: 1, count_system: 1 } });
    }));

  it('rejects an unknown player', () =>
    game(async (g) => {
      await expectRefused(admin.mailPlayer(g, 'Nobody Here', 't', 'c'), msg('common.playerNamedNotFound', { name: 'Nobody Here' }));
    }));
});

describe(admin.setPlayerFlags.name, () => {
  it('sets beginner protection and the title, clamped to 0..9', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await admin.setPlayerFlags(g, a.name, { beginner: false, title: 3 });
      expect(await reloadPlayer(g, a)).toMatchObject({ beginner: false, title: 3 });
      expect(g.pushes(PushCmd.PLAYER_INFO_UPDATE).at(-1)).toMatchObject({ playerIds: [a.id], data: { playerInfo: { beginner: false, titleId: 3 } } });
      await admin.setPlayerFlags(g, a.name, { title: 42 });
      expect(await reloadPlayer(g, a)).toMatchObject({ beginner: false, title: 9 });
      await admin.setPlayerFlags(g, a.name, { title: -1, beginner: true });
      expect(await reloadPlayer(g, a)).toMatchObject({ beginner: true, title: 0 });
    }));

  it('leaves what is not given unchanged', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await admin.setPlayerFlags(g, a.name, { title: 2 });
      await admin.setPlayerFlags(g, a.name, {});
      expect(await reloadPlayer(g, a)).toMatchObject({ beginner: true, title: 2 });
    }));

  it('rejects an unknown player', () =>
    game(async (g) => {
      await expectRefused(admin.setPlayerFlags(g, 'Nobody Here', { title: 1 }), msg('common.playerNamedNotFound', { name: 'Nobody Here' }));
    }));
});

describe(admin.setCityStats.name, () => {
  it('sets the population (never below zero) and the given troop counts, keeping the other troops', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await admin.setCityStats(g, a.cityId, a.id, { population: 300, troops: { archer: 10, scouter: 5 } });
      await admin.setCityStats(g, a.cityId, a.id, { troops: { archer: 4 } });
      let c = await reloadCity(g, a.cityId);
      // a troop type given replaces that count, it is not added to it
      expect(c.troops).toEqual({ archer: 4, scouter: 5 });
      expect(c.population).toBe(300);
      await admin.setCityStats(g, a.cityId, a.id, { population: -5 });
      c = await reloadCity(g, a.cityId);
      expect(c.population).toBe(0);
      expect(g.pushes(PushCmd.CASTLE_UPDATE)).toHaveLength(3);
    }));

  it("refuses another player's city", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await expectRefused(admin.setCityStats(g, b.cityId, a.id, { population: 1 }), msg('common.invalidCastle'));
    }));
});
