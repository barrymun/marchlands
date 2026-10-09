// (marchlands) Lord statistics: what the lord trained, fought, produced and spent, for all of their
// cities or one, all time or the last 7 days. The server writes the counters in batches, so the
// newest actions can take a few minutes to appear.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { LordStatistics } from '@marchlands/api-client';
import { FORT_ID_BY_KEY, FORT_KEY_LIST, itemConfig, TROOP_ID_BY_KEY, TROOP_KEY_LIST, TROOP_NAMES, type FortKey, type TroopKey } from '@marchlands/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api, unwrap } from '@/lib/api';
import { fmt, fmtExact } from '@/lib/format';

type Counters = Record<string, number>;

const RESOURCES = [
  ['gold', 'Gold'],
  ['food', 'Food'],
  ['wood', 'Lumber'],
  ['stone', 'Stone'],
  ['iron', 'Iron'],
] as const;

const UNIT_COLUMNS = [
  ['trained', 'Trained'],
  ['killed', 'Killed (enemy)'],
  ['died', 'Died'],
  ['injured', 'Injured'],
  ['healed', 'Healed'],
  ['deserted', 'Deserted'],
  ['disbanded', 'Disbanded'],
] as const;

const RESOURCE_COLUMNS = [
  ['produced', 'Produced'],
  ['wasted', 'Wasted (storage full)'],
  ['plundered', 'Plundered'],
  ['stolen', 'Lost to plunder'],
  ['gained.levy', 'Levied'],
  ['market.bought', 'Bought'],
  ['market.sold', 'Sold'],
] as const;

const SPENDING = [
  ['building', 'Buildings'],
  ['research', 'Research'],
  ['training', 'Troops and fortifications'],
  ['healing', 'Healing'],
  ['speedups', 'Speed-ups'],
  ['items', 'Items'],
  ['heroes', 'Heroes (hire, refresh, reward)'],
  ['valleys', 'Valley upgrades'],
  ['comfort', 'Comforting'],
  ['other', 'Other (truce, holiday, alliance)'],
] as const;

/** A unit counter; `died` is the fallen (`lost`, which includes those who came home injured) less the injured. */
const unitCount = (c: Counters, g: string, k: string) => (g === 'died' ? Math.max(0, (c[`lost.${k}`] ?? 0) - (c[`injured.${k}`] ?? 0)) : (c[`${g}.${k}`] ?? 0));

const unitName = (k: string) => TROOP_NAMES[TROOP_ID_BY_KEY[k as TroopKey] ?? FORT_ID_BY_KEY[k as FortKey]] ?? k;
const sumPrefix = (c: Counters, prefix: string) => Object.entries(c).reduce((s, [k, v]) => (k.startsWith(prefix) ? s + v : s), 0);

export function StatsPanel() {
  const [scope, setScope] = useState('all');
  const [period, setPeriod] = useState<'allTime' | 'last7Days'>('allTime');
  const stats = useQuery({
    queryKey: ['statistics'],
    staleTime: 60_000,
    queryFn: () => unwrap(api.GET('/api/v1/player/statistics')),
  });
  if (stats.isPending) return <Skeleton className="h-64" />;
  if (!stats.data) return <p className="text-sm text-muted-foreground">Statistics could not be loaded.</p>;
  const data: LordStatistics = stats.data;
  const city = scope === 'all' ? null : data.cities.find((c) => String(c.cityId) === scope);
  const c: Counters = (city ?? data)[period];

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Statistics</CardTitle>
          <CardDescription>
            {data.since ? `Counted since ${new Date(data.since).toLocaleString()}. ` : ''}Saved every few minutes, so your latest actions can take a few minutes
            to show up.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All cities</SelectItem>
              {data.cities.map((x) => (
                <SelectItem key={x.cityId} value={String(x.cityId)}>
                  {x.name}
                  {!x.owned && ` (#${x.cityId})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
            <TabsList>
              <TabsTrigger value="allTime">All time</TabsTrigger>
              <TabsTrigger value="last7Days">Last 7 days</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      <Summary c={c} lordWide={!city} />
      <Units c={c} />
      <Resources c={c} />
      <Spending c={c} />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <NpcWins c={c} />
        {!city && <ItemsUsed c={c} />}
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-medium tabular-nums" title={fmtExact(value)}>
        {fmt(value)}
      </div>
    </div>
  );
}

function Summary({ c, lordWide }: { c: Counters; lordWide: boolean }) {
  const won = sumPrefix(c, 'attacks.won.');
  const lost = sumPrefix(c, 'attacks.lost.');
  const tiles: [string, number][] = [
    ['Attacks won', won],
    ['Attacks lost', lost],
    ['Defenses won', sumPrefix(c, 'defenses.won.')],
    ['Defenses lost', sumPrefix(c, 'defenses.lost.')],
    ['Barbarian cities beaten', c['attacks.won.npc'] ?? 0],
    ['Cities captured', (c['captured.city'] ?? 0) + (c['captured.npc'] ?? 0)],
    ['Valleys occupied', c['captured.valley'] ?? 0],
    ['Honor gained', c.honor ?? 0],
    ['Building levels', c['levels.building'] ?? 0],
    ['Research levels', c['levels.research'] ?? 0],
    ['Hero levels', c['levels.hero'] ?? 0],
    ['Heroes hired', c['heroes.hired'] ?? 0],
  ];
  if (lordWide) tiles.push(['Items used', sumPrefix(c, 'items.used.')]);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Overview</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {tiles.map(([label, v]) => (
          <Tile key={label} label={label} value={v} />
        ))}
      </CardContent>
    </Card>
  );
}

function Units({ c }: { c: Counters }) {
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

function Num({ v }: { v?: number }) {
  return (
    <TableCell className="text-right tabular-nums" title={v ? fmtExact(v) : undefined}>
      {v ? fmt(v) : <span className="text-muted-foreground">—</span>}
    </TableCell>
  );
}

function Resources({ c }: { c: Counters }) {
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

function Spending({ c }: { c: Counters }) {
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

function NpcWins({ c }: { c: Counters }) {
  const levels = Array.from({ length: 10 }, (_, i) => i + 1).filter((l) => c[`npcWins.${l}`]);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Barbarian cities beaten, by level</CardTitle>
      </CardHeader>
      <CardContent>
        {levels.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet.</p>
        ) : (
          <div className="grid grid-cols-5 gap-2">
            {levels.map((l) => (
              <Tile key={l} label={`Level ${l}`} value={c[`npcWins.${l}`]} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ItemsUsed({ c }: { c: Counters }) {
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
