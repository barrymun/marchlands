// Player lifecycle: creation (common.createNewPlayer), the login bean, profile changes,
// titles, holiday (furlough), truce and restart.

import { and, count, eq, inArray, ne, sql } from 'drizzle-orm';
import {
  BALANCE,
  BuildingStatus,
  DAY,
  GameError,
  TileType,
  TITLES,
  titleOf,
  tileXY,
  type BuildingState,
} from '@evony/core';
import { armies, cities, heroes, mails, marketOrders, pgArray, players, reports, tiles } from '@evony/db';
import { viewCity } from '../city.ts';
import type { Ctx } from '../context.ts';
import { buffsArray, cityBean, itemsArray } from '../dto.ts';
import {
  activeBuff,
  assertClean,
  cleanName,
  consumeItem,
  itemCount,
  playerInfoOf,
  pushPlayerInfo,
  removeBuff,
  setBuff,
  spendCents,
} from '../helpers.ts';
import { citiesOf, findPlayerByName, getCity, getPlayer, savePlayer, type PlayerRow } from '../repo.ts';
import { pickOpenFlat } from './world.ts';
import { relationBetween } from './relations.ts';
import { leaveAlliance } from './alliance.ts';
import { visibleArmies } from './armies.ts';

export interface CreatePlayerInput {
  userName: string;
  castleName: string;
  flag: string;
  faceUrl: string;
  sex: number;
  zone: number;
}

/** Starting city: Town Hall level 1, 100k of every resource (orig createNewPlayer). */
export function initialCity(playerId: number, tileId: number, name: string, now: number) {
  const buildings: BuildingState[] = [{ positionId: -1, typeId: 31, level: 1, status: BuildingStatus.IDLE, startTime: 0, endTime: 0 }];
  const r = BALANCE.startingResources;
  return {
    playerId,
    tileId,
    name,
    gold: r,
    food: r,
    wood: r,
    stone: r,
    iron: r,
    resourcesAt: now,
    population: BALANCE.startPopulation,
    loyalty: BALANCE.startLoyalty,
    taxRate: BALANCE.startTaxRate,
    buildings,
    misc: { lastTickAt: now },
    createdAt: now,
  };
}

export async function createPlayer(ctx: Ctx, accountId: number, input: CreatePlayerInput): Promise<PlayerRow> {
  const [existing] = await ctx.tx.select({ id: players.id }).from(players).where(eq(players.accountId, accountId));
  if (existing) {
    const [{ n }] = await ctx.tx.select({ n: count() }).from(cities).where(eq(cities.playerId, existing.id));
    if (Number(n) > 0) throw new GameError('City/Account exists.', -86, 409);
  }
  const name = cleanName(input.userName, 1, 20, 'Lord name');
  const castleName = cleanName(input.castleName, 1, 20, 'City name');
  assertClean(name);
  assertClean(castleName);
  const flag = String(input.flag ?? '').trim();
  if (flag.length < 1 || flag.length > 5) throw new GameError('Invalid data sent.', -87);
  if (![0, 1].includes(input.sex)) throw new GameError('Invalid data sent.', -87);
  const faceUrl = String(input.faceUrl ?? '').slice(0, 100);
  if (!Number.isInteger(input.zone) || input.zone < -1 || input.zone > 15) throw new GameError('Invalid data sent.', -87);
  const taken = await findPlayerByName(ctx, name);
  if (taken && taken.id !== existing?.id) throw new GameError('Player name taken', -88, 409);

  const tileId = await pickOpenFlat(ctx, input.zone);
  let player: PlayerRow;
  if (existing) {
    player = await getPlayer(ctx, existing.id, { lock: true });
    Object.assign(player, { name, flag, faceUrl, sex: input.sex, beginner: true, status: 0 });
    await savePlayer(ctx, player);
  } else {
    [player] = await ctx.tx
      .insert(players)
      .values({
        accountId,
        name,
        flag,
        faceUrl,
        sex: input.sex,
        cents: BALANCE.startingCents,
        items: { 'player.box.present.2': 1, 'consume.1.a': 10 },
        createdAt: ctx.now,
        lastLoginAt: ctx.now,
      })
      .returning();
  }
  const [city] = await ctx.tx.insert(cities).values(initialCity(player.id, tileId, castleName, ctx.now)).returning();
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
    const b = await viewCity(ctx, c.id, player);
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
  const furlough = activeBuff(player, 'FurloughBuff', ctx.now);
  return {
    playerInfo: await playerInfoOf(ctx, player),
    castles,
    items: itemsArray(player.items),
    buffs: buffsArray(player.buffs, ctx.now),
    research: player.research,
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
  if (p.misc.changedFace) throw new GameError('Invalid setting.', -99);
  if (!faceUrl || faceUrl.length > 100 || ![0, 1].includes(sex)) throw new GameError('Invalid setting.', -99);
  p.faceUrl = faceUrl;
  p.sex = sex;
  p.misc = { ...p.misc, changedFace: true };
  await savePlayer(ctx, p);
  await pushPlayerInfo(ctx, p);
}

/** city.modifyFlag: consumes a National Flag. */
export async function changeFlag(ctx: Ctx, playerId: number, flag: string) {
  const p = await getPlayer(ctx, playerId, { lock: true });
  const f = String(flag ?? '').trim();
  if (f.length < 1 || f.length > 5) throw new GameError('Invalid flag.', -87);
  if (itemCount(p, 'consume.changeflag.1') <= 0) throw new GameError('Not enough item.', -99);
  consumeItem(ctx, p, 'consume.changeflag.1');
  p.flag = f;
  await savePlayer(ctx, p);
  await pushPlayerInfo(ctx, p);
}

/** city.modifyUserName: consumes a New ID. */
export async function renamePlayer(ctx: Ctx, playerId: number, userName: string) {
  const p = await getPlayer(ctx, playerId, { lock: true });
  const name = cleanName(userName, 1, 20, 'Lord name');
  assertClean(name);
  if (itemCount(p, 'player.name.1.a') <= 0) throw new GameError('Not enough item.', -99);
  const taken = await findPlayerByName(ctx, name);
  if (taken && taken.id !== p.id) throw new GameError('Player name taken', -88, 409);
  consumeItem(ctx, p, 'player.name.1.a');
  p.name = name;
  await savePlayer(ctx, p);
  await pushPlayerInfo(ctx, p);
}

/** Promote to the next nobility title (prestige + medals). */
export async function promoteTitle(ctx: Ctx, playerId: number) {
  const p = await getPlayer(ctx, playerId, { lock: true });
  const next = TITLES[p.title + 1];
  if (!next) throw new GameError('You already hold the highest title.', -99);
  if (p.prestige < next.prestige) throw new GameError(`${next.prestige} prestige is required.`, -99);
  for (const [id, n] of Object.entries(next.medals)) if (itemCount(p, id) < n) throw new GameError('Not enough medals.', -99);
  for (const [id, n] of Object.entries(next.medals)) consumeItem(ctx, p, id, n);
  p.title = next.id;
  await savePlayer(ctx, p);
  await pushPlayerInfo(ctx, p);
  return { titleId: p.title, titleName: titleOf(p.title).name };
}

export async function saveTutorialStep(ctx: Ctx, playerId: number, step: number) {
  const p = await getPlayer(ctx, playerId, { lock: true });
  p.misc = { ...p.misc, tutorialStep: step };
  await savePlayer(ctx, p);
}

// ---------------------------------------------------------------------------------------------
// Protection
// ---------------------------------------------------------------------------------------------

/** furlough.isFurlought: holiday mode, 10 cents per day, max 30 days. */
export async function startFurlough(ctx: Ctx, playerId: number, days: number) {
  if (!Number.isInteger(days) || days < 1 || days > 30) throw new GameError('Invalid number of days.', -99);
  const p = await getPlayer(ctx, playerId, { lock: true });
  const outgoing = await ctx.tx.select({ n: count() }).from(armies).where(eq(armies.playerId, playerId));
  if (Number(outgoing[0].n) > 0) throw new GameError('You must recall all of your troops first.', -77);
  spendCents(ctx, p, days * 10);
  setBuff(ctx, p, 'FurloughBuff', 'Holiday', ctx.now + days * DAY);
  p.status = 5;
  await savePlayer(ctx, p);
  await pushPlayerInfo(ctx, p);
}

export async function cancelFurlough(ctx: Ctx, playerId: number) {
  const p = await getPlayer(ctx, playerId, { lock: true });
  removeBuff(ctx, p, 'FurloughBuff');
  if (p.status === 5) p.status = 0;
  await savePlayer(ctx, p);
  await pushPlayerInfo(ctx, p);
}

/** city.setStopWarState: Truce Agreement (12h) with a 12h cooldown afterwards. */
export async function startTruce(ctx: Ctx, playerId: number, itemId = 'player.peace.1') {
  const p = await getPlayer(ctx, playerId, { lock: true });
  if (activeBuff(p, 'PlayerPeaceCoolDownBuff', ctx.now)) throw new GameError('Truce Agreement is in cooldown.', -99);
  if (!['player.peace.1', 'player.truce.dream'].includes(itemId)) throw new GameError('Invalid state.', -99);
  if (itemCount(p, itemId) > 0) consumeItem(ctx, p, itemId);
  else spendCents(ctx, p, 30);
  setBuff(ctx, p, 'PlayerPeaceBuff', 'Truce Agreement activated', ctx.now + BALANCE.truceDurationMs);
  p.status = 2;
  await savePlayer(ctx, p);
  await pushPlayerInfo(ctx, p);
}

export function isProtected(p: PlayerRow, now: number): string | null {
  if (p.beginner) return "Operation denied. This player is under Beginner's Protection.";
  if (activeBuff(p, 'PlayerPeaceBuff', now)) return 'Operation denied. This player is under truce.';
  if (activeBuff(p, 'FurloughBuff', now)) return 'Operation denied. This player is on holiday.';
  return null;
}

/** Beginner protection ends after 7 days or Town Hall level 5 (orig CheckBeginner). */
export async function checkBeginner(ctx: Ctx, p: PlayerRow, townHallLevel?: number) {
  if (!p.beginner) return;
  const expired = ctx.now - p.createdAt > BALANCE.beginnerProtectionMs;
  if (expired || (townHallLevel ?? 0) >= BALANCE.beginnerTownHallLevel) {
    p.beginner = false;
    if (p.status === 3) p.status = 0;
    await ctx.tx.insert(mails).values({
      playerId: p.id,
      type: 2,
      title: "Beginner's Protection Expired",
      content:
        "Your Beginner's Protection has expired. Your cities can now be attacked by other lords, and you may attack them. Build your defences and consider joining an alliance.",
      sentAt: ctx.now,
    });
    ctx.push(p.id, 'server.NewMail', { count_system: 1 });
    await pushPlayerInfo(ctx, p);
  }
}

// ---------------------------------------------------------------------------------------------
// Public info
// ---------------------------------------------------------------------------------------------

export async function publicPlayerInfo(ctx: Ctx, viewerId: number, name: string) {
  const p = await findPlayerByName(ctx, name);
  if (!p) throw new GameError(`Player ${name} doesn't exist.`, -41, 404);
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
  const p = await getPlayer(ctx, playerId, { lock: true });
  const cityRows = await citiesOf(ctx, playerId, { lock: true });
  const cityIds = cityRows.map((c) => c.id);
  // armies of others stationed in my cities go home
  if (cityIds.length) {
    const tileIds = cityRows.map((c) => c.tileId);
    const guests = await ctx.tx.select().from(armies).where(and(inArray(armies.targetTileId, tileIds), ne(armies.playerId, playerId)));
    for (const g of guests) {
      const back = Math.max(1000, g.reachTime - g.startTime);
      await ctx.tx.update(armies).set({ direction: 2, startTime: ctx.now, reachTime: ctx.now + back, restTime: 0 }).where(eq(armies.id, g.id));
      ctx.schedule({ type: 'army', dueAt: ctx.now + back, playerId: g.playerId, refKey: `army:${g.id}`, payload: { armyId: g.id } });
    }
  }
  await ctx.tx.execute(sql`delete from timed_events where player_id = ${playerId} or city_id = any(${pgArray(cityIds)}::int[])`);
  await ctx.tx.delete(armies).where(eq(armies.playerId, playerId));
  await ctx.tx.delete(marketOrders).where(eq(marketOrders.playerId, playerId));
  if (cityIds.length) {
    await ctx.tx.update(tiles).set({ ownerCityId: null, ownerPlayerId: null, updatedAt: ctx.now }).where(inArray(tiles.ownerCityId, cityIds));
    await ctx.tx.update(tiles).set({ cityId: null, ownerPlayerId: null, type: TileType.FLAT, updatedAt: ctx.now }).where(inArray(tiles.cityId, cityIds));
    await ctx.tx.delete(heroes).where(inArray(heroes.cityId, cityIds));
    await ctx.tx.delete(cities).where(inArray(cities.id, cityIds));
  }
  await ctx.tx.delete(mails).where(eq(mails.playerId, playerId));
  await ctx.tx.delete(reports).where(eq(reports.playerId, playerId));
  if (p.allianceId) {
    // leaving the alliance is handled by the alliance service rules: a host must hand over first
    await leaveAlliance(ctx, playerId, { force: true });
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
    createdAt: ctx.now,
  });
  await savePlayer(ctx, p);
}

/** Bookmark a castle on the map (castle.saveCastleSignList). */
export async function addCastleSign(ctx: Ctx, playerId: number, tileId: number) {
  const p = await getPlayer(ctx, playerId, { lock: true });
  const [t] = await ctx.tx.select().from(tiles).where(eq(tiles.id, tileId));
  if (!t || (t.cityId == null && t.type !== TileType.NPC)) throw new GameError('Invalid coordinates', -99);
  const name = t.cityId != null ? (await getCity(ctx, t.cityId)).name : "Barbarian's City";
  if (p.castleSigns.some((s) => s.tileId === tileId)) return p.castleSigns;
  if (p.castleSigns.length >= 100) throw new GameError('Too many bookmarks.', -99);
  p.castleSigns = [...p.castleSigns, { tileId, name, ...tileXY(tileId) }];
  await savePlayer(ctx, p);
  return p.castleSigns;
}

export async function removeCastleSign(ctx: Ctx, playerId: number, tileId: number) {
  const p = await getPlayer(ctx, playerId, { lock: true });
  p.castleSigns = p.castleSigns.filter((s) => s.tileId !== tileId);
  await savePlayer(ctx, p);
  return p.castleSigns;
}

