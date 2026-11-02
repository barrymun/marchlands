// (marchlands) Lord statistics: what the lord trained, fought, produced and spent, for all of their
// cities or one, all time or the last 7 days. The server writes the counters in batches, so the
// newest actions can take a few minutes to appear.

import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { getPlayerStatisticsOptions, type LordStatistics } from '@marchlands/api-client';

import { ALL_CITIES, STATS_SEARCH, StatsPeriod } from '@/components/stats-panel/constants';
import { ItemsUsed } from '@/components/stats-panel/items-used/items-used';
import { NpcWins } from '@/components/stats-panel/npc-wins/npc-wins';
import { Resources } from '@/components/stats-panel/resources/resources';
import { Spending } from '@/components/stats-panel/spending/spending';
import { Summary } from '@/components/stats-panel/summary/summary';
import type { Counters } from '@/components/stats-panel/types';
import { Units } from '@/components/stats-panel/units/units';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSearchState } from '@/hooks/use-search-state';
import { dateTime } from '@/lib/format';

export function StatsPanel() {
  const { t } = useTranslation('stats-panel');
  const [s, set] = useSearchState(STATS_SEARCH);
  const period = s.period;
  const stats = useQuery({
    ...getPlayerStatisticsOptions(),
    staleTime: 60_000,
  });
  if (stats.isPending) return <Skeleton className="h-64" />;
  if (!stats.data) return <p className="text-sm text-muted-foreground">{t('couldNotLoad')}</p>;
  const data: LordStatistics = stats.data;
  // a city no longer in the statistics shows them all
  const city = s.city == null ? null : (data.cities.find((c) => c.cityId === s.city) ?? null);
  const c: Counters = (city ?? data)[period];

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t('title')}</CardTitle>
          <CardDescription>{data.since ? t('descriptionSince', { date: dateTime(data.since) }) : t('description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Select value={city ? String(city.cityId) : ALL_CITIES} onValueChange={(v) => set({ city: v === ALL_CITIES ? null : Number(v) })}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CITIES}>{t('allCities')}</SelectItem>
              {data.cities.map((x) => (
                <SelectItem key={x.cityId} value={String(x.cityId)}>
                  {x.name ?? t('formerCity')}
                  {!x.owned && ` (#${x.cityId})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Tabs value={period} onValueChange={(v) => set({ period: STATS_SEARCH.period.read(v) })}>
            <TabsList>
              <TabsTrigger value={StatsPeriod.ALL_TIME}>{t('allTime')}</TabsTrigger>
              <TabsTrigger value={StatsPeriod.LAST_7_DAYS}>{t('last7Days')}</TabsTrigger>
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
