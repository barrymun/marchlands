import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Crown, UserRound } from 'lucide-react';
import { Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';

import { ActivityDock } from '@/components/activity-dock/activity-dock';
import { BuildingsPanel } from '@/components/buildings-panel/buildings-panel';
import { CityDialog } from '@/components/city-dialog/city-dialog';
import { LordDialog } from '@/components/lord-dialog/lord-dialog';
import { useUnreadReports } from '@/components/reports-panel/hooks';
import { ResourceBar } from '@/components/resource-bar/resource-bar';
import { ThemeToggle } from '@/components/theme-toggle/theme-toggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useCity, usePlayer, usePushSync } from '@/hooks/use-game';
import { errorMessage, tokenStore } from '@/lib/api';
import { fmt } from '@/lib/format';
import { titleName } from '@/lib/game-data';
import { cn } from '@/lib/utils';
import {
  ArmiesPanel,
  FlowsPanel,
  HeroesPanel,
  ItemsPanel,
  MapPanel,
  MarketPanel,
  MilitaryPanel,
  ReportsPanel,
  ResearchPanel,
  StatsPanel,
  TABS,
} from '@/routes/game/constants';
import { usePreloadPanels } from '@/routes/game/hooks';
import { MayorChip } from '@/routes/game/mayor-chip/mayor-chip';
import { MayorSummary } from '@/routes/game/mayor-summary/mayor-summary';
import { mayorOf } from '@/routes/game/utils';

export function GamePage() {
  const { t } = useTranslation(['game', 'common']);
  const params = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const cityId = Number(params.cityId);
  const tab = TABS.some((x) => x.id === params['*']) ? params['*']! : 'buildings';
  const player = usePlayer();
  const city = useCity(cityId);
  const status = usePushSync(true);
  const info = player.data?.playerInfo;
  const cities = player.data?.castles ?? [];
  const [dialog, setDialog] = useState<'lord' | 'city' | null>(null);
  const unreadReports = useUnreadReports().data?.count ?? 0;
  const mayor = city.data && mayorOf(city.data);
  usePreloadPanels();

  function logout() {
    tokenStore.set(null);
    qc.clear();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-svh bg-muted/30">
      {/* the tab bar sits in the sticky header, so it stays in view while the page scrolls */}
      <Tabs value={tab} onValueChange={(v) => navigate(`/cities/${cityId}/${v}`)} className="contents">
        <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 sm:pt-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="max-w-[60vw] min-w-0 gap-1 px-2 font-semibold sm:max-w-none">
                  <span className="truncate">{city.data?.name ?? cities.find((c) => c.id === cityId)?.name ?? t('cityFallback')}</span>
                  <span className="font-normal text-muted-foreground tabular-nums">{city.data && `(${city.data.x},${city.data.y})`}</span>
                  <ChevronDown className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-60">
                <DropdownMenuLabel>{t('yourCities')}</DropdownMenuLabel>
                {cities.map((c) => (
                  <DropdownMenuItem key={c.id} className="flex-col items-start gap-0.5" onSelect={() => navigate(`/cities/${c.id}/${tab}`)}>
                    <span className={cn(c.id === cityId && 'font-semibold')}>
                      {c.name}{' '}
                      <span className="text-muted-foreground tabular-nums">
                        ({c.x},{c.y})
                      </span>
                    </span>
                    <MayorSummary mayor={mayorOf(c.id === cityId && city.data ? city.data : c)} />
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setDialog('city')}>{t('citySettings')}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {/* phones: the mayor gets its own row under the city and the account controls */}
            {city.data && (
              <div className="order-last w-full sm:order-none sm:w-auto">
                <MayorChip mayor={mayor} onClick={() => navigate(`/cities/${cityId}/heroes`)} />
              </div>
            )}
            <div className="ml-auto flex min-w-0 items-center justify-end gap-x-3 gap-y-1 text-sm sm:flex-wrap sm:gap-x-4">
              {info && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="hidden items-center gap-1 sm:flex">
                        <Crown className="size-4 text-amber-500" />
                        {t('titledName', { title: titleName(info.titleId), name: info.userName })}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{t('playerStats', { prestige: fmt(info.prestige), rank: info.ranking || '—', honor: fmt(info.honor) })}</TooltipContent>
                  </Tooltip>
                  {info.beginner && (
                    <Badge variant="secondary" className="hidden sm:inline-flex">
                      {t('beginnerProtection')}
                    </Badge>
                  )}
                </>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className={cn('size-2 rounded-full', status === 'open' ? 'bg-emerald-500' : status === 'connecting' ? 'bg-amber-500' : 'bg-red-500')}
                    aria-label={t('liveUpdates.aria', { status: t(`liveUpdates.status.${status}`) })}
                  />
                </TooltipTrigger>
                <TooltipContent>{t('liveUpdates.tooltip', { status: t(`liveUpdates.status.${status}`) })}</TooltipContent>
              </Tooltip>
              <ThemeToggle />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon-sm" variant="ghost" aria-label={t('account.label')}>
                    <UserRound className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {/* phones: the lord's title and name are shown here instead of in the header */}
                  {info && (
                    <DropdownMenuLabel className="grid gap-0.5 sm:hidden">
                      <span className="flex items-center gap-1">
                        <Crown className="size-4 text-amber-500" />
                        {t('titledName', { title: titleName(info.titleId), name: info.userName })}
                      </span>
                      <span className="text-xs font-normal text-muted-foreground">
                        {t(info.beginner ? 'account.statsBeginner' : 'account.stats', { prestige: fmt(info.prestige), honor: fmt(info.honor) })}
                      </span>
                    </DropdownMenuLabel>
                  )}
                  {info && <DropdownMenuSeparator className="sm:hidden" />}
                  <DropdownMenuItem onSelect={() => setDialog('lord')}>{t('account.playerSettings')}</DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a href="/docs" target="_blank" rel="noreferrer">
                      {t('account.apiDocs')}
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={logout}>{t('common:actions.logOut')}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="mx-auto max-w-6xl px-4 pb-2 sm:pt-1 sm:pb-3">
            {city.data ? <ResourceBar resource={city.data.resource} mayor={mayor} /> : <Skeleton className="h-5 w-2/3" />}
          </div>
          <nav className="mx-auto max-w-6xl px-4 pb-2 sm:pb-3" aria-label={t('cityTabs')}>
            <TabsList className="max-w-full justify-start overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {TABS.map((x) => (
                <TabsTrigger key={x.id} value={x.id} className="gap-1.5">
                  {x.label}
                  {x.id === 'reports' && unreadReports > 0 && <Badge className="h-4 min-w-4 px-1 text-[10px] tabular-nums">{unreadReports}</Badge>}
                </TabsTrigger>
              ))}
            </TabsList>
          </nav>
        </header>
        {/* bottom padding leaves room for the floating activity dock */}
        <main className="mx-auto max-w-6xl p-4 pb-24">
          {city.error && <p className="text-sm text-destructive">{errorMessage(city.error)}</p>}
          {city.isPending && <Skeleton className="h-96" />}
          {city.data && (
            // a tab whose code hasn't arrived yet shows the same placeholder as a city still loading
            <Suspense fallback={<Skeleton className="h-96" />}>
              <TabsContent value="buildings">
                <BuildingsPanel city={city.data} />
              </TabsContent>
              <TabsContent value="military">
                <MilitaryPanel city={city.data} />
              </TabsContent>
              <TabsContent value="heroes">
                <HeroesPanel city={city.data} />
              </TabsContent>
              <TabsContent value="research">
                <ResearchPanel city={city.data} />
              </TabsContent>
              <TabsContent value="items">
                <ItemsPanel city={city.data} />
              </TabsContent>
              <TabsContent value="market">
                <MarketPanel city={city.data} />
              </TabsContent>
              <TabsContent value="armies">
                <ArmiesPanel />
              </TabsContent>
              <TabsContent value="reports">
                <ReportsPanel />
              </TabsContent>
              <TabsContent value="flows">
                <FlowsPanel city={city.data} />
              </TabsContent>
              <TabsContent value="stats">
                <StatsPanel />
              </TabsContent>
              <TabsContent value="map">
                <MapPanel city={city.data} mapSize={player.data?.mapSizeX ?? 800} />
              </TabsContent>
            </Suspense>
          )}
        </main>
      </Tabs>
      {city.data && <ActivityDock city={city.data} />}
      <LordDialog open={dialog === 'lord'} onClose={() => setDialog(null)} city={city.data} />
      {city.data && <CityDialog city={city.data} open={dialog === 'city'} onClose={() => setDialog(null)} />}
    </div>
  );
}
