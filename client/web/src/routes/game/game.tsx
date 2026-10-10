import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Crown, UserRound } from 'lucide-react';
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
import { ActivityDock } from '@/components/activity-dock/activity-dock';
import { ArmiesPanel } from '@/components/armies-panel/armies-panel';
import { BuildingsPanel } from '@/components/buildings-panel/buildings-panel';
import { CityDialog } from '@/components/city-dialog/city-dialog';
import { FlowsPanel } from '@/components/flows-panel/flows-panel';
import { StatsPanel } from '@/components/stats-panel/stats-panel';
import { LordDialog } from '@/components/lord-dialog/lord-dialog';
import { ThemeToggle } from '@/components/theme-toggle/theme-toggle';
import { HeroesPanel } from '@/components/heroes-panel/heroes-panel';
import { ItemsPanel } from '@/components/items-panel/items-panel';
import { MapPanel } from '@/components/map-panel/map-panel';
import { MarketPanel } from '@/components/market-panel/market-panel';
import { MilitaryPanel } from '@/components/military-panel/military-panel';
import { ResearchPanel } from '@/components/research-panel/research-panel';
import { useUnreadReports } from '@/components/reports-panel/hooks';
import { ReportsPanel } from '@/components/reports-panel/reports-panel';
import { ResourceBar } from '@/components/resource-bar/resource-bar';
import { mayorOf } from '@/routes/game/utils';
import { useCity, usePlayer, usePushSync } from '@/hooks/use-game';
import { tokenStore } from '@/lib/api';
import { fmt } from '@/lib/format';
import { cn } from '@/lib/utils';
import { MayorSummary } from '@/routes/game/mayor-summary/mayor-summary';
import { MayorChip } from '@/routes/game/mayor-chip/mayor-chip';
import { TABS } from '@/routes/game/constants';

export function GamePage() {
  const params = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const cityId = Number(params.cityId);
  const tab = TABS.some((t) => t.id === params['*']) ? params['*']! : 'buildings';
  const player = usePlayer();
  const city = useCity(cityId);
  const status = usePushSync(true);
  const info = player.data?.playerInfo;
  const cities = player.data?.castles ?? [];
  const [dialog, setDialog] = useState<'lord' | 'city' | null>(null);
  const unreadReports = useUnreadReports().data?.count ?? 0;
  const mayor = city.data && mayorOf(city.data);

  function logout() {
    tokenStore.set(null);
    qc.clear();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-svh bg-muted/30">
      {/* the tab bar sits in the sticky header, so it stays in view while the page scrolls */}
      <Tabs value={tab} onValueChange={(t) => navigate(`/cities/${cityId}/${t}`)} className="contents">
        <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 sm:pt-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="max-w-[60vw] min-w-0 gap-1 px-2 font-semibold sm:max-w-none">
                  <span className="truncate">{city.data?.name ?? cities.find((c) => c.id === cityId)?.name ?? 'City'}</span>
                  <span className="font-normal text-muted-foreground tabular-nums">{city.data && `(${city.data.x},${city.data.y})`}</span>
                  <ChevronDown className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-60">
                <DropdownMenuLabel>Your cities</DropdownMenuLabel>
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
                <DropdownMenuItem onSelect={() => setDialog('city')}>City settings</DropdownMenuItem>
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
                        {info.titleName} {info.userName}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      Prestige {fmt(info.prestige)} · rank {info.ranking || '—'} · honor {fmt(info.honor)}
                    </TooltipContent>
                  </Tooltip>
                  {info.beginner && (
                    <Badge variant="secondary" className="hidden sm:inline-flex">
                      Beginner protection
                    </Badge>
                  )}
                </>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className={cn('size-2 rounded-full', status === 'open' ? 'bg-emerald-500' : status === 'connecting' ? 'bg-amber-500' : 'bg-red-500')}
                    aria-label={`live updates ${status}`}
                  />
                </TooltipTrigger>
                <TooltipContent>Live updates: {status}</TooltipContent>
              </Tooltip>
              <ThemeToggle />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon-sm" variant="ghost" aria-label="Account">
                    <UserRound className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {/* phones: the lord's title and name are shown here instead of in the header */}
                  {info && (
                    <DropdownMenuLabel className="grid gap-0.5 sm:hidden">
                      <span className="flex items-center gap-1">
                        <Crown className="size-4 text-amber-500" />
                        {info.titleName} {info.userName}
                      </span>
                      <span className="text-xs font-normal text-muted-foreground">
                        Prestige {fmt(info.prestige)} · honor {fmt(info.honor)}
                        {info.beginner && ' · beginner protection'}
                      </span>
                    </DropdownMenuLabel>
                  )}
                  {info && <DropdownMenuSeparator className="sm:hidden" />}
                  <DropdownMenuItem onSelect={() => setDialog('lord')}>Player settings</DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a href="/docs" target="_blank" rel="noreferrer">
                      API docs
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={logout}>Log out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="mx-auto max-w-6xl px-4 pb-2 sm:pt-1 sm:pb-3">
            {city.data ? <ResourceBar resource={city.data.resource} mayor={mayor} /> : <Skeleton className="h-5 w-2/3" />}
          </div>
          <nav className="mx-auto max-w-6xl px-4 pb-2 sm:pb-3" aria-label="City tabs">
            <TabsList className="max-w-full justify-start overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {TABS.map((t) => (
                <TabsTrigger key={t.id} value={t.id} className="gap-1.5">
                  {t.label}
                  {t.id === 'reports' && unreadReports > 0 && <Badge className="h-4 min-w-4 px-1 text-[10px] tabular-nums">{unreadReports}</Badge>}
                </TabsTrigger>
              ))}
            </TabsList>
          </nav>
        </header>
        {/* bottom padding leaves room for the floating activity dock */}
        <main className="mx-auto max-w-6xl p-4 pb-24">
          {city.error && <p className="text-sm text-destructive">{city.error.message}</p>}
          {city.isPending && <Skeleton className="h-96" />}
          {city.data && (
            <>
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
            </>
          )}
        </main>
      </Tabs>
      {city.data && <ActivityDock city={city.data} />}
      <LordDialog open={dialog === 'lord'} onClose={() => setDialog(null)} city={city.data} />
      {city.data && <CityDialog city={city.data} open={dialog === 'city'} onClose={() => setDialog(null)} />}
    </div>
  );
}
