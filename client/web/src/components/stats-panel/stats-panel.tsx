// (marchlands) Player statistics: what the player trained, fought, produced and spent, for all of their
// cities or one, all time or the last 7 days. The server writes the counters in batches, so the
// newest actions can take a few minutes to appear.

import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { getPlayerStatisticsOptions, type LordStatistics } from '@marchlands/api-client';

import { ALL_CITIES, STATS_SEARCH, StatsPeriod } from '@/components/stats-panel/constants';
import { Enemies } from '@/components/stats-panel/enemies/enemies';
import { Growth } from '@/components/stats-panel/growth/growth';
import { Headline } from '@/components/stats-panel/headline/headline';
import { ItemsUsed } from '@/components/stats-panel/items-used/items-used';
import { ResourceFlows } from '@/components/stats-panel/resource-flows/resource-flows';
import { Spending } from '@/components/stats-panel/spending/spending';
import { Troops } from '@/components/stats-panel/troops/troops';
import type { Counters } from '@/components/stats-panel/types';
import { WinsByLevel } from '@/components/stats-panel/wins-by-level/wins-by-level';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  // the trends over the period shown: 7 days, or all the days sent
  const shownDays = period === StatsPeriod.LAST_7_DAYS ? 7 : data.days.length;
  const days = data.days.slice(-shownDays);
  const trend = Object.fromEntries(Object.entries((city ?? data).trend).map(([k, v]) => [k, v.slice(-shownDays)]));

  return (
    <div className="grid gap-4">
      {/* the period's tabs show the statistics below them: the root adds no box (contents), the statistics are its panel */}
      <Tabs value={period} onValueChange={(v) => set({ period: STATS_SEARCH.period.read(v) })} className="contents">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="grid gap-0.5">
            <h1 className="text-lg font-semibold">{t('title')}</h1>
            <p className="text-xs text-muted-foreground">{data.since ? t('descriptionSince', { date: dateTime(data.since) }) : t('description')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={city ? String(city.cityId) : ALL_CITIES} onValueChange={(v) => set({ city: v === ALL_CITIES ? null : Number(v) })}>
              <SelectTrigger className="w-56" aria-label={t('city')}>
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
            <TabsList>
              <TabsTrigger value={StatsPeriod.ALL_TIME}>{t('allTime')}</TabsTrigger>
              <TabsTrigger value={StatsPeriod.LAST_7_DAYS}>{t('last7Days')}</TabsTrigger>
            </TabsList>
          </div>
        </header>

        <TabsContent value={period} className="grid gap-4 flex-none text-[length:inherit]">
          <Headline c={c} days={days} trend={trend} />
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <WinsByLevel c={c} />
            <Enemies c={c} />
          </div>
          <div className="grid items-start gap-4 xl:grid-cols-2">
            <Troops c={c} />
            <ResourceFlows c={c} />
          </div>
          <div className="grid items-start gap-4 lg:grid-cols-3">
            <Spending c={c} className="lg:col-span-2" />
            <Growth c={c} playerWide={!city} />
            {!city && <ItemsUsed c={c} className="lg:col-span-3" />}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
