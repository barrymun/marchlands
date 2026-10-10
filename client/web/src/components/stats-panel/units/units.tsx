import { FORT_KEY_LIST, TROOP_KEY_LIST } from '@marchlands/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Counters } from '@/components/stats-panel/types';
import { Num } from '@/components/stats-panel/num/num';
import { unitCount, unitName } from '@/components/stats-panel/units/utils';
import { UNIT_COLUMNS } from '@/components/stats-panel/units/constants';

export function Units({ c }: { c: Counters }) {
  const units = [...TROOP_KEY_LIST, ...FORT_KEY_LIST];
  const rows = units.filter((k) => UNIT_COLUMNS.some(([g]) => unitCount(c, g, k)));
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Troops and fortifications</CardTitle>
        <CardDescription>
          Killed counts the enemy units of that type your armies and defenses destroyed. Of your own fallen, Died never came back and Injured came home to be
          healed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unit</TableHead>
                {UNIT_COLUMNS.map(([g, label]) => (
                  <TableHead key={g} className="text-right">
                    {label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((k) => (
                <TableRow key={k}>
                  <TableCell>{unitName(k)}</TableCell>
                  {UNIT_COLUMNS.map(([g]) => (
                    <Num key={g} v={unitCount(c, g, k)} />
                  ))}
                </TableRow>
              ))}
              <TableRow className="font-medium">
                <TableCell>Total</TableCell>
                {UNIT_COLUMNS.map(([g]) => (
                  <Num key={g} v={units.reduce((s, k) => s + unitCount(c, g, k), 0)} />
                ))}
              </TableRow>
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
