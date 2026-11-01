// World bootstrap (map seeding) and world-level queries (zones, map tiles, field info).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm';

import {
  BALANCE,
  GameError,
  generateMap,
  historicCities,
  MAP_VIEW_MAX,
  mapLevelDigit,
  msg,
  Relation,
  relationPermissions,
  stateOf,
  TileType,
  tileXY,
  VALLEY_TYPES,
  valleyUpgradeCost,
} from '@marchlands/core';
import { cities, type Db, pgArray, players, tiles, worldState } from '@marchlands/db';

import { type Ctx } from '#/context.ts';
import { relationBetween } from '#/engine/relations.ts';
import { refreshZoneStats, type ZoneStats } from '#/engine/world.ts';

export interface WorldInfo {
  mapSize: number;
  source: 'generated' | 'legacy';
  seed: string;
  createdAt: number;
}

const WORLD_KEY = 'world';
const SEED_LOCK = 0x45564f4e; // "EVON"

export async function getWorldInfo(db: Db | Ctx['tx']): Promise<WorldInfo | undefined> {
  const [row] = await db.select().from(worldState).where(eq(worldState.key, WORLD_KEY));
  return row?.value as WorldInfo | undefined;
}

/** The original server's map dump (db/seed), or WORLD_MAP_FILE where the sources aren't laid out as in the repo (the bundled image). */
function legacyMapPath(): string {
  if (process.env.WORLD_MAP_FILE) return process.env.WORLD_MAP_FILE;
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '../../../../../db/seed/legacy-map-800.bin.gz');
}

/**
 * Create the 800x800 tile table once. Safe to call from several processes: guarded by an
 * advisory lock and the `world` row in world_state.
 */
export async function ensureWorld(db: Db, opts: { source: 'generated' | 'legacy'; seed: string; log?: (m: string) => void }): Promise<WorldInfo> {
  const log = opts.log ?? (() => {});
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${SEED_LOCK})`);
    const existing = await getWorldInfo(tx);
    if (existing) return existing;
    const size = BALANCE.mapSize;
    let data: Uint8Array;
    if (opts.source === 'legacy') {
      data = zlib.gunzipSync(fs.readFileSync(legacyMapPath()));
      log('seeding world from legacy s2 tile dump');
    } else {
      data = generateMap(opts.seed, size);
      log(`seeding procedural world (seed "${opts.seed}")`);
    }
    const started = Date.now();
    const total = size * size;
    // two bytes a tile (type, level); a legacy dump read from disk could be cut short
    if (data.length < total * 2) throw new Error(`world map data is ${data.length} bytes, expected ${total * 2}`);
    const chunk = 40_000;
    for (let start = 0; start < total; start += chunk) {
      const end = Math.min(total, start + chunk);
      const ids: number[] = [];
      const types: number[] = [];
      const levels: number[] = [];
      for (let id = start; id < end; id++) {
        ids.push(id);
        types.push(data[id * 2] ?? TileType.FLAT); // in range: checked above
        levels.push(data[id * 2 + 1] || 1);
      }
      await tx.execute(sql`
        insert into tiles (id, type, level)
        select * from unnest(${pgArray(ids)}::int[], ${pgArray(types)}::smallint[], ${pgArray(levels)}::smallint[])`);
    }
    // (marchlands) historic cities stand at fixed places on every world (core historic.ts; an existing world got them
    // from migration 0031)
    const seats = historicCities(size);
    await tx.execute(sql`
      update tiles set type = ${TileType.HISTORIC}, level = seat.level
      from unnest(${pgArray(seats.map((s) => s.y * size + s.x))}::int[], ${pgArray(seats.map((s) => s.level))}::smallint[]) as seat(id, level)
      where tiles.id = seat.id`);
    const info: WorldInfo = { mapSize: size, source: opts.source, seed: opts.seed, createdAt: Date.now() };
    await tx.insert(worldState).values({ key: WORLD_KEY, value: info, updatedAt: Date.now() });
    log(`world seeded: ${total} tiles in ${Date.now() - started}ms`);
    return info;
  });
}

export async function zoneStats(db: Db): Promise<ZoneStats[]> {
  const [row] = await db.select().from(worldState).where(eq(worldState.key, 'zones'));
  return (row?.value as ZoneStats[] | undefined) ?? refreshZoneStats(db);
}

// ---------------------------------------------------------------------------------------------
// Map view (common.mapInfoSimple / field.getOtherFieldInfo)
// ---------------------------------------------------------------------------------------------

interface MapCastle {
  id: number;
  x: number;
  y: number;
  /** the city's name; absent for a barbarian city (the client names it by its tile type) */
  name?: string;
  npc: boolean;
  level: number;
  cityId?: number;
  playerId?: number;
  userName?: string;
  prestige?: number;
  honor?: number;
  flag?: string;
  allianceName?: string;
  playerLogoUrl?: string;
  relation?: number;
  state?: number;
  furlough?: boolean;
  zoneId: number;
  canLoot: boolean;
  canOccupy: boolean;
  canScout: boolean;
  canSend: boolean;
  canTrans: boolean;
}

/**
 * Tiles in an inclusive rectangle (max 21x21, wraps around the map edge).
 * `mapStr` is two hex chars per tile (type, level), row-major, as in the original.
 */
export async function mapView(ctx: Ctx, viewerId: number | null, x1: number, y1: number, x2: number, y2: number) {
  const size = BALANCE.mapSize;
  if (x2 < x1 || y2 < y1) throw new GameError(msg('world.invalidArea'), -1);
  if (x2 - x1 + 1 > MAP_VIEW_MAX || y2 - y1 + 1 > MAP_VIEW_MAX) throw new GameError(msg('world.areaTooLarge', { max: MAP_VIEW_MAX }), -1);
  const ids: number[] = [];
  for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) ids.push((((y % size) + size) % size) * size + (((x % size) + size) % size));
  const rows = await ctx.tx.select().from(tiles).where(inArray(tiles.id, ids));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const cityIds = rows.map((r) => r.cityId).filter((x): x is number => x != null);
  const cityRows = cityIds.length
    ? await ctx.tx
        .select({
          id: cities.id,
          name: cities.name,
          playerId: cities.playerId,
          status: cities.status,
          buildings: cities.buildings,
          historicLevel: cities.historicLevel,
          userName: players.name,
          prestige: players.prestige,
          honor: players.honor,
          flag: players.flag,
          faceUrl: players.faceUrl,
          allianceId: players.allianceId,
          beginner: players.beginner,
          pstatus: players.status,
        })
        .from(cities)
        .innerJoin(players, eq(players.id, cities.playerId))
        .where(inArray(cities.id, cityIds))
    : [];
  const cityById = new Map(cityRows.map((c) => [c.id, c]));
  const allianceNames = await allianceNameMap(
    ctx,
    cityRows.map((c) => c.allianceId),
  );
  let mapStr = '';
  const castles: MapCastle[] = [];
  for (const id of ids) {
    const t = byId.get(id);
    if (!t) {
      mapStr += 'a1';
      continue;
    }
    const { x, y } = tileXY(id);
    const zoneId = stateOf(id);
    if (t.cityId != null) {
      const c = cityById.get(t.cityId);
      const level = c ? Math.max(1, c.buildings.find((b) => b.typeId === 31)?.level ?? 1) : 1;
      mapStr += hex(TileType.CASTLE) + hex(level);
      if (c) {
        const relation = viewerId ? await relationBetween(ctx, viewerId, c.playerId) : Relation.NO_RELATION;
        castles.push({
          id,
          x,
          y,
          name: c.name,
          npc: false,
          level,
          ...(c.historicLevel ? { historicLevel: c.historicLevel } : {}),
          cityId: c.id,
          playerId: c.playerId,
          userName: c.userName,
          prestige: Math.floor(c.prestige),
          honor: Math.floor(c.honor),
          flag: c.flag,
          allianceName: c.allianceId ? (allianceNames.get(c.allianceId) ?? '') : '',
          playerLogoUrl: c.faceUrl,
          relation,
          state: c.pstatus,
          furlough: c.beginner,
          zoneId,
          ...relationPermissions(relation),
        });
      }
    } else {
      mapStr += hex(t.type) + hex(mapLevelDigit(t.type, t.level));
      if (t.type === TileType.NPC) {
        castles.push({ id, x, y, npc: true, level: t.level, zoneId, ...relationPermissions(Relation.NO_RELATION) });
      }
    }
  }
  // valleys held by a city (any lord, the viewer included), with the holder and its relation
  const held = rows.filter((t) => t.ownerCityId != null && t.cityId == null && t.type !== TileType.NPC && t.type !== TileType.FLAT);
  const holderIds = [...new Set(held.flatMap((t) => (t.ownerCityId == null ? [] : [t.ownerCityId])))];
  const holders = holderIds.length
    ? await ctx.tx
        .select({ id: cities.id, name: cities.name, playerId: cities.playerId, userName: players.name, allianceId: players.allianceId })
        .from(cities)
        .innerJoin(players, eq(players.id, cities.playerId))
        .where(inArray(cities.id, holderIds))
    : [];
  const holderById = new Map(holders.map((h) => [h.id, h]));
  const holderAlliances = await allianceNameMap(
    ctx,
    holders.map((h) => h.allianceId),
  );
  const relationOf = new Map<number, number>();
  const valleys = [];
  for (const t of held) {
    const h = t.ownerCityId == null ? undefined : holderById.get(t.ownerCityId);
    if (!h) continue;
    let relation = relationOf.get(h.playerId);
    if (relation === undefined) {
      relation = viewerId ? await relationBetween(ctx, viewerId, h.playerId) : Relation.NO_RELATION;
      relationOf.set(h.playerId, relation);
    }
    const { x, y } = tileXY(t.id);
    valleys.push({
      id: t.id,
      x,
      y,
      type: t.type,
      level: t.level,
      cityId: h.id,
      cityName: h.name,
      playerId: h.playerId,
      userName: h.userName,
      allianceName: h.allianceId ? (holderAlliances.get(h.allianceId) ?? '') : '',
      relation,
    });
  }
  return { x1, y1, x2, y2, mapStr, castles, valleys };
}

const hex = (n: number) => Math.max(0, Math.min(15, n)).toString(16);

async function allianceNameMap(ctx: Ctx, ids: (number | null)[]) {
  const list = [...new Set(ids.filter((x): x is number => x != null))];
  const out = new Map<number, string>();
  if (!list.length) return out;
  const rows = await ctx.tx.execute<{ id: number; name: string }>(sql`select id, name from alliances where id = any(${pgArray(list)}::int[])`);
  for (const r of rows.rows) out.set(Number(r.id), r.name);
  return out;
}

/** Details of a single tile (field.getOtherFieldInfo). */
export async function fieldInfo(ctx: Ctx, viewerId: number | null, tileId: number) {
  if (!Number.isInteger(tileId) || tileId < 0 || tileId >= BALANCE.mapSize ** 2) throw new GameError(msg('world.invalidTile'), -99);
  const [t] = await ctx.tx.select().from(tiles).where(eq(tiles.id, tileId));
  if (!t) throw new GameError(msg('world.invalidTile'), -99);
  const { x, y } = tileXY(tileId);
  const base = { id: tileId, x, y, type: t.type, level: t.level, zoneId: stateOf(tileId) };
  if (t.cityId != null) {
    const [castle] = (await mapView(ctx, viewerId, x, y, x, y)).castles;
    // the map view draws a castle on every tile with a city
    if (!castle) throw new Error(`tile ${tileId} has city ${t.cityId} but the map shows no castle`);
    return { ...base, ...castle, type: TileType.CASTLE };
  }
  let owner: { cityId: number; cityName: string; playerId: number; userName: string } | undefined;
  if (t.ownerCityId != null) {
    const [c] = await ctx.tx
      .select({ cityId: cities.id, cityName: cities.name, playerId: players.id, userName: players.name })
      .from(cities)
      .innerJoin(players, eq(players.id, cities.playerId))
      .where(eq(cities.id, t.ownerCityId));
    owner = c;
  }
  const relation = owner && viewerId ? await relationBetween(ctx, viewerId, owner.playerId) : Relation.NO_RELATION;
  const upgradeCost = !owner && (VALLEY_TYPES.includes(t.type) || t.type === TileType.NPC) ? valleyUpgradeCost(t.level) : null;
  return { ...base, npc: t.type === TileType.NPC, owner: owner ?? null, relation, upgradeCost, ...relationPermissions(relation) };
}

/** All tiles of a type/level in an area, used by the "search nearby" UI. */
export async function searchTiles(ctx: Ctx, x: number, y: number, radius: number, type: number) {
  const size = BALANCE.mapSize;
  const r = Math.min(30, Math.max(1, radius));
  const rows = await ctx.tx
    .select({ id: tiles.id, type: tiles.type, level: tiles.level, ownerCityId: tiles.ownerCityId, cityId: tiles.cityId })
    .from(tiles)
    .where(
      and(
        eq(tiles.type, type),
        gte(sql`${tiles.id} / ${size}`, y - r),
        lte(sql`${tiles.id} / ${size}`, y + r),
        gte(sql`${tiles.id} % ${size}`, x - r),
        lte(sql`${tiles.id} % ${size}`, x + r),
      ),
    )
    .limit(200);
  return rows.map((t) => ({ ...t, ...tileXY(t.id) }));
}
