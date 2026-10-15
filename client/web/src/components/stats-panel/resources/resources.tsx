import { useTranslation } from 'react-i18next';

import { Num } from '@/components/stats-panel/num/num';
import { RESOURCE_COLUMNS } from '@/components/stats-panel/resources/constants';
import type { Counters } from '@/components/stats-panel/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmt, resourceLabel, RESOURCES } from '@/lib/format';

export function Resources({ c }: { c: Counters }) {
  const { t } = useTranslation('stats-panel');
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{t('resources.title')}</CardTitle>
        <CardDescription>
          {t('resources.description', {
            food: fmt(c['upkeep.food'] ?? 0),
            salaries: fmt(c['salaries.gold'] ?? 0),
            paid: fmt(c['market.goldPaid'] ?? 0),
            received: fmt(c['market.goldReceived'] ?? 0),
          })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('resources.resource')}</TableHead>
              {RESOURCE_COLUMNS.map((col) => (
                <TableHead key={col.group} className="text-right">
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
                  <Num key={group} v={c[`${group}.${r}`]} />
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
