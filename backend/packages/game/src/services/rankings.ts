// rank.* — rankings are recomputed by the worker (engine/rankings.ts) into cached columns; the
// queries below page over them with optional case-insensitive name search.

import { sql } from 'drizzle-orm';

import { GameError, msg } from '@marchlands/core';

import { type Ctx } from '#/context.ts';
import { seatTitles } from '#/engine/seats.ts';

function paging(pageNo: number, pageSize: number) {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) throw new GameError(msg('common.invalidData'), -99);
  const page = Math.max(1, Math.floor(pageNo || 1));
  return { page, size: pageSize, offset: (page - 1) * pageSize };
}
const like = (key: string) => `%${key.replace(/[%_\\]/g, '')}%`;

// Raw row shapes as node-postgres returns them: bigint (count(*), row_number()) arrives as a string.
type Paged = { rank: string; total: string };
type PlayerRankRow = Paged & {
  id: number;
  name: string;
  prestige: number;
  honor: number;
  title: number;
  population: number;
  alliance_rank: number;
  flag: string;
  face_url: string;
  alliance: string | null;
  cities: number;
};
type AllianceRankRow = Paged & {
  name: string;
  member_count: number;
  prestige: number;
  honor: number;
  city_count: number;
  founder_name: string;
  intro: string;
  leader: string | null;
};
type HeroRankRow = Paged & { id: number; name: string; level: number; power: number; management: number; stratagem: number; kind: string };
type CastleRankRow = Paged & { id: number; name: string; population: number; kind: string; alliance: string | null; level: number };

/** The ORDER BY of a ranking's sort type, or the default one. */
const orderBy = (sorts: Record<number, string>, sortType: number, fallback: string) => sql.raw(sorts[sortType] ?? fallback);

const PLAYER_SORT = {
  1: 'title desc, prestige desc',
  2: 'prestige desc',
  3: 'honor desc',
  4: 'cities desc, prestige desc',
  5: 'population desc',
} satisfies Record<number, string>;

/** rank.getPlayerRank — sortType 1 title, 2 prestige, 3 honor, 4 cities, 5 population. */
export async function playerRanking(ctx: Ctx, sortType: number, pageNo: number, pageSize: number, key = '') {
  const { page, size, offset } = paging(pageNo, pageSize);
  const order = orderBy(PLAYER_SORT, sortType, PLAYER_SORT[2]);
  const rows = await ctx.tx.execute<PlayerRankRow>(sql`
    with ranked as (
      select p.id, p.name, p.prestige, p.honor, p.title, p.population, p.alliance_rank, p.flag, p.face_url,
             a.name as alliance,
             (select count(*) from cities c where c.player_id = p.id)::int as cities
      from players p left join alliances a on a.id = p.alliance_id
      where exists (select 1 from cities c where c.player_id = p.id)
    ), numbered as (select *, row_number() over (order by ${order}, id) as rank from ranked)
    select *, count(*) over () as total from numbered
    where ${key ? sql`name ilike ${like(key)}` : sql`true`}
    order by rank limit ${size} offset ${offset}`);
  const total = Number(rows.rows[0]?.total ?? 0);
  const titles = await seatTitles(
    ctx,
    rows.rows.map((r) => Number(r.id)),
  );
  return {
    pageNo: page,
    pageSize: size,
    totalPage: Math.ceil(total / size),
    beans: rows.rows.map((r) => ({
      ranking: Number(r.rank),
      id: Number(r.id),
      userName: r.name,
      prestige: Math.floor(Number(r.prestige)),
      honor: Math.floor(Number(r.honor)),
      titleId: Number(r.title),
      seatTitle: titles.get(Number(r.id)) ?? null,
      population: Number(r.population),
      castleCount: Number(r.cities),
      alliance: r.alliance ?? '',
      allianceRank: r.alliance ? Number(r.alliance_rank) : null,
      flag: r.flag,
      faceUrl: r.face_url,
    })),
  };
}

const ALLIANCE_SORT = { 1: 'member_count desc, prestige desc', 2: 'prestige desc', 3: 'honor desc' } satisfies Record<number, string>;

/** rank.getAllianceRank — sortType 1 members, 2 prestige, 3 honor. */
export async function allianceRanking(ctx: Ctx, sortType: number, pageNo: number, pageSize: number, key = '') {
  const { page, size, offset } = paging(pageNo, pageSize);
  const order = orderBy(ALLIANCE_SORT, sortType, ALLIANCE_SORT[1]);
  const rows = await ctx.tx.execute<AllianceRankRow>(sql`
    with numbered as (
      select a.*, (select name from players where id = a.leader_player_id) as leader,
             row_number() over (order by ${order}, id) as rank from alliances a)
    select *, count(*) over () as total from numbered
    where ${key ? sql`name ilike ${like(key)}` : sql`true`}
    order by rank limit ${size} offset ${offset}`);
  const total = Number(rows.rows[0]?.total ?? 0);
  return {
    pageNo: page,
    pageSize: size,
    totalPage: Math.ceil(total / size),
    beans: rows.rows.map((r) => ({
      rank: Number(r.rank),
      name: r.name,
      member: Number(r.member_count),
      prestige: Math.floor(Number(r.prestige)),
      honor: Math.floor(Number(r.honor)),
      city: Number(r.city_count),
      playerName: r.leader ?? '',
      createrName: r.founder_name,
      description: r.intro,
    })),
  };
}

const HERO_SORT = { 1: 'level desc', 2: 'management desc', 3: 'power desc', 4: 'stratagem desc' } satisfies Record<number, string>;

/** rank.getHeroRank — sortType 1 grade, 2 management, 3 power, 4 stratagem. */
export async function heroRanking(ctx: Ctx, sortType: number, pageNo: number, pageSize: number, key = '') {
  const { page, size, offset } = paging(pageNo, pageSize);
  const order = orderBy(HERO_SORT, sortType, HERO_SORT[1]);
  const rows = await ctx.tx.execute<HeroRankRow>(sql`
    with numbered as (
      select h.id, h.name, h.level, h.power, h.management, h.stratagem, p.name as kind,
             row_number() over (order by ${order}, h.id) as rank
      from heroes h join players p on p.id = h.player_id
      where not h.in_tavern and h.captured_by_player_id is null)
    select *, count(*) over () as total from numbered
    where ${key ? sql`name ilike ${like(key)}` : sql`true`}
    order by rank limit ${size} offset ${offset}`);
  const total = Number(rows.rows[0]?.total ?? 0);
  return {
    pageNo: page,
    pageSize: size,
    totalPage: Math.ceil(total / size),
    beans: rows.rows.map((r) => ({
      rank: Number(r.rank),
      name: r.name,
      grade: Number(r.level),
      power: Number(r.power),
      management: Number(r.management),
      stratagem: Number(r.stratagem),
      kind: r.kind,
    })),
  };
}

/** rank.getCastleRank — sortType 1 population, 2 level. */
export async function castleRanking(ctx: Ctx, sortType: number, pageNo: number, pageSize: number, key = '') {
  const { page, size, offset } = paging(pageNo, pageSize);
  const order = sql.raw(sortType === 2 ? 'level desc, population desc' : 'population desc');
  const rows = await ctx.tx.execute<CastleRankRow>(sql`
    with base as (
      select c.id, c.name, c.population::int as population, p.name as kind, a.name as alliance,
             coalesce((select max((b->>'level')::int) from jsonb_array_elements(c.buildings) b where (b->>'typeId')::int = 31), 0) as level
      from cities c join players p on p.id = c.player_id left join alliances a on a.id = p.alliance_id
    ), numbered as (select *, row_number() over (order by ${order}, id) as rank from base)
    select *, count(*) over () as total from numbered
    where ${key ? sql`name ilike ${like(key)}` : sql`true`}
    order by rank limit ${size} offset ${offset}`);
  const total = Number(rows.rows[0]?.total ?? 0);
  return {
    pageNo: page,
    pageSize: size,
    totalPage: Math.ceil(total / size),
    beans: rows.rows.map((r) => ({
      rank: Number(r.rank),
      name: r.name,
      level: Number(r.level),
      grade: `Level ${r.level}`,
      population: Number(r.population),
      kind: r.kind,
      alliance: r.alliance ?? '',
    })),
  };
}
