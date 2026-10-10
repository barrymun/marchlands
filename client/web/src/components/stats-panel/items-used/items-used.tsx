import { itemConfig } from '@marchlands/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import type { Counters } from '@/components/stats-panel/types';
import { Num } from '@/components/stats-panel/num/num';

export function ItemsUsed({ c }: { c: Counters }) {
  const used = Object.entries(c)
    .filter(([k, v]) => k.startsWith('items.used.') && v > 0)
    .map(([k, v]) => [k.slice('items.used.'.length), v] as const)
    .sort((a, b) => b[1] - a[1]);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Items used</CardTitle>
      </CardHeader>
      <CardContent>
        {used.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet.</p>
        ) : (
          <Table>
            <TableBody>
              {used.map(([id, n]) => (
                <TableRow key={id}>
                  <TableCell>{itemConfig(id)?.name.trim() ?? id}</TableCell>
                  <Num v={n} />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
