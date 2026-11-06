import { useTranslation } from 'react-i18next';

import { StatCounter, statKey } from '@marchlands/core';

import { Num } from '@/components/stats-panel/num/num';
import { RESOURCE_COLUMNS } from '@/components/stats-panel/resource-flows/resources-table/constants';
import type { Counters } from '@/components/stats-panel/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmt, resourceLabel, RESOURCES } from '@/lib/format';

/** Each resource's counters, produced to sold, with the upkeep and the market's gold: the resources section's table view. */
export function ResourcesTable({ c }: { c: Counters }) {
  const { t } = useTranslation('stats-panel');
  return (
    <div className="grid gap-2">
      <p className="text-xs text-muted-foreground">
        {t('resources.description', {
          food: fmt(c[StatCounter.UPKEEP_FOOD] ?? 0),
          salaries: fmt(c[StatCounter.SALARIES_GOLD] ?? 0),
          paid: fmt(c[StatCounter.MARKET_GOLD_PAID] ?? 0),
          received: fmt(c[StatCounter.MARKET_GOLD_RECEIVED] ?? 0),
        })}
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('resources.resource')}</TableHead>
            {RESOURCE_COLUMNS.map((col) => (
              <TableHead key={col.group} className="text-end">
                {col.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {RESOURCES.map((r) => (
            <TableRow key={r}>
              <TableCell>{resourceLabel(r)}</TableCell>
              {RESOURCE_COLUMNS.map(({ group }) => (
                <Num key={group} v={c[statKey(group, r)]} />
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
