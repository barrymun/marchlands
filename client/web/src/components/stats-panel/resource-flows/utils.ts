import { ResourceKey } from '@marchlands/core';

import { FlowKind, GAIN_KINDS, LOSS_KINDS } from '@/components/stats-panel/resource-flows/constants';
import { SPENDING } from '@/components/stats-panel/spending/constants';
import type { Counters } from '@/components/stats-panel/types';
import type { Resource } from '@/lib/format';

/** How much of a resource each kind of gain or loss moved (never below 0: refunds can leave a spending group negative). */
function flowAmount(c: Counters, r: Resource, kind: FlowKind): number {
  const n = (key: string) => c[key] ?? 0;
  const gold = r === ResourceKey.GOLD;
  const amount = (() => {
    switch (kind) {
      case FlowKind.PRODUCED:
        return n(`produced.${r}`);
      case FlowKind.PLUNDERED:
        return n(`plundered.${r}`);
      // the market: gold received for what was sold, or the resource bought
      case FlowKind.MARKET_IN:
        return gold ? n('market.goldReceived') : n(`market.bought.${r}`);
      case FlowKind.GIFT:
        return n(`gained.dailyGift.${r}`);
      // troops eat food, heroes are paid gold
      case FlowKind.UPKEEP:
        return r === ResourceKey.FOOD ? n('upkeep.food') : gold ? n('salaries.gold') : 0;
      case FlowKind.SPENT:
        return SPENDING.reduce((s, { group }) => s + n(`spent.${group}.${r}`), 0);
      case FlowKind.WASTED:
        return n(`wasted.${r}`);
      case FlowKind.TAXED:
        return n(`taxed.${r}`);
      // the market: gold paid for what was bought, or the resource sold
      case FlowKind.MARKET_OUT:
        return gold ? n('market.goldPaid') : n(`market.sold.${r}`);
      case FlowKind.STOLEN:
        return n(`stolen.${r}`);
    }
  })();
  return Math.max(0, amount);
}

/** Where a resource came from and where it went, the kinds that moved any, with the totals of each side. */
export function resourceFlow(c: Counters, r: Resource) {
  const side = (kinds: readonly FlowKind[]) => kinds.map((kind) => ({ kind, amount: flowAmount(c, r, kind) })).filter((f) => f.amount > 0);
  const gains = side(GAIN_KINDS);
  const losses = side(LOSS_KINDS);
  const total = (fs: { amount: number }[]) => fs.reduce((s, f) => s + f.amount, 0);
  return { resource: r, gains, losses, gained: total(gains), lost: total(losses) };
}

/** The one scale every resource's bars are drawn on: the biggest side of any of them. */
export const flowScale = (flows: { gained: number; lost: number }[]) => Math.max(0, ...flows.map((f) => Math.max(f.gained, f.lost)));
