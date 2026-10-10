// (marchlands) Lord statistics: what the lord trained, fought, produced and spent, for all of their
// cities or one, all time or the last 7 days. The server writes the counters in batches, so the
// newest actions can take a few minutes to appear.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getPlayerStatisticsOptions, type LordStatistics } from '@marchlands/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Counters } from '@/components/stats-panel/types';
import { Summary } from '@/components/stats-panel/summary/summary';
import { Units } from '@/components/stats-panel/units/units';
import { Resources } from '@/components/stats-panel/resources/resources';
import { Spending } from '@/components/stats-panel/spending/spending';
import { NpcWins } from '@/components/stats-panel/npc-wins/npc-wins';
import { ItemsUsed } from '@/components/stats-panel/items-used/items-used';

export function StatsPanel() {
  const [scope, setScope] = useState('all');
  const [period, setPeriod] = useState<'allTime' | 'last7Days'>('allTime');
  const stats = useQuery({
    ...getPlayerStatisticsOptions(),
    staleTime: 60_000,
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
