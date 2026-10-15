import { useTranslation } from 'react-i18next';

import { Num } from '@/components/stats-panel/num/num';
import { SPENDING } from '@/components/stats-panel/spending/constants';
import type { Counters } from '@/components/stats-panel/types';
import { sumPrefix } from '@/components/stats-panel/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmt, resourceLabel, RESOURCES } from '@/lib/format';

export function Spending({ c }: { c: Counters }) {
  const { t } = useTranslation(['stats-panel', 'common']);
  const rows = SPENDING.filter(({ group }) => sumPrefix(c, `spent.${group}.`) !== 0);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{t('spending.title')}</CardTitle>
        <CardDescription>
          {c['spent.healing.honor'] ? t('spending.descriptionHonor', { honor: fmt(c['spent.healing.honor']) }) : t('spending.description')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('common:nothingYet')}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('spending.on')}</TableHead>
                {RESOURCES.map((r) => (
                  <TableHead key={r} className="text-right">
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
                    <Num key={r} v={c[`spent.${group}.${r}`]} />
                  ))}
                </TableRow>
              ))}
              <TableRow className="font-medium">
                <TableCell>{t('common:table.total')}</TableCell>
                {RESOURCES.map((r) => (
                  <Num key={r} v={SPENDING.reduce((s, { group }) => s + (c[`spent.${group}.${r}`] ?? 0), 0)} />
                ))}
              </TableRow>
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
