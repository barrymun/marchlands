import { useTranslation } from 'react-i18next';

import { FORT_KEY_LIST, TROOP_KEY_LIST } from '@marchlands/core';

import { Num } from '@/components/stats-panel/num/num';
import type { Counters } from '@/components/stats-panel/types';
import { UNIT_COLUMNS } from '@/components/stats-panel/units/constants';
import { unitCount, unitName } from '@/components/stats-panel/units/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function Units({ c }: { c: Counters }) {
  const { t } = useTranslation(['stats-panel', 'common']);
  const units = [...TROOP_KEY_LIST, ...FORT_KEY_LIST];
  const rows = units.filter((k) => UNIT_COLUMNS.some(({ group }) => unitCount(c, group, k)));
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{t('units.title')}</CardTitle>
        <CardDescription>{t('units.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('common:nothingYet')}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('common:table.unit')}</TableHead>
                {UNIT_COLUMNS.map((col) => (
                  <TableHead key={col.group} className="text-right">
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
        )}
      </CardContent>
    </Card>
  );
}
