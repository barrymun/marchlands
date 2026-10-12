// Alliance totals shared with the ranking job: member counts, prestige and ranks.

import { sql } from 'drizzle-orm';
import { type Ctx } from '#/context.ts';

/** Ranking job: aggregate members into alliance totals and ranks. */
export async function refreshAllianceStats(ctx: Ctx) {
  await ctx.tx.execute(sql`
    update alliances a set
      prestige = coalesce(s.prestige, 0), honor = coalesce(s.honor, 0),
      member_count = coalesce(s.members, 0), city_count = coalesce(s.cities, 0)
    from (
      select p.alliance_id, sum(p.prestige) prestige, sum(p.honor) honor, count(*) members,
             sum((select count(*) from cities c where c.player_id = p.id)) cities
      from players p where p.alliance_id is not null group by p.alliance_id
    ) s where s.alliance_id = a.id`);
  await ctx.tx.execute(sql`
    update alliances a set prestige_rank = r.pr, honor_rank = r.hr, members_rank = r.mr
    from (select id,
            row_number() over (order by prestige desc, id) pr,
            row_number() over (order by honor desc, id) hr,
            row_number() over (order by member_count desc, prestige desc, id) mr
          from alliances) r where r.id = a.id`);
}
