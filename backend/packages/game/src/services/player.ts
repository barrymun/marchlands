// Player lifecycle: creation (common.createNewPlayer), the login bean, profile changes,
// titles, holiday (furlough), truce and restart.

import { and, count, eq, inArray, ne, sql } from 'drizzle-orm';

import { type CreatePlayerBody } from '@marchlands/contracts';
import {
  BALANCE,
  BuffId,
  type CastleSign,
  DAY,
  GameError,
  goldForCents,
  HOUR,
  itemGoldPrice,
  ItemId,
  lordGear,
  msg,
  TileType,
  tileXY,
  TITLES,
  TROOP_KEY_LIST,
  type TroopCounts,
} from '@marchlands/core';
import { armies, cities, heroes, mails, marketOrders, one, pgArray, players, reports, tiles } from '@marchlands/db';

import { openOwnCity, viewOwnCity } from '#/city.ts';
import { type Ctx } from '#/context.ts';
import { buffsArray, cityBean, itemsArray } from '#/dto.ts';
import { initialCity } from '#/engine/player.ts';
import { relationBetween } from '#/engine/relations.ts';
import { pickOpenFlat } from '#/engine/world.ts';
import {
  activeBuff,
  assertClean,
  cleanName,
  consumeItem,
  itemCount,
  playerInfoOf,
  pushPlayerInfo,
  pushResources,
  removeBuff,
  setBuff,
  spendGold,
  useItemOrGold,
} from '#/helpers.ts';
import { citiesOf, findPlayerByName, getCity, getPlayer, type PlayerRow, saveCity, savePlayer } from '#/repo.ts';
import { leaveAlliance } from '#/services/alliance.ts';
import { visibleArmies } from '#/services/armies.ts';

export async function createPlayer(ctx: Ctx, accountId: number, input: CreatePlayerBody): Promise<PlayerRow> {
  const [existing] = await ctx.tx.select({ id: players.id }).from(players).where(eq(players.accountId, accountId));
  if (existing) {
    const { n } = one(await ctx.tx.select({ n: count() }).from(cities).where(eq(cities.playerId, existing.id)));
    if (Number(n) > 0) throw new GameError(msg('player.accountExists'), -86, 409);
  }
  const name = cleanName(input.userName, 1, 20, msg('common.playerName'));
  const castleName = cleanName(input.castleName, 1, 20, msg('common.cityName'));
  assertClean(name);
  assertClean(castleName);
  const flag = input.flag.trim();
  if (flag.length < 1 || flag.length > 5) throw new GameError(msg('common.invalidData'), -87);
  if (![0, 1].includes(input.sex)) throw new GameError(msg('common.invalidData'), -87);
  const faceUrl = input.faceUrl.slice(0, 100);
  if (!Number.isInteger(input.zone) || input.zone < -1 || input.zone > 15) throw new GameError(msg('common.invalidData'), -87);
  const taken = await findPlayerByName(ctx, name);
  if (taken && taken.id !== existing?.id) throw new GameError(msg('player.nameTaken'), -88, 409);

  const tileId = await pickOpenFlat(ctx, input.zone);
  let player: PlayerRow;
  if (existing) {
    player = await getPlayer(ctx, existing.id, { lock: true });
    Object.assign(player, { name, flag, faceUrl, sex: input.sex, beginner: true, status: 0 });
    await savePlayer(ctx, player);
  } else {
    player = one(
      await ctx.tx
        .insert(players)
        .values({
          accountId,
          name,
          flag,
          faceUrl,
          sex: input.sex,
          items: { [ItemId.WELCOME_PACKAGE]: 1 },
          createdAt: ctx.now,
          lastLoginAt: ctx.now,
        })
        .returning(),
    );
  }
  const city = one(
    await ctx.tx
      .insert(cities)
      .values(initialCity(player.id, tileId, castleName, ctx.now))
      .returning(),
  );
  await ctx.tx
    .update(tiles)
    .set({ cityId: city.id, type: TileType.CASTLE, ownerPlayerId: player.id, ownerCityId: null, troops: null, forts: null, state: null, updatedAt: ctx.now })
    .where(eq(tiles.id, tileId));
  return player;
}

/** Everything a client needs after login (orig PlayerBean / server.LoginResponse). */
export async function playerState(ctx: Ctx, playerId: number) {
  const player = await getPlayer(ctx, playerId);
  const cityRows = await citiesOf(ctx, playerId);
  const castles = [];
  for (const c of cityRows) {
    const b = await viewOwnCity(ctx, playerId, c.id, player);
    castles.push(cityBean(b, ctx.now));
  }
  const unread = await ctx.tx
    .select({ type: mails.type, n: count() })
    .from(mails)
    .where(and(eq(mails.playerId, playerId), eq(mails.readAt, 0)))
    .groupBy(mails.type);
  const unreadReports = await ctx.tx
    .select({ type: reports.typeId, n: count() })
    .from(reports)
    .where(and(eq(reports.playerId, playerId), eq(reports.isRead, false)))
    .groupBy(reports.typeId);
  const mailCount = (t: number) => Number(unread.find((u) => u.type === t)?.n ?? 0);
  const reportCount = (t: number) => Number(unreadReports.find((u) => u.type === t)?.n ?? 0);
  const armiesView = await visibleArmies(ctx, playerId);
  const furlough = activeBuff(player, BuffId.HOLIDAY, ctx.now);
  return {
    playerInfo: await playerInfoOf(ctx, player),
    castles,
    items: itemsArray(player.items),
    buffs: buffsArray(player.buffs, ctx.now),
    research: player.research,
    gear: lordGear(player),
    refundCredit: player.misc.refundCredit ?? {},
    selfArmys: armiesView.self,
    friendArmys: armiesView.friend,
    enemyArmys: armiesView.enemy,
    castleSignBean: player.castleSigns,
    newMailCount: unread.reduce((s, u) => s + Number(u.n), 0),
    newMaileCount_inbox: mailCount(1),
    newMaileCount_system: mailCount(2),
    newReportCount: unreadReports.reduce((s, u) => s + Number(u.n), 0),
    newReportCount_army: reportCount(1),
    newReportCount_trade: reportCount(0),
    newReportCount_other: reportCount(2),
    furlough: !!furlough,
    furloughEndTime: furlough?.endTime ?? 0,
    mapSizeX: BALANCE.mapSize,
    mapSizeY: BALANCE.mapSize,
    gameSpeed: Number(process.env.GAME_SPEED ?? 1),
    currentTime: ctx.now,
    tutorialStepId: player.misc.tutorialStep ?? 0,
    nextRenameAt: nextRenameAt(player, ctx.now),
    nextGenderChangeAt: nextGenderChangeAt(player, ctx.now),
  };
}

export async function touchLogin(ctx: Ctx, playerId: number) {
  await ctx.tx.update(players).set({ lastLoginAt: ctx.now, lastSeenAt: ctx.now }).where(eq(players.id, playerId));
}

// ---------------------------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------------------------

/** common.changeUserFace: only once per lord. */
export async function changeFace(ctx: Ctx, playerId: number, faceUrl: string, sex: number) {
  const p = await getPlayer(ctx, playerId, { lock: true });
  if (p.misc.changedFace) throw new GameError(msg('player.invalidSetting'), -99);
  if (!faceUrl || faceUrl.length > 100 || ![0, 1].includes(sex)) throw new GameError(msg('player.invalidSetting'), -99);
  p.faceUrl = faceUrl;
  p.sex = sex;
  p.misc = { ...p.misc, changedFace: true };
  await savePlayer(ctx, p);
  await pushPlayerInfo(ctx, p);
}

/** city.modifyFlag; (marchlands) free (orig: a National Flag each time). */
export async function changeFlag(ctx: Ctx, playerId: number, flag: string) {
  const p = await getPlayer(ctx, playerId, { lock: true });
  const f = flag.trim();
  if (f.length < 1 || f.length > 5) throw new GameError(msg('player.invalidFlag'), -87);
  p.flag = f;
  await savePlayer(ctx, p);
  await pushPlayerInfo(ctx, p);
}

/** When a lord may rename again: free, once per BALANCE.renameCooldownMs of real time (0: now). */
function nextRenameAt(p: PlayerRow, now: number): number {
  const at = (p.misc.renamedAt ?? 0) + BALANCE.renameCooldownMs;
  return at > now ? at : 0;
}

/** city.modifyUserName; (marchlands) free once a day (orig: a New ID each time). */
export async function renamePlayer(ctx: Ctx, playerId: number, userName: string) {
  const p = await getPlayer(ctx, playerId, { lock: true });
  const name = cleanName(userName, 1, 20, msg('common.playerName'));
  assertClean(name);
  if (name === p.name) throw new GameError(msg('player.sameName'), -99);
  const wait = nextRenameAt(p, ctx.now);
  if (wait) throw new GameError(msg('player.renameCooldown', { count: Math.ceil((wait - ctx.now) / HOUR) }), -99);
  const taken = await findPlayerByName(ctx, name);
  if (taken && taken.id !== p.id) throw new GameError(msg('player.nameTaken'), -88, 409);
  p.name = name;
  p.misc = { ...p.misc, renamedAt: ctx.now };
  await savePlayer(ctx, p);
  await pushPlayerInfo(ctx, p);
}

function nextGenderChangeAt(p: PlayerRow, now: number): number {
  const at = (p.misc.genderChangedAt ?? 0) + BALANCE.genderCooldownMs;
  return at > now ? at : 0;
}

/** (marchlands) Change gender in Player settings: free, once per BALANCE.genderCooldownMs. */
export async function changeGender(ctx: Ctx, playerId: number, sex: number) {
  const p = await getPlayer(ctx, playerId, { lock: true });
  if (![0, 1].includes(sex)) throw new GameError(msg('player.invalidSetting'), -99);
  if (sex === p.sex) throw new GameError(msg('player.sameGender'), -99);
  const wait = nextGenderChangeAt(p, ctx.now);
  if (wait) throw new GameError(msg('player.genderCooldown', { count: Math.ceil((wait - ctx.now) / HOUR) }), -99);
  p.sex = sex;
  p.misc = { ...p.misc, genderChangedAt: ctx.now };
  await savePlayer(ctx, p);
  await pushPlayerInfo(ctx, p);
}

/** Promote to the next nobility title (prestige + medals). */
export async function promoteTitle(ctx: Ctx, playerId: number) {
  const p = await getPlayer(ctx, playerId, { lock: true });
  const next = TITLES[p.title + 1];
  if (!next) throw new GameError(msg('player.title.highest'), -99);
  if (p.prestige < next.prestige) throw new GameError(msg('player.title.prestigeRequired', { prestige: next.prestige }), -99);
  for (const [id, n] of Object.entries(next.medals)) if (itemCount(p, id) < n) throw new GameError(msg('player.title.notEnoughMedals'), -99);
  for (const [id, n] of Object.entries(next.medals)) consumeItem(ctx, p, id, n);
  p.title = next.id;
  await savePlayer(ctx, p);
  await pushPlayerInfo(ctx, p);
  return { titleId: p.title };
}

export async function saveTutorialStep(ctx: Ctx, playerId: number, step: number) {
  const p = await getPlayer(ctx, playerId, { lock: true });
  p.misc = { ...p.misc, tutorialStep: step };
  await savePlayer(ctx, p);
}

// ---------------------------------------------------------------------------------------------
// Protection
// ---------------------------------------------------------------------------------------------

const MAX_HOLIDAY_DAYS = 30;

/** furlough.isFurlought: holiday mode, max 30 days, paid per day with a city's gold (orig: 10 cents a day). */
export async function startFurlough(ctx: Ctx, playerId: number, days: number, cityId: number) {
  if (!Number.isInteger(days) || days < 1 || days > MAX_HOLIDAY_DAYS) throw new GameError(msg('player.holiday.invalidDays', { max: MAX_HOLIDAY_DAYS }), -99);
  const b = await openOwnCity(ctx, playerId, cityId);
  const p = b.player;
  const { n: outgoing } = one(await ctx.tx.select({ n: count() }).from(armies).where(eq(armies.playerId, playerId)));
  if (Number(outgoing) > 0) throw new GameError(msg('player.holiday.troopsOut'), -77);
  spendGold(b.city, days * goldForCents(BALANCE.furloughCentsPerDay));
  ctx.stat(playerId, cityId, { 'spent.other.gold': days * goldForCents(BALANCE.furloughCentsPerDay) });
  setBuff(ctx, p, BuffId.HOLIDAY, msg('buff.holiday'), ctx.now + days * DAY);
  p.status = 5;
  pushResources(ctx, b);
  await saveCity(ctx, b.city);
  await savePlayer(ctx, p);
  await pushPlayerInfo(ctx, p);
}

export async function cancelFurlough(ctx: Ctx, playerId: number) {
  const p = await getPlayer(ctx, playerId, { lock: true });
  removeBuff(ctx, p, BuffId.HOLIDAY);
  if (p.status === 5) p.status = 0;
  await savePlayer(ctx, p);
  await pushPlayerInfo(ctx, p);
}

/** city.setStopWarState: Truce Agreement (12h) with a 12h cooldown afterwards. */
export async function startTruce(ctx: Ctx, playerId: number, itemId: string, cityId: number) {
  // without a Truce Agreement, one is bought with the city's gold
  const b = await openOwnCity(ctx, playerId, cityId);
  const p = b.player;
  if (activeBuff(p, BuffId.TRUCE_COOLDOWN, ctx.now)) throw new GameError(msg('player.truce.cooldown'), -99);
  if (itemId !== ItemId.TRUCE_AGREEMENT) throw new GameError(msg('common.invalidData'), -99);
  useItemOrGold(ctx, p, b.city, itemId, itemGoldPrice(itemId) ?? 0);
  pushResources(ctx, b);
  await saveCity(ctx, b.city);
  setBuff(ctx, p, BuffId.TRUCE, msg('buff.truce'), ctx.now + BALANCE.truceDurationMs, { itemId });
  p.status = 2;
  await savePlayer(ctx, p);
  await pushPlayerInfo(ctx, p);
}

// ---------------------------------------------------------------------------------------------
// Public info
// ---------------------------------------------------------------------------------------------

export async function publicPlayerInfo(ctx: Ctx, viewerId: number, name: string) {
  const p = await findPlayerByName(ctx, name);
  if (!p) throw new GameError(msg('common.playerNamedNotFound', { name }), -41, 404);
  const cityRows = await citiesOf(ctx, p.id);
  const info = await playerInfoOf(ctx, p);
  return {
    ...info,
    relation: await relationBetween(ctx, viewerId, p.id),
    castles: cityRows.map((c) => ({ id: c.id, name: c.name, fieldId: c.tileId, ...tileXY(c.tileId) })),
  };
}

// ---------------------------------------------------------------------------------------------
// Restart (common.deleteUserAndRestart)
// ---------------------------------------------------------------------------------------------

/**
 * Wipe the lord's cities, heroes, armies, orders and messages but keep the player row so the
 * account can create a new lord in the same slot.
 */
export async function restartPlayer(ctx: Ctx, playerId: number) {
  let p = await getPlayer(ctx, playerId, { lock: true });
  const cityRows = await citiesOf(ctx, playerId, { lock: true });
  const cityIds = cityRows.map((c) => c.id);
  // armies of others stationed in my cities go home
  if (cityIds.length) {
    const tileIds = cityRows.map((c) => c.tileId);
    const guests = await ctx.tx
      .select()
      .from(armies)
      .where(and(inArray(armies.targetTileId, tileIds), ne(armies.playerId, playerId)));
    for (const g of guests) {
      // an army still waiting at home to land at a time hasn't left it
      const back = g.startTime > ctx.now ? 1000 : Math.max(1000, g.reachTime - g.startTime);
      await ctx.tx
        .update(armies)
        .set({ direction: 2, startTime: ctx.now, reachTime: ctx.now + back, restTime: 0 })
        .where(eq(armies.id, g.id));
      ctx.schedule({ type: 'army', dueAt: ctx.now + back, playerId: g.playerId, refKey: `army:${g.id}`, payload: { armyId: g.id } });
    }
  }
  await ctx.tx.execute(sql`delete from timed_events where player_id = ${playerId} or city_id = any(${pgArray(cityIds)}::int[])`);
  await ctx.tx.delete(armies).where(eq(armies.playerId, playerId));
  await ctx.tx.delete(marketOrders).where(eq(marketOrders.playerId, playerId));
  if (cityIds.length) {
    await ctx.tx.update(tiles).set({ ownerCityId: null, ownerPlayerId: null, updatedAt: ctx.now }).where(inArray(tiles.ownerCityId, cityIds));
    // (marchlands) a captured historic city stands again as one, whole, for the next to take
    for (const c of cityRows.filter((r) => r.historicLevel != null))
      await ctx.tx
        .update(tiles)
        .set({
          cityId: null,
          ownerPlayerId: null,
          type: TileType.HISTORIC,
          level: c.historicLevel ?? 12,
          troops: null,
          forts: null,
          state: null,
          updatedAt: ctx.now,
        })
        .where(eq(tiles.id, c.tileId));
    await ctx.tx.update(tiles).set({ cityId: null, ownerPlayerId: null, type: TileType.FLAT, updatedAt: ctx.now }).where(inArray(tiles.cityId, cityIds));
    await ctx.tx.delete(heroes).where(inArray(heroes.cityId, cityIds));
    await ctx.tx.delete(cities).where(inArray(cities.id, cityIds));
  }
  await ctx.tx.delete(mails).where(eq(mails.playerId, playerId));
  await ctx.tx.delete(reports).where(eq(reports.playerId, playerId));
  if (p.allianceId) {
    // leaving the alliance is handled by the alliance service rules: a host must hand over first
    await leaveAlliance(ctx, playerId, { force: true });
    // leaving saved the player: carry on from that copy, or the old alliance would be written back
    p = await getPlayer(ctx, playerId, { lock: true });
  }
  Object.assign(p, {
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
  await savePlayer(ctx, p);
  // savePlayer never writes createdAt; a restart starts the account (and its beginner protection) again
  await ctx.tx.update(players).set({ createdAt: ctx.now }).where(eq(players.id, playerId));
}

const MAX_BOOKMARKS = 100;

/** Bookmark a castle on the map (castle.saveCastleSignList). */
export async function addCastleSign(ctx: Ctx, playerId: number, tileId: number) {
  const p = await getPlayer(ctx, playerId, { lock: true });
  const [t] = await ctx.tx.select().from(tiles).where(eq(tiles.id, tileId));
  if (!t || (t.cityId == null && t.type !== TileType.NPC)) throw new GameError(msg('common.invalidCoordinates'), -99);
  if (p.castleSigns.some((s) => s.tileId === tileId)) return p.castleSigns;
  if (p.castleSigns.length >= MAX_BOOKMARKS) throw new GameError(msg('player.bookmark.tooMany', { count: MAX_BOOKMARKS }), -99);
  // a lord's city by its name; a barbarian city by its tile type only (the client names it)
  const sign: CastleSign =
    t.cityId != null
      ? { tileId, type: TileType.CASTLE, name: (await getCity(ctx, t.cityId)).name, ...tileXY(tileId) }
      : { tileId, type: t.type, ...tileXY(tileId) };
  p.castleSigns = [...p.castleSigns, sign];
  await savePlayer(ctx, p);
  return p.castleSigns;
}

export async function removeCastleSign(ctx: Ctx, playerId: number, tileId: number) {
  const p = await getPlayer(ctx, playerId, { lock: true });
  p.castleSigns = p.castleSigns.filter((s) => s.tileId !== tileId);
  await savePlayer(ctx, p);
  return p.castleSigns;
}

// ---------------------------------------------------------------------------------------------
// Army presets (marchlands): named army compositions for the send-army dialog
// ---------------------------------------------------------------------------------------------

const MAX_PRESETS = 30;
const MAX_PRESET_NAME = 30;

export async function armyPresets(ctx: Ctx, playerId: number) {
  const p = await getPlayer(ctx, playerId);
  return p.misc.armyPresets ?? [];
}

/** Save a preset; a preset with the same name (any case) is replaced. */
export async function saveArmyPreset(ctx: Ctx, playerId: number, name: string, troopsIn: Record<string, unknown>) {
  const clean = name.trim();
  if (!clean || clean.length > MAX_PRESET_NAME) throw new GameError(msg('player.preset.nameLength', { count: MAX_PRESET_NAME }), -99);
  const troops: TroopCounts = {};
  for (const k of TROOP_KEY_LIST) {
    const n = Number(troopsIn[k] ?? 0);
    if (!Number.isInteger(n) || n < 0) throw new GameError(msg('common.invalidTroopCount'), -99);
    if (n > 0) troops[k] = n;
  }
  if (!Object.keys(troops).length) throw new GameError(msg('common.noTroopsSelected'), -99);
  const p = await getPlayer(ctx, playerId, { lock: true });
  const list = p.misc.armyPresets ?? [];
  const existing = list.find((x) => x.name.toLowerCase() === clean.toLowerCase());
  if (!existing && list.length >= MAX_PRESETS) throw new GameError(msg('player.preset.tooMany', { count: MAX_PRESETS }), -99);
  const preset = { id: existing?.id ?? `${ctx.now.toString(36)}${Math.floor(ctx.rng.next() * 1e6).toString(36)}`, name: clean, troops };
  const armyPresets = existing ? list.map((x) => (x.id === existing.id ? preset : x)) : [...list, preset];
  p.misc = { ...p.misc, armyPresets };
  await savePlayer(ctx, p);
  return armyPresets;
}

export async function deleteArmyPreset(ctx: Ctx, playerId: number, id: string) {
  const p = await getPlayer(ctx, playerId, { lock: true });
  const armyPresets = (p.misc.armyPresets ?? []).filter((x) => x.id !== id);
  p.misc = { ...p.misc, armyPresets };
  await savePlayer(ctx, p);
  return armyPresets;
}
