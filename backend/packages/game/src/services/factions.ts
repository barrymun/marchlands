// (marchlands) The NPC factions (core factions.ts) as players see them: the gold each holds against its treasury.

import { factionOfZone, FACTIONS, groupKey, groupTreasury } from '@marchlands/core';
import { type Ctx } from '#/context.ts';
import { loadNpcEconomy } from '#/engine/npc-economy.ts';

/**
 * Every faction's gold now and its treasury (what its gold drifts back to), from its groups; before the first tick of
 * their trade every faction holds its treasury of nothing (no groups counted yet).
 */
export async function list(ctx: Ctx) {
  const econ = await loadNpcEconomy(ctx, false);
  return FACTIONS.map((f) => {
    let gold = 0;
    let treasury = 0;
    for (const g of econ?.groups ?? []) {
      if (factionOfZone(g.zone)?.id !== f.id) continue;
      treasury += groupTreasury(g);
      gold += econ?.gold[groupKey(g.zone, g.level)] ?? groupTreasury(g);
    }
    return { id: f.id, gold: Math.floor(gold), treasury: Math.floor(treasury) };
  });
}
