import { StatCounter, statKey } from '@marchlands/core';

import { SPENDING } from '@/components/stats-panel/spending/constants';
import type { Counters } from '@/components/stats-panel/types';
import { RESOURCES } from '@/lib/format';

/** What was spent on each thing (SPENDING's order), in the resources it took; what refunds left at nothing is left out. */
export function spendingRows(c: Counters) {
  return SPENDING.map(({ group, label }) => ({
    group,
    label,
    amounts: RESOURCES.map((resource) => ({ resource, amount: c[statKey(group, resource)] ?? 0 })).filter((x) => x.amount > 0),
  })).filter((row) => row.amounts.length > 0);
}

/** The honour healing cost, which no resource counts. */
export const honorSpent = (c: Counters) => Math.max(0, c[StatCounter.SPENT_HEALING_HONOR] ?? 0);
