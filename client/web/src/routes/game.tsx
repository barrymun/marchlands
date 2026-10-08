import { useState } from 'react';
import type { HeroBean } from '@evony/api-client';
import { useNavigate, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Coins, Crown, Landmark, UserRound } from 'lucide-react';
import { HeroStatus } from '@evony/core';
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
import { ActivityDock } from '@/components/activity-dock';
import { ArmiesPanel } from '@/components/armies-panel';
import { BuildingsPanel } from '@/components/buildings-panel';
import { CityDialog } from '@/components/city-dialog';
import { FlowsPanel } from '@/components/flows-panel';
import { LordDialog } from '@/components/lord-dialog';
import { ThemeToggle } from '@/components/theme-toggle';
import { HeroesPanel } from '@/components/heroes-panel';
import { ItemsPanel } from '@/components/items-panel';
import { MapPanel } from '@/components/map-panel';
import { MarketPanel } from '@/components/market-panel';
import { MilitaryPanel } from '@/components/military-panel';
import { ResearchPanel } from '@/components/research-panel';
import { ReportsPanel, useUnreadReports } from '@/components/reports-panel';
import { ResourceBar } from '@/components/resource-bar';
import { useCity, usePlayer, usePushSync } from '@/hooks/use-game';
import { tokenStore } from '@/lib/api';
import { fmt } from '@/lib/format';
import { dominantAttribute, heroAttributeValues } from '@/lib/hero-attributes';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'buildings', label: 'City' },
  { id: 'military', label: 'Military' },
  { id: 'heroes', label: 'Heroes' },
  { id: 'research', label: 'Research' },
  { id: 'items', label: 'Items' },
  { id: 'market', label: 'Market' },
  { id: 'armies', label: 'Armies' },
  { id: 'reports', label: 'Reports' },
  { id: 'map', label: 'Map' },
  { id: 'flows', label: 'Flows' },
] as const;

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
                <DropdownMenuItem onSelect={() => setDialog('city')}>City settings…</DropdownMenuItem>
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
                  <span className="flex items-center gap-1 tabular-nums">
                    <Coins className="size-4 text-amber-500" />
                    {fmt(info.cents)}
                  </span>
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
                  <DropdownMenuItem onSelect={() => setDialog('lord')}>Lord settings…</DropdownMenuItem>
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
              <TabsContent value="map">
                <MapPanel city={city.data} mapSize={player.data?.mapSizeX ?? 800} />
              </TabsContent>
            </>
          )}
        </main>
      </Tabs>
      {city.data && <ActivityDock city={city.data} />}
      <LordDialog open={dialog === 'lord'} onClose={() => setDialog(null)} />
      {city.data && <CityDialog city={city.data} open={dialog === 'city'} onClose={() => setDialog(null)} />}
    </div>
  );
}

function mayorOf(city: { heros: HeroBean[] }): HeroBean | undefined {
  return city.heros.find((h) => h.status === HeroStatus.MAYOR);
}

/** The hero's strongest attribute as a coloured badge (politics green, attack red, intelligence blue). */
function DominantBadge({ hero }: { hero: HeroBean }) {
  const top = dominantAttribute(hero);
  return <span className={cn('rounded px-1 py-px font-semibold tabular-nums', top.tone)}>{`${top.label} ${top.v}`}</span>;
}

/** The city switcher's mayor line: name, then the strongest attribute below it. */
function MayorSummary({ mayor }: { mayor?: HeroBean }) {
  if (!mayor) return <span className="text-xs text-amber-700 dark:text-amber-400">No mayor</span>;
  return (
    <span className="flex flex-col items-start gap-1 text-xs">
      <span className="flex items-center gap-1.5 whitespace-nowrap">
        <Landmark className="size-3 text-muted-foreground" />
        <span className="font-medium">{mayor.name}</span>
      </span>
      <DominantBadge hero={mayor} />
    </span>
  );
}

/** The current city's mayor at a glance; opens the Heroes tab. */
function MayorChip({ mayor, onClick }: { mayor?: HeroBean; onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className={cn('h-7 gap-1.5 px-2 text-xs', !mayor && 'border-amber-500/60 text-amber-700 dark:text-amber-400')}
          onClick={onClick}
        >
          <Landmark className="size-3.5" />
          {mayor ? (
            <>
              <span className="text-muted-foreground">Mayor</span>
              <span className="font-medium">{mayor.name}</span>
              <span className="text-muted-foreground tabular-nums">Lv {mayor.level}</span>
              <DominantBadge hero={mayor} />
            </>
          ) : (
            'No mayor'
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {mayor ? (
          <span className="flex flex-wrap items-center gap-1.5">
            {heroAttributeValues(mayor).map((a) => (
              <span key={a.key} className={cn('rounded px-1 py-px font-semibold tabular-nums', a.tone)}>
                {a.label} {a.v}
              </span>
            ))}
            <span>Politics: production and build speed · Attack: training · Intelligence: research</span>
          </span>
        ) : (
          'Appoint a mayor in the Heroes tab to speed up production, building, training and research.'
        )}
      </TooltipContent>
    </Tooltip>
  );
}
