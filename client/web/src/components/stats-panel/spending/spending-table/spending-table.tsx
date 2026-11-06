import { useTranslation } from 'react-i18next';

import { statKey, statPrefix } from '@marchlands/core';

import { Num } from '@/components/stats-panel/num/num';
import { SPENDING } from '@/components/stats-panel/spending/constants';
import type { Counters } from '@/components/stats-panel/types';
import { sumPrefix } from '@/components/stats-panel/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { resourceLabel, RESOURCES } from '@/lib/format';

/** What was spent on what, in every resource, and the totals: the spending section's table view. */
export function SpendingTable({ c }: { c: Counters }) {
  const { t } = useTranslation(['stats-panel', 'common']);
  const rows = SPENDING.filter(({ group }) => sumPrefix(c, statPrefix(group)) !== 0);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('spending.on')}</TableHead>
          {RESOURCES.map((r) => (
            <TableHead key={r} className="text-end">
              {resourceLabel(r)}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(({ group, label }) => (
          <TableRow key={group}>
            <TableCell>{label}</TableCell>
            {RESOURCES.map((r) => (
              <Num key={r} v={c[statKey(group, r)]} />
            ))}
          </TableRow>
        ))}
        <TableRow className="font-medium">
          <TableCell>{t('common:table.total')}</TableCell>
          {RESOURCES.map((r) => (
            <Num key={r} v={SPENDING.reduce((s, { group }) => s + (c[statKey(group, r)] ?? 0), 0)} />
          ))}
        </TableRow>
      </TableBody>
    </Table>
  );
}
