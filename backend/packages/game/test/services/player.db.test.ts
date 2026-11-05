import { and, eq, isNull } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { type CreatePlayerBody, PushCmd } from '@marchlands/contracts';
import {
  ArmyDirection,
  BALANCE,
  BuffId,
  BuildingType,
  DAY,
  goldForCents,
  HeroStatus,
  HOUR,
  itemGoldPrice,
  ItemId,
  marchTimeMs,
  Mission,
  msg,
  PlayerStatus,
  Relation,
  ReportType,
  stateOf,
  TileType,
  tileXY,
  TimedEventType,
  TITLES,
} from '@marchlands/core';
import { accounts, alliances, armies as armyRows, cities, heroes, mails, reports as reportRows, tiles, timedEvents } from '@marchlands/db';

import { departRef } from '#/engine/armies.ts';
import { sendSystemMail } from '#/engine/mail.ts';
import { initialCity, isProtected } from '#/engine/player.ts';
import { createReport } from '#/engine/reports.ts';
import { admin, alliance, armies, interior, mail, player, reports } from '#/index.ts';
import { getCity, getHero, getPlayer, getTile, savePlayer } from '#/repo.ts';
import { allies, arrive, send, warrior } from '#test/support/armies.ts';
import { expectRefused } from '#test/support/expect.ts';
import {
  addHero,
  cityBundle,
  createTestPlayer,
  giveItems,
  reloadCity,
  reloadPlayer,
  setBuildings,
  setCityStats,
  setResources,
  type TestPlayer,
} from '#test/support/factories.ts';
import { game, type TestGame } from '#test/support/game.ts';

let accountSerial = 0;

/** A fresh account with no player yet. */
async function newAccount(g: TestGame): Promise<number> {
  const n = ++accountSerial;
  const [a] = await g.tx
    .insert(accounts)
    .values({ username: `player_test_${n}_${g.now}`, email: `player_test_${n}_${g.now}@example.test`, passwordHash: 'x', createdAt: g.now })
    .returning();
  return a!.id;
}

const input = (name: string, extra: Partial<CreatePlayerBody> = {}): CreatePlayerBody => ({
  userName: name,
  castleName: `${name} City`,
  flag: 'T',
  faceUrl: '',
  sex: 0,
  zone: -1,
  ...extra,
});

/** Some tiles of a type that nobody owns, from the seeded map. */
const freeTiles = (g: TestGame, type: number, n = 1) =>
  g.tx
    .select()
    .from(tiles)
    .where(and(eq(tiles.type, type), isNull(tiles.cityId), isNull(tiles.ownerCityId)))
    .orderBy(tiles.id)
    .limit(n);

/** Send one scout from the player's city to a tile (a Rally Spot and scouts are added first); returns the army id. */
async function sendScout(g: TestGame, p: TestPlayer, targetTileId: number): Promise<number> {
  await setBuildings(g, p, [[20, BuildingType.RALLY_SPOT, 1]]);
  await setCityStats(g, p, { troops: { scouter: 10 } });
  const a = await armies.sendArmy(g, p.id, p.cityId, { targetTileId, mission: Mission.SCOUT, troops: { scouter: 1 } });
  return a.armyId;
}

/** Give the player prestige (no service grants it directly). */
async function setPrestige(g: TestGame, p: TestPlayer, prestige: number) {
  const row = await getPlayer(g, p.id, { lock: true });
  row.prestige = prestige;
  await savePlayer(g, row);
}

const FURLOUGH_DAY_GOLD = goldForCents(BALANCE.furloughCentsPerDay);

describe(player.createPlayer.name, () => {
  it('creates the player with a starting city on a free flat of the chosen state', () =>
    game(async (g) => {
      const accountId = await newAccount(g);
      const p = await player.createPlayer(g, accountId, input('Alice', { zone: 3, flag: ' AB ', faceUrl: 'f'.repeat(150), sex: 1 }));
      expect(p).toMatchObject({
        accountId,
        name: 'Alice',
        flag: 'AB',
        sex: 1,
        beginner: true,
        title: 0,
        items: { [ItemId.WELCOME_PACKAGE]: 1 },
        createdAt: g.now,
        lastLoginAt: g.now,
      });
      expect(p.faceUrl).toHaveLength(100);

      const [city] = await g.tx.select().from(cities).where(eq(cities.playerId, p.id));
      expect(city).toMatchObject(initialCity(p.id, city!.tileId, 'Alice City', g.now));
      expect(stateOf(city!.tileId)).toBe(3);
      expect(await getTile(g, city!.tileId)).toMatchObject({ type: TileType.CASTLE, cityId: city!.id, ownerPlayerId: p.id, ownerCityId: null });
    }));

  it('tidies the spaces in names', () =>
    game(async (g) => {
      const p = await player.createPlayer(g, await newAccount(g), input('  Ann   Lee ', { castleName: ' Lee   Keep ' }));
      expect(p.name).toBe('Ann Lee');
      expect((await player.playerState(g, p.id)).castles[0]!.name).toBe('Lee Keep');
    }));

  it('rejects bad names', () =>
    game(async (g) => {
      const accountId = await newAccount(g);
      const playerName = msg('common.playerName');
      const cityName = msg('common.cityName');
      await expectRefused(player.createPlayer(g, accountId, input('   ')), msg('common.nameLength', { what: playerName, min: 1, max: 20 }));
      await expectRefused(player.createPlayer(g, accountId, input('A'.repeat(21))), msg('common.nameLength', { what: playerName, min: 1, max: 20 }));
      await expectRefused(player.createPlayer(g, accountId, input('<b>Bob</b>')), msg('common.nameInvalid', { what: playerName }));
      await expectRefused(player.createPlayer(g, accountId, input('Shitlord')), msg('common.nameNotAllowed'));
      await expectRefused(
        player.createPlayer(g, accountId, input('Bob', { castleName: 'C'.repeat(21) })),
        msg('common.nameLength', { what: cityName, min: 1, max: 20 }),
      );
      await expectRefused(player.createPlayer(g, accountId, input('Bob', { castleName: 'Fuck Town' })), msg('common.nameNotAllowed'));
    }));

  it('rejects a bad flag, gender or state', () =>
    game(async (g) => {
      const accountId = await newAccount(g);
      for (const bad of [{ flag: '  ' }, { flag: 'TOOLONG' }, { sex: 2 }, { zone: 16 }, { zone: -2 }, { zone: 1.5 }]) {
        await expectRefused(player.createPlayer(g, accountId, input('Bob', bad)), msg('common.invalidData'));
      }
    }));

  it('rejects a name already taken, in any case', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await expectRefused(player.createPlayer(g, await newAccount(g), input(a.name.toUpperCase())), msg('player.nameTaken'));
    }));

  it('refuses a second player on an account that has a city', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await expectRefused(player.createPlayer(g, a.accountId, input('Another')), msg('player.accountExists'));
    }));

  it('after a restart, the account creates again in the same player slot', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await player.restartPlayer(g, a.id);
      const p = await player.createPlayer(g, a.accountId, input(a.name, { flag: 'NEW', sex: 1 }));
      expect(p).toMatchObject({ id: a.id, name: a.name, flag: 'NEW', sex: 1, beginner: true, status: 0 });
      const state = await player.playerState(g, a.id);
      expect(state.castles).toHaveLength(1);
      expect(state.castles[0]!.name).toBe(`${a.name} City`);
    }));
});

describe(player.playerState.name, () => {
  it("describes a new player's start", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const s = await player.playerState(g, a.id);
      expect(s).toMatchObject({
        playerInfo: { id: a.id, userName: a.name, beginner: true, castleCount: 1 },
        items: [{ id: ItemId.WELCOME_PACKAGE, count: 1 }],
        buffs: [],
        research: {},
        selfArmys: [],
        castleSignBean: [],
        newMailCount: 0,
        newReportCount: 0,
        furlough: false,
        furloughEndTime: 0,
        mapSizeX: BALANCE.mapSize,
        mapSizeY: BALANCE.mapSize,
        currentTime: g.now,
        tutorialStepId: 0,
        nextRenameAt: 0,
        nextGenderChangeAt: 0,
      });
      expect(s.castles).toEqual([expect.objectContaining({ id: a.cityId, name: `${a.name} City` })]);
      expect(s.gear).toEqual({ level: 0, stars: {} });
    }));

  it('counts unread mail and reports per folder and tab', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await mail.sendMail(g, b.id, a.name, 'Hi', 'there');
      await sendSystemMail(g, a.id, 'Welcome', 'Body');
      await sendSystemMail(g, a.id, 'Again', 'Body');
      const title = msg('report.title.scoutReport');
      const body = { kind: 'text' as const, text: msg('report.oldFormat') };
      await createReport(g, { playerId: a.id, typeId: ReportType.TRADE, title, body });
      await createReport(g, { playerId: a.id, typeId: ReportType.ARMY, title, body });
      const read = await createReport(g, { playerId: a.id, typeId: ReportType.OTHER, title, body });
      await reports.markReportsRead(g, a.id, [read]);
      expect(await player.playerState(g, a.id)).toMatchObject({
        newMailCount: 3,
        newMaileCount_inbox: 1,
        newMaileCount_system: 2,
        newReportCount: 2,
        newReportCount_trade: 1,
        newReportCount_army: 1,
        newReportCount_other: 0,
      });
    }));

  it('shows holiday mode, cooldowns, the tutorial step and armies out', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await player.startFurlough(g, a.id, 1, a.cityId);
      await player.renamePlayer(g, a.id, 'Renamed');
      await player.changeGender(g, a.id, 1);
      await player.saveTutorialStep(g, a.id, 7);
      const [npc] = await freeTiles(g, TileType.NPC);
      const armyId = await sendScout(g, a, npc!.id);
      const s = await player.playerState(g, a.id);
      expect(s).toMatchObject({
        furlough: true,
        furloughEndTime: g.now + DAY,
        nextRenameAt: g.now + BALANCE.renameCooldownMs,
        nextGenderChangeAt: g.now + BALANCE.genderCooldownMs,
        tutorialStepId: 7,
      });
      expect(s.buffs).toEqual([expect.objectContaining({ id: BuffId.HOLIDAY, endTime: g.now + DAY })]);
      expect(s.selfArmys).toEqual([expect.objectContaining({ armyId })]);
    }));
});

describe(player.touchLogin.name, () => {
  it('records the login and last-seen time', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      g.advance(HOUR);
      await player.touchLogin(g, a.id);
      expect(await reloadPlayer(g, a)).toMatchObject({ lastLoginAt: g.now, lastSeenAt: g.now });
    }));
});

describe(player.changeFace.name, () => {
  it('sets the face and gender once', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await player.changeFace(g, a.id, 'faces/7.png', 1);
      const p = await reloadPlayer(g, a);
      expect(p).toMatchObject({ faceUrl: 'faces/7.png', sex: 1 });
      expect(p.misc.changedFace).toBe(true);
      expect(g.pushes(PushCmd.PLAYER_INFO_UPDATE).at(-1)).toMatchObject({
        playerIds: [a.id],
        data: { playerInfo: { faceUrl: 'faces/7.png', changedFace: true } },
      });
      await expectRefused(player.changeFace(g, a.id, 'faces/8.png', 0), msg('player.invalidSetting'));
      expect((await reloadPlayer(g, a)).faceUrl).toBe('faces/7.png');
    }));

  it('rejects an empty or too long face and an unknown gender', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await expectRefused(player.changeFace(g, a.id, '', 0), msg('player.invalidSetting'));
      await expectRefused(player.changeFace(g, a.id, 'f'.repeat(101), 0), msg('player.invalidSetting'));
      await expectRefused(player.changeFace(g, a.id, 'faces/1.png', 2), msg('player.invalidSetting'));
      expect((await reloadPlayer(g, a)).misc.changedFace).toBeUndefined();
      await player.changeFace(g, a.id, 'f'.repeat(100), 0);
    }));
});

describe(player.changeFlag.name, () => {
  it('sets the trimmed flag', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await player.changeFlag(g, a.id, ' ABCDE ');
      expect((await reloadPlayer(g, a)).flag).toBe('ABCDE');
      expect(g.pushes(PushCmd.PLAYER_INFO_UPDATE).at(-1)).toMatchObject({ data: { playerInfo: { flag: 'ABCDE' } } });
    }));

  it('rejects an empty or too long flag', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await expectRefused(player.changeFlag(g, a.id, '   '), msg('player.invalidFlag'));
      await expectRefused(player.changeFlag(g, a.id, 'ABCDEF'), msg('player.invalidFlag'));
      expect((await reloadPlayer(g, a)).flag).toBe('T');
    }));
});

describe(player.renamePlayer.name, () => {
  it('renames the player and starts the cooldown', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await player.renamePlayer(g, a.id, '  New   Name ');
      const p = await reloadPlayer(g, a);
      expect(p.name).toBe('New Name');
      expect(p.misc.renamedAt).toBe(g.now);
      expect(g.pushes(PushCmd.PLAYER_INFO_UPDATE).at(-1)).toMatchObject({ data: { playerInfo: { userName: 'New Name' } } });
    }));

  it('allows one rename per cooldown, telling the hours left', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await player.renamePlayer(g, a.id, 'First');
      await expectRefused(player.renamePlayer(g, a.id, 'Second'), msg('player.renameCooldown', { count: BALANCE.renameCooldownMs / HOUR }));
      g.advance(BALANCE.renameCooldownMs - HOUR / 2);
      await expectRefused(player.renamePlayer(g, a.id, 'Second'), msg('player.renameCooldown', { count: 1 }));
      g.advance(HOUR / 2);
      await player.renamePlayer(g, a.id, 'Second');
      expect((await reloadPlayer(g, a)).name).toBe('Second');
    }));

  it('may change only the case of the own name', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await player.renamePlayer(g, a.id, a.name.toLowerCase());
      expect((await reloadPlayer(g, a)).name).toBe(a.name.toLowerCase());
    }));

  it('rejects the same name, a taken name and a bad name', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await expectRefused(player.renamePlayer(g, a.id, ` ${a.name} `), msg('player.sameName'));
      await expectRefused(player.renamePlayer(g, a.id, b.name.toLowerCase()), msg('player.nameTaken'));
      await expectRefused(player.renamePlayer(g, a.id, ''), msg('common.nameLength', { what: msg('common.playerName'), min: 1, max: 20 }));
      await expectRefused(player.renamePlayer(g, a.id, 'a;b'), msg('common.nameInvalid', { what: msg('common.playerName') }));
      await expectRefused(player.renamePlayer(g, a.id, 'Bitchin'), msg('common.nameNotAllowed'));
      expect((await reloadPlayer(g, a)).misc.renamedAt).toBeUndefined();
    }));
});

describe(player.changeGender.name, () => {
  it('changes the gender once per cooldown', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await player.changeGender(g, a.id, 1);
      const p = await reloadPlayer(g, a);
      expect(p.sex).toBe(1);
      expect(p.misc.genderChangedAt).toBe(g.now);
      expect(g.pushes(PushCmd.PLAYER_INFO_UPDATE).at(-1)).toMatchObject({ data: { playerInfo: { sex: 1 } } });
      await expectRefused(player.changeGender(g, a.id, 0), msg('player.genderCooldown', { count: BALANCE.genderCooldownMs / HOUR }));
      g.advance(BALANCE.genderCooldownMs);
      await player.changeGender(g, a.id, 0);
      expect((await reloadPlayer(g, a)).sex).toBe(0);
    }));

  it('rejects the same or an unknown gender', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await expectRefused(player.changeGender(g, a.id, 0), msg('player.sameGender'));
      await expectRefused(player.changeGender(g, a.id, 3), msg('player.invalidSetting'));
    }));
});

describe(player.promoteTitle.name, () => {
  it('promotes with enough prestige, consuming the medals and the gold but not the prestige', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const next = TITLES[1]!;
      await setPrestige(g, a, next.prestige);
      await setResources(g, a, { gold: next.gold + 5 });
      await giveItems(g, a, { ...next.medals, [ItemId.LION_MEDAL]: 1 });
      expect(await player.promoteTitle(g, a.id, a.cityId)).toEqual({ titleId: 1 });
      const p = await reloadPlayer(g, a);
      expect(p).toMatchObject({ title: 1, prestige: next.prestige });
      for (const id of Object.keys(next.medals)) expect(p.items).not.toHaveProperty(id);
      expect(p.items[ItemId.LION_MEDAL]).toBe(1);
      expect((await getCity(g, a.cityId)).gold).toBe(5);
      expect(g.pushes(PushCmd.PLAYER_INFO_UPDATE).at(-1)).toMatchObject({ data: { playerInfo: { titleId: 1 } } });
    }));

  it('needs the prestige, the medals and the gold of the next title', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await admin.setPlayerFlags(g, a.name, { title: 2 });
      const next = TITLES[3]!;
      await setPrestige(g, a, next.prestige - 1);
      await expectRefused(player.promoteTitle(g, a.id, a.cityId), msg('player.title.prestigeRequired', { prestige: next.prestige }));
      await setPrestige(g, a, next.prestige);
      const [first, ...rest] = Object.entries(next.medals);
      const [medal, n] = first!;
      await giveItems(g, a, { [medal]: n - 1, ...Object.fromEntries(rest) });
      await expectRefused(player.promoteTitle(g, a.id, a.cityId), msg('player.title.notEnoughMedals'));
      expect((await reloadPlayer(g, a)).items[medal]).toBe(n - 1);
      await giveItems(g, a, { [medal]: 1 });
      // short of gold: refused, nothing used up
      await setResources(g, a, { gold: next.gold - 1 });
      await expectRefused(player.promoteTitle(g, a.id, a.cityId), msg('common.notEnoughGoldFor', { amount: next.gold }));
      expect((await reloadPlayer(g, a)).items[medal]).toBe(n);
      await setResources(g, a, { gold: next.gold });
      expect(await player.promoteTitle(g, a.id, a.cityId)).toEqual({ titleId: 3 });
    }));

  it('stops at the highest title', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await admin.setPlayerFlags(g, a.name, { title: TITLES.length - 1 });
      await setPrestige(g, a, 2_000_000_000);
      await expectRefused(player.promoteTitle(g, a.id, a.cityId), msg('player.title.highest'));
    }));
});

describe(player.saveTutorialStep.name, () => {
  it('stores the step, keeping the rest of misc', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await player.changeFace(g, a.id, 'faces/1.png', 0);
      await player.saveTutorialStep(g, a.id, 4);
      await player.saveTutorialStep(g, a.id, 5);
      expect((await reloadPlayer(g, a)).misc).toMatchObject({ tutorialStep: 5, changedFace: true });
    }));
});

describe(player.startFurlough.name, () => {
  it("starts holiday mode for the days paid with the city's gold", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await player.startFurlough(g, a.id, 1, a.cityId);
      const p = await reloadPlayer(g, a);
      expect(p.status).toBe(PlayerStatus.HOLIDAY);
      expect(p.buffs).toEqual([expect.objectContaining({ id: BuffId.HOLIDAY, desc: msg('buff.holiday'), endTime: g.now + DAY })]);
      expect((await reloadCity(g, a.cityId)).gold).toBe(BALANCE.startingResources - FURLOUGH_DAY_GOLD);
      expect(g.events(TimedEventType.BUFF_EXPIRE)).toEqual([
        expect.objectContaining({ dueAt: g.now + DAY, playerId: a.id, payload: { buffId: BuffId.HOLIDAY } }),
      ]);
      expect(g.pushes(PushCmd.RESOURCE_UPDATE).at(-1)).toMatchObject({ data: { castleId: a.cityId } });
      expect(g.pushes(PushCmd.PLAYER_BUFF_UPDATE).at(-1)).toMatchObject({ data: { buffBean: { typeId: BuffId.HOLIDAY }, updateType: 0 } });
      expect(g.pushes(PushCmd.PLAYER_INFO_UPDATE).at(-1)).toMatchObject({ data: { playerInfo: { status: PlayerStatus.HOLIDAY } } });
      expect(g._stats.get(`${a.id}|${a.cityId}`)).toMatchObject({ 'spent.other.gold': FURLOUGH_DAY_GOLD });
    }));

  it('ends by itself when the days are over', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await player.startFurlough(g, a.id, 1, a.cityId);
      await g.runDue(g.now + DAY);
      const p = await reloadPlayer(g, a);
      expect(p.status).toBe(PlayerStatus.NORMAL);
      expect(p.buffs).toEqual([]);
      expect(isProtected(p, g.now)).toEqual(msg('player.protected.beginner'));
    }));

  it('accepts 1 to 30 days only', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      for (const days of [0, 31, 1.5, -1]) await expectRefused(player.startFurlough(g, a.id, days, a.cityId), msg('player.holiday.invalidDays', { max: 30 }));
      await setResources(g, a, { gold: 30 * FURLOUGH_DAY_GOLD });
      await player.startFurlough(g, a.id, 30, a.cityId);
      expect((await reloadCity(g, a.cityId)).gold).toBe(0);
    }));

  it('needs the gold for every day', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await setResources(g, a, { gold: 2 * FURLOUGH_DAY_GOLD - 1 });
      await expectRefused(player.startFurlough(g, a.id, 2, a.cityId), msg('common.notEnoughGoldFor', { amount: 2 * FURLOUGH_DAY_GOLD }));
      expect((await reloadPlayer(g, a)).buffs).toEqual([]);
    }));

  it('is refused while an army is out', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const [npc] = await freeTiles(g, TileType.NPC);
      await sendScout(g, a, npc!.id);
      await expectRefused(player.startFurlough(g, a.id, 1, a.cityId), msg('player.holiday.troopsOut'));
    }));

  it("refuses another player's city", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await expectRefused(player.startFurlough(g, a.id, 1, b.cityId), msg('common.invalidCastle'));
    }));
});

describe(player.cancelFurlough.name, () => {
  it('ends holiday mode and its expiry', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await player.startFurlough(g, a.id, 1, a.cityId);
      await player.cancelFurlough(g, a.id);
      const p = await reloadPlayer(g, a);
      expect(p.status).toBe(PlayerStatus.NORMAL);
      expect(p.buffs).toEqual([]);
      expect(g.events(TimedEventType.BUFF_EXPIRE)).toEqual([]);
      expect(g.pushes(PushCmd.PLAYER_BUFF_UPDATE).at(-1)).toMatchObject({ data: { buffBean: { typeId: BuffId.HOLIDAY }, updateType: 1 } });
      expect(g.pushes(PushCmd.PLAYER_INFO_UPDATE).at(-1)).toMatchObject({ data: { playerInfo: { status: PlayerStatus.NORMAL } } });
    }));

  it('leaves another status alone when not on holiday', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await giveItems(g, a, { [ItemId.TRUCE_AGREEMENT]: 1 });
      await player.startTruce(g, a.id, ItemId.TRUCE_AGREEMENT, a.cityId);
      await player.cancelFurlough(g, a.id);
      const p = await reloadPlayer(g, a);
      expect(p.status).toBe(PlayerStatus.TRUCE);
      expect(p.buffs.map((b) => b.id)).toEqual([BuffId.TRUCE]);
    }));
});

describe(player.startTruce.name, () => {
  it('uses a Truce Agreement when the player has one', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await giveItems(g, a, { [ItemId.TRUCE_AGREEMENT]: 2 });
      await player.startTruce(g, a.id, ItemId.TRUCE_AGREEMENT, a.cityId);
      const p = await reloadPlayer(g, a);
      expect(p.status).toBe(PlayerStatus.TRUCE);
      expect(p.items[ItemId.TRUCE_AGREEMENT]).toBe(1);
      expect(p.buffs).toEqual([{ id: BuffId.TRUCE, desc: msg('buff.truce'), endTime: g.now + BALANCE.truceDurationMs, itemId: ItemId.TRUCE_AGREEMENT }]);
      expect((await reloadCity(g, a.cityId)).gold).toBe(BALANCE.startingResources);
      expect(g.events(TimedEventType.BUFF_EXPIRE)).toEqual([
        expect.objectContaining({ dueAt: g.now + BALANCE.truceDurationMs, payload: { buffId: BuffId.TRUCE } }),
      ]);
      expect(g.pushes(PushCmd.PLAYER_INFO_UPDATE).at(-1)).toMatchObject({ data: { playerInfo: { status: PlayerStatus.TRUCE } } });
    }));

  it("buys one with the city's gold otherwise", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const price = itemGoldPrice(ItemId.TRUCE_AGREEMENT)!;
      await setResources(g, a, { gold: price + 7 });
      await player.startTruce(g, a.id, ItemId.TRUCE_AGREEMENT, a.cityId);
      expect((await reloadCity(g, a.cityId)).gold).toBe(7);
      expect(g.pushes(PushCmd.RESOURCE_UPDATE).at(-1)).toMatchObject({ data: { castleId: a.cityId } });
      expect((await reloadPlayer(g, a)).status).toBe(PlayerStatus.TRUCE);
    }));

  it('is refused without the item or its gold', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const price = itemGoldPrice(ItemId.TRUCE_AGREEMENT)!;
      await setResources(g, a, { gold: price - 1 });
      await expectRefused(player.startTruce(g, a.id, ItemId.TRUCE_AGREEMENT, a.cityId), msg('common.notEnoughGoldFor', { amount: price }));
      expect((await reloadPlayer(g, a)).status).toBe(PlayerStatus.NORMAL);
    }));

  it('takes only a Truce Agreement', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await giveItems(g, a, { [ItemId.CROSS_MEDAL]: 1 });
      await expectRefused(player.startTruce(g, a.id, ItemId.CROSS_MEDAL, a.cityId), msg('common.invalidData'));
    }));

  it('is followed by a cooldown during which no new truce can start', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await giveItems(g, a, { [ItemId.TRUCE_AGREEMENT]: 2 });
      await player.startTruce(g, a.id, ItemId.TRUCE_AGREEMENT, a.cityId);
      await g.runDue(g.now + BALANCE.truceDurationMs);
      const p = await reloadPlayer(g, a);
      expect(p.status).toBe(PlayerStatus.NORMAL);
      expect(p.buffs).toEqual([expect.objectContaining({ id: BuffId.TRUCE_COOLDOWN, endTime: g.now + BALANCE.truceCooldownMs })]);
      await expectRefused(player.startTruce(g, a.id, ItemId.TRUCE_AGREEMENT, a.cityId), msg('player.truce.cooldown'));
      await g.runDue(g.now + BALANCE.truceCooldownMs);
      await player.startTruce(g, a.id, ItemId.TRUCE_AGREEMENT, a.cityId);
      expect((await reloadPlayer(g, a)).items).not.toHaveProperty(ItemId.TRUCE_AGREEMENT);
    }));

  it("refuses another player's city", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await expectRefused(player.startTruce(g, a.id, ItemId.TRUCE_AGREEMENT, b.cityId), msg('common.invalidCastle'));
    }));
});

describe(player.publicPlayerInfo.name, () => {
  it("shows a player's info, cities and relation to the viewer", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      const tileId = (await getCity(g, b.cityId)).tileId;
      const info = await player.publicPlayerInfo(g, a.id, b.name.toLowerCase());
      expect(info).toMatchObject({ id: b.id, userName: b.name, castleCount: 1, relation: Relation.NO_RELATION });
      expect(info.castles).toEqual([{ id: b.cityId, name: `${b.name} City`, fieldId: tileId, ...tileXY(tileId) }]);
      expect((await player.publicPlayerInfo(g, a.id, a.name)).relation).toBe(Relation.SELF);
    }));

  it('rejects an unknown name', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await expectRefused(player.publicPlayerInfo(g, a.id, 'Nobody Here'), msg('common.playerNamedNotFound', { name: 'Nobody Here' }));
    }));
});

describe(player.restartPlayer.name, () => {
  it("wipes the player's cities, heroes, armies, mail and reports, keeping the player row", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const tileId = (await getCity(g, a.cityId)).tileId;
      const heroId = await addHero(g, a);
      const [npc] = await freeTiles(g, TileType.NPC);
      await sendScout(g, a, npc!.id);
      await giveItems(g, a, { [ItemId.CROSS_MEDAL]: 2 });
      await admin.setTechnology(g, a.name, 1, 3);
      await setPrestige(g, a, 5000);
      await admin.setPlayerFlags(g, a.name, { beginner: false, title: 2 });
      await player.addCastleSign(g, a.id, npc!.id);
      await sendSystemMail(g, a.id, 'Hello', 'x');
      await createReport(g, { playerId: a.id, title: msg('report.title.scoutReport'), body: { kind: 'text', text: msg('report.oldFormat') } });
      await g.tx.insert(timedEvents).values({ type: TimedEventType.RESEARCH, dueAt: g.now + HOUR, playerId: a.id, payload: {}, createdAt: g.now });
      // a valley held by the city
      const [valley] = await freeTiles(g, TileType.FOREST);
      await g.tx.update(tiles).set({ ownerCityId: a.cityId, ownerPlayerId: a.id }).where(eq(tiles.id, valley!.id));

      g.advance(HOUR);
      await player.restartPlayer(g, a.id);

      const p = await reloadPlayer(g, a);
      expect(p).toMatchObject({
        prestige: 0,
        honor: 0,
        title: 0,
        research: {},
        items: {},
        buffs: [],
        castleSigns: [],
        beginner: true,
        status: 0,
        population: 0,
      });
      expect(await player.playerState(g, a.id)).toMatchObject({ castles: [], newMailCount: 0, newReportCount: 0, selfArmys: [] });
      expect(await getTile(g, tileId)).toMatchObject({ type: TileType.FLAT, cityId: null, ownerPlayerId: null });
      expect(await getTile(g, valley!.id)).toMatchObject({ ownerCityId: null, ownerPlayerId: null });
      expect(await g.tx.select().from(heroes).where(eq(heroes.id, heroId))).toEqual([]);
      expect(await g.tx.select().from(armyRows).where(eq(armyRows.playerId, a.id))).toEqual([]);
      expect(await g.tx.select().from(mails).where(eq(mails.playerId, a.id))).toEqual([]);
      expect(await g.tx.select().from(reportRows).where(eq(reportRows.playerId, a.id))).toEqual([]);
      expect(await g.tx.select().from(timedEvents).where(eq(timedEvents.playerId, a.id))).toEqual([]);
    }));

  describe("others' armies on their way to, waiting for or stationed in its cities", () => {
    /** Two players at war and a scout of a's headed for b's city (which has no scouts to stop it). */
    async function headedFor(g: TestGame, opts: { arriveAt?: number } = {}) {
      const { p: a, heroId } = await warrior(g);
      const { p: b } = await warrior(g, {});
      const target = (await getCity(g, b.cityId)).tileId;
      const bean = await send(g, a, { targetTileId: target, mission: Mission.SCOUT, troops: { scouter: 1 }, ...opts });
      return { a, b, heroId, armyId: bean.armyId, sent: bean };
    }
    const row = async (g: TestGame, id: number) => (await g.tx.select().from(armyRows).where(eq(armyRows.id, id)))[0];
    const eventOf = (g: TestGame, id: number) => g.events(TimedEventType.ARMY).find((e) => e.refKey === `army:${id}`);

    it('one marching there turns back the way it came, as a recall does', () =>
      game(async (g) => {
        const { a, b, armyId, sent } = await headedFor(g);
        const marched = Math.floor((sent.reachTime - sent.startTime) / 3);
        g.advance(marched);
        await player.restartPlayer(g, b.id);
        expect(await row(g, armyId)).toMatchObject({ direction: ArmyDirection.BACKWARD, startTime: g.now, reachTime: g.now + marched, restTime: 0 });
        expect(eventOf(g, armyId)).toMatchObject({ dueAt: g.now + marched, playerId: a.id, payload: { armyId } });
      }));

    it('one waiting at home to land at a time is back at once, its departure cancelled', () =>
      game(async (g) => {
        const { b, armyId } = await headedFor(g, { arriveAt: g.now + DAY / 2 });
        expect(g.events(TimedEventType.ARMY_DEPART).some((e) => e.refKey === departRef(armyId))).toBe(true);
        await player.restartPlayer(g, b.id);
        expect(await row(g, armyId)).toMatchObject({ direction: ArmyDirection.BACKWARD, startTime: g.now, reachTime: g.now + 1000 });
        expect(g.events(TimedEventType.ARMY_DEPART).some((e) => e.refKey === departRef(armyId))).toBe(false);
      }));

    it('one already heading home carries on as it was', () =>
      game(async (g) => {
        const { b, armyId } = await headedFor(g);
        await arrive(g, armyId);
        const before = await row(g, armyId);
        expect(before?.direction).toBe(ArmyDirection.BACKWARD);
        g.advance(1000);
        await player.restartPlayer(g, b.id);
        expect(await row(g, armyId)).toEqual(before);
        expect(eventOf(g, armyId)?.dueAt).toBe(before?.reachTime);
      }));

    it('one stationed there marches home from the city, its hero returning', () =>
      game(async (g) => {
        const { p: a, heroId } = await warrior(g);
        const { p: b } = await warrior(g);
        await allies(g, a, b);
        await interior.setCityFlags(g, b.id, b.cityId, { allowAlliance: true });
        const host = (await getCity(g, b.cityId)).tileId;
        const bean = await send(g, a, { targetTileId: host, mission: Mission.REINFORCE, troops: { lightCavalry: 100 }, heroId });
        await arrive(g, bean.armyId);
        const stationed = await row(g, bean.armyId);
        expect(stationed?.direction).toBe(ArmyDirection.STAY);
        const home = await cityBundle(g, a);
        const march = marchTimeMs(host, home.city.tileId, { lightCavalry: 100 }, home.player.research, home.city.buildings);
        g.advance(HOUR);
        await player.restartPlayer(g, b.id);
        expect(await row(g, bean.armyId)).toMatchObject({ direction: ArmyDirection.BACKWARD, startTime: g.now, reachTime: g.now + march });
        expect((await getHero(g, heroId)).status).toBe(HeroStatus.RETURN);
      }));
  });

  it('leaves the alliance, disbanding it when the player was its last member', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await alliance.createAlliance(g, a.id, a.cityId, 'Lonely Few');
      const allianceId = (await reloadPlayer(g, a)).allianceId!;
      await player.restartPlayer(g, a.id);
      expect(await g.tx.select().from(alliances).where(eq(alliances.id, allianceId))).toEqual([]);
    }));

  it('the player is no longer in the alliance afterwards', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await alliance.createAlliance(g, a.id, a.cityId, 'Restarters');
      await player.restartPlayer(g, a.id);
      expect(await reloadPlayer(g, a)).toMatchObject({ allianceId: null, allianceRank: 0 });
    }));

  it('restarts the beginner protection clock', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      g.advance(10 * DAY);
      await player.restartPlayer(g, a.id);
      expect((await reloadPlayer(g, a)).createdAt).toBe(g.now);
    }));
});

describe(player.addCastleSign.name, () => {
  it("bookmarks a player's city by name and a barbarian city by its tile type", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      const cityTile = (await getCity(g, b.cityId)).tileId;
      const [npc] = await freeTiles(g, TileType.NPC);
      await player.addCastleSign(g, a.id, cityTile);
      const list = await player.addCastleSign(g, a.id, npc!.id);
      expect(list).toEqual([
        { tileId: cityTile, type: TileType.CASTLE, name: `${b.name} City`, ...tileXY(cityTile) },
        { tileId: npc!.id, type: TileType.NPC, ...tileXY(npc!.id) },
      ]);
      expect((await reloadPlayer(g, a)).castleSigns).toEqual(list);
    }));

  it('bookmarking the same tile again changes nothing', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const [npc] = await freeTiles(g, TileType.NPC);
      await player.addCastleSign(g, a.id, npc!.id);
      expect(await player.addCastleSign(g, a.id, npc!.id)).toHaveLength(1);
    }));

  it('rejects a tile with no city on it, or off the map', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const [flat] = await freeTiles(g, TileType.FLAT);
      const [forest] = await freeTiles(g, TileType.FOREST);
      for (const id of [flat!.id, forest!.id, BALANCE.mapSize * BALANCE.mapSize, -1])
        await expectRefused(player.addCastleSign(g, a.id, id), msg('common.invalidCoordinates'));
    }));

  it('keeps at most 100 bookmarks', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const npcs = await freeTiles(g, TileType.NPC, 101);
      for (const t of npcs.slice(0, 100)) await player.addCastleSign(g, a.id, t.id);
      await expectRefused(player.addCastleSign(g, a.id, npcs[100]!.id), msg('player.bookmark.tooMany', { count: 100 }));
      // one already kept is still fine
      expect(await player.addCastleSign(g, a.id, npcs[0]!.id)).toHaveLength(100);
    }));
});

describe(player.removeCastleSign.name, () => {
  it('removes the bookmark of a tile, ignoring one not kept', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const [n1, n2] = await freeTiles(g, TileType.NPC, 2);
      await player.addCastleSign(g, a.id, n1!.id);
      await player.addCastleSign(g, a.id, n2!.id);
      expect((await player.removeCastleSign(g, a.id, n1!.id)).map((s) => s.tileId)).toEqual([n2!.id]);
      expect((await player.removeCastleSign(g, a.id, 12345)).map((s) => s.tileId)).toEqual([n2!.id]);
      expect((await reloadPlayer(g, a)).castleSigns.map((s) => s.tileId)).toEqual([n2!.id]);
    }));
});

describe(player.armyPresets.name, () => {
  it('lists the saved presets, none at first', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      expect(await player.armyPresets(g, a.id)).toEqual([]);
      const saved = await player.saveArmyPreset(g, a.id, 'Raid', { archer: 100 });
      expect(await player.armyPresets(g, a.id)).toEqual(saved);
    }));
});

describe(player.saveArmyPreset.name, () => {
  it('saves a named composition, dropping zero counts and unknown keys', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const list = await player.saveArmyPreset(g, a.id, '  Raid  ', { archer: 100, militia: 0, scouter: '5', dragons: 3 });
      expect(list).toEqual([{ id: expect.any(String), name: 'Raid', troops: { archer: 100, scouter: 5 } }]);
      const two = await player.saveArmyPreset(g, a.id, 'Scout', { scouter: 1 });
      expect(two.map((x) => x.name)).toEqual(['Raid', 'Scout']);
      expect(new Set(two.map((x) => x.id)).size).toBe(2);
    }));

  it('replaces a preset of the same name, in any case, keeping its id and place', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const [raid] = await player.saveArmyPreset(g, a.id, 'Raid', { archer: 100 });
      await player.saveArmyPreset(g, a.id, 'Scout', { scouter: 1 });
      const list = await player.saveArmyPreset(g, a.id, 'RAID', { pikemen: 50 });
      expect(list).toEqual([{ id: raid!.id, name: 'RAID', troops: { pikemen: 50 } }, expect.objectContaining({ name: 'Scout' })]);
    }));

  it('rejects a bad name, bad counts and an empty army', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await expectRefused(player.saveArmyPreset(g, a.id, '   ', { archer: 1 }), msg('player.preset.nameLength', { count: 30 }));
      await expectRefused(player.saveArmyPreset(g, a.id, 'x'.repeat(31), { archer: 1 }), msg('player.preset.nameLength', { count: 30 }));
      await expectRefused(player.saveArmyPreset(g, a.id, 'Raid', { archer: -1 }), msg('common.invalidTroopCount'));
      await expectRefused(player.saveArmyPreset(g, a.id, 'Raid', { archer: 1.5 }), msg('common.invalidTroopCount'));
      await expectRefused(player.saveArmyPreset(g, a.id, 'Raid', { archer: 'many' }), msg('common.invalidTroopCount'));
      await expectRefused(player.saveArmyPreset(g, a.id, 'Raid', { archer: 0 }), msg('common.noTroopsSelected'));
      await expectRefused(player.saveArmyPreset(g, a.id, 'Raid', {}), msg('common.noTroopsSelected'));
      expect(await player.armyPresets(g, a.id)).toEqual([]);
    }));

  it('keeps at most 30 presets, though one can still be replaced', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      for (let i = 1; i <= 30; i++) await player.saveArmyPreset(g, a.id, `P${i}`, { archer: i });
      await expectRefused(player.saveArmyPreset(g, a.id, 'P31', { archer: 1 }), msg('player.preset.tooMany', { count: 30 }));
      const list = await player.saveArmyPreset(g, a.id, 'p1', { archer: 99 });
      expect(list).toHaveLength(30);
      expect(list[0]).toMatchObject({ name: 'p1', troops: { archer: 99 } });
    }));
});

describe(player.deleteArmyPreset.name, () => {
  it('deletes a preset by id, ignoring an unknown one', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      expect(await player.deleteArmyPreset(g, a.id, 'nope')).toEqual([]);
      const [raid] = await player.saveArmyPreset(g, a.id, 'Raid', { archer: 100 });
      await player.saveArmyPreset(g, a.id, 'Scout', { scouter: 1 });
      expect((await player.deleteArmyPreset(g, a.id, 'nope')).map((x) => x.name)).toEqual(['Raid', 'Scout']);
      expect((await player.deleteArmyPreset(g, a.id, raid!.id)).map((x) => x.name)).toEqual(['Scout']);
      expect((await player.armyPresets(g, a.id)).map((x) => x.name)).toEqual(['Scout']);
    }));
});
