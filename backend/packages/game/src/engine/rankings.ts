// Recomputing the cached ranking columns (worker job).

import { sql } from 'drizzle-orm';
import { type Ctx } from '#/context.ts';
import { refreshAllianceStats } from '#/engine/alliance.ts';

/** Worker job: player population/prestige ranks and alliance aggregates. */
export async function refreshRankings(ctx: Ctx) {
  await ctx.tx.execute(sql`
    update players p set population = coalesce(s.pop, 0)
    from (select player_id, sum(population)::int pop from cities group by player_id) s
    where s.player_id = p.id and p.population is distinct from coalesce(s.pop, 0)`);
  await ctx.tx.execute(sql`
    update players p set prestige_rank = r.pr, honor_rank = r.hr
    from (select id, row_number() over (order by prestige desc, id) pr, row_number() over (order by honor desc, id) hr from players) r
    where r.id = p.id and (p.prestige_rank <> r.pr or p.honor_rank <> r.hr)`);
  await refreshAllianceStats(ctx);
}
