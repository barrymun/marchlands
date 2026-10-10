import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmt } from '@/lib/format';
import type { Counters } from '@/components/stats-panel/types';
import { sumPrefix } from '@/components/stats-panel/utils';
import { RESOURCES } from '@/components/stats-panel/constants';
import { Num } from '@/components/stats-panel/num/num';
import { SPENDING } from '@/components/stats-panel/spending/constants';

export function Spending({ c }: { c: Counters }) {
  const rows = SPENDING.filter(([g]) => sumPrefix(c, `spent.${g}.`) !== 0);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Spending</CardTitle>
        <CardDescription>
          After refunds for cancelled orders.{c['spent.healing.honor'] ? ` Healing also cost ${fmt(c['spent.healing.honor'])} honor.` : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>On</TableHead>
                {RESOURCES.map(([r, label]) => (
                  <TableHead key={r} className="text-right">
                    {label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(([g, label]) => (
                <TableRow key={g}>
                  <TableCell>{label}</TableCell>
                  {RESOURCES.map(([r]) => (
                    <Num key={r} v={c[`spent.${g}.${r}`]} />
                  ))}
                </TableRow>
              ))}
              <TableRow className="font-medium">
                <TableCell>Total</TableCell>
                {RESOURCES.map(([r]) => (
                  <Num key={r} v={SPENDING.reduce((s, [g]) => s + (c[`spent.${g}.${r}`] ?? 0), 0)} />
                ))}
              </TableRow>
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
