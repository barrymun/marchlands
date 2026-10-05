import { useNavigate, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Coins, Crown, LogOut } from 'lucide-react';
import { HeroStatus } from '@evony/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ArmiesPanel } from '@/components/armies-panel';
import { BuildingsPanel } from '@/components/buildings-panel';
import { HeroesPanel } from '@/components/heroes-panel';
import { ItemsPanel } from '@/components/items-panel';
import { MapPanel } from '@/components/map-panel';
import { MilitaryPanel } from '@/components/military-panel';
import { ResearchPanel } from '@/components/research-panel';
import { ResourceBar } from '@/components/resource-bar';
import { useCity, usePlayer, usePushSync } from '@/hooks/use-game';
import { tokenStore } from '@/lib/api';
import { fmt } from '@/lib/format';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'buildings', label: 'City' },
  { id: 'military', label: 'Military' },
  { id: 'heroes', label: 'Heroes' },
  { id: 'research', label: 'Research' },
  { id: 'items', label: 'Items' },
  { id: 'armies', label: 'Armies' },
  { id: 'map', label: 'Map' },
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

  function logout() {
    tokenStore.set(null);
    qc.clear();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-svh bg-muted/30">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-1 px-2 font-semibold">
                {city.data?.name ?? cities.find((c) => c.id === cityId)?.name ?? 'City'}
                <span className="font-normal text-muted-foreground tabular-nums">{city.data && `(${city.data.x},${city.data.y})`}</span>
                <ChevronDown className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Your cities</DropdownMenuLabel>
              {cities.map((c) => (
                <DropdownMenuItem key={c.id} onSelect={() => navigate(`/cities/${c.id}/${tab}`)}>
                  {c.name} ({c.x},{c.y})
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="ml-auto flex items-center gap-3 text-sm">
            {info && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex items-center gap-1">
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
                {info.beginner && <Badge variant="secondary">Beginner protection</Badge>}
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon-sm" variant="ghost" aria-label="Account">
                  <LogOut className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
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
        <div className="mx-auto max-w-6xl px-4 pb-2">{city.data ? <ResourceBar resource={city.data.resource} mayor={city.data.heros.find((h) => h.status === HeroStatus.MAYOR)} /> : <Skeleton className="h-5 w-2/3" />}</div>
      </header>
      <main className="mx-auto max-w-6xl p-4">
        <Tabs value={tab} onValueChange={(t) => navigate(`/cities/${cityId}/${t}`)}>
          <TabsList className="mb-4 flex-wrap">
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
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
              <TabsContent value="armies">
                <ArmiesPanel />
              </TabsContent>
              <TabsContent value="map">
                <MapPanel city={city.data} mapSize={player.data?.mapSizeX ?? 800} />
              </TabsContent>
            </>
          )}
        </Tabs>
      </main>
    </div>
  );
}
