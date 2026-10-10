import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmt } from '@/lib/format';
import type { Counters } from '@/components/stats-panel/types';
import { RESOURCES } from '@/components/stats-panel/constants';
import { Num } from '@/components/stats-panel/num/num';
import { RESOURCE_COLUMNS } from '@/components/stats-panel/resources/constants';

export function Resources({ c }: { c: Counters }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Resources</CardTitle>
        <CardDescription>
          Produced is gross output (gold: taxes). Troops ate {fmt(c['upkeep.food'] ?? 0)} food; heroes were paid {fmt(c['salaries.gold'] ?? 0)} gold. Market:{' '}
          {fmt(c['market.goldPaid'] ?? 0)} gold paid, {fmt(c['market.goldReceived'] ?? 0)} gold received.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Resource</TableHead>
              {RESOURCE_COLUMNS.map(([g, label]) => (
                <TableHead key={g} className="text-right">
                  {label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {RESOURCES.map(([r, label]) => (
              <TableRow key={r}>
                <TableCell>{label}</TableCell>
                {RESOURCE_COLUMNS.map(([g]) => (
                  <Num key={g} v={c[`${g}.${r}`]} />
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
