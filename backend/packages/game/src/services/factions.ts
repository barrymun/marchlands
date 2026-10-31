// (marchlands) The NPC factions (core factions.ts) as players see them: the gold each holds against its treasury, and
// the player's standing with each (core reputation.ts).

import { factionOfZone, FACTIONS, groupKey, groupTreasury } from '@marchlands/core';

import { type Ctx } from '#/context.ts';
import { loadNpcEconomy } from '#/engine/npc-economy.ts';
import { standingsOf } from '#/engine/reputation.ts';

/**
 * Every faction's gold now and its treasury (what its gold drifts back to), from its groups, and the player's standing
 * with it (0 without a player); before the first tick of their trade every faction holds its treasury of nothing (no groups counted yet).
 */
export async function list(ctx: Ctx, playerId: number | null) {
  const econ = await loadNpcEconomy(ctx, false);
  // an account without a player yet stands at 0 with everyone
  const standing = playerId == null ? null : await standingsOf(ctx, playerId);
  return FACTIONS.map((f) => {
    let gold = 0;
    let treasury = 0;
    for (const g of econ?.groups ?? []) {
      if (factionOfZone(g.zone)?.id !== f.id) continue;
      treasury += groupTreasury(g);
      gold += econ?.gold[groupKey(g.zone, g.level)] ?? groupTreasury(g);
    }
    return { id: f.id, gold: Math.floor(gold), treasury: Math.floor(treasury), standing: standing?.[f.id] ?? 0 };
  });
}
