import { useTranslation } from 'react-i18next';

import { FORT_KEY_LIST, TROOP_KEY_LIST } from '@marchlands/core';

import { Num } from '@/components/stats-panel/num/num';
import { UNIT_COLUMNS } from '@/components/stats-panel/troops/units-table/constants';
import type { Counters } from '@/components/stats-panel/types';
import { unitCount, unitName } from '@/components/stats-panel/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

/** Every unit with a count, trained to disbanded, and the totals: the troops section's table view. */
export function UnitsTable({ c }: { c: Counters }) {
  const { t } = useTranslation(['stats-panel', 'common']);
  const units = [...TROOP_KEY_LIST, ...FORT_KEY_LIST];
  const rows = units.filter((k) => UNIT_COLUMNS.some(({ group }) => unitCount(c, group, k)));
  return (
    <div className="grid gap-2">
      <p className="text-xs text-muted-foreground">{t('units.description')}</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('common:table.unit')}</TableHead>
            {UNIT_COLUMNS.map((col) => (
              <TableHead key={col.group} className="text-end">
                {col.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((k) => (
            <TableRow key={k}>
              <TableCell>{unitName(k)}</TableCell>
              {UNIT_COLUMNS.map(({ group }) => (
                <Num key={group} v={unitCount(c, group, k)} />
              ))}
            </TableRow>
          ))}
          <TableRow className="font-medium">
            <TableCell>{t('common:table.total')}</TableCell>
            {UNIT_COLUMNS.map(({ group }) => (
              <Num key={group} v={units.reduce((s, k) => s + unitCount(c, group, k), 0)} />
            ))}
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
