import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import type { CityBean } from '@marchlands/api-client';

import { ResourceBar } from '@/components/resource-bar/resource-bar';
import { ThemeToggle } from '@/components/theme-toggle/theme-toggle';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { usePlayer } from '@/hooks/use-game';
import { useGameNav } from '@/hooks/use-game-nav';
import { tokenStore } from '@/lib/api';
import { cn } from '@/lib/utils';
import { VIEWS } from '@/routes/game/constants';
import { MayorChip } from '@/routes/game/mayor-chip/mayor-chip';
import { MayorSummary } from '@/routes/game/mayor-summary/mayor-summary';
import { PlayerSummary } from '@/routes/game/player-summary/player-summary';
import { mayorOf } from '@/routes/game/utils';

/**
 * The top bar: the city (a switcher of all the player's cities), its mayor, the Town · Fields · Map switch, the live
 * updates light, the theme and the account menu. Phones get the resources under it (the sidebar is desktop only).
 */
export function TopBar({ city, status, onDialog }: { city?: CityBean; status: 'open' | 'connecting' | 'closed'; onDialog: (d: 'lord' | 'city') => void }) {
  const { t } = useTranslation(['game', 'common']);
  const nav = useGameNav();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const cities = usePlayer().data?.castles ?? [];
  const mayor = city && mayorOf(city);

  function logout() {
    tokenStore.set(null);
    qc.clear();
    navigate('/login', { replace: true });
  }

  return (
    <header className="z-10 border-b bg-background/95 backdrop-blur">
      <div className="flex items-center gap-x-3 gap-y-2 px-3 py-2 lg:px-6">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="max-w-[55vw] min-w-0 gap-1 px-2 font-semibold sm:max-w-none">
              <span className="truncate">{city?.name ?? cities.find((c) => c.id === nav.cityId)?.name ?? t('cityFallback')}</span>
              <span className="font-normal text-muted-foreground tabular-nums">{city && `(${city.x},${city.y})`}</span>
              <ChevronDown className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-60">
            <DropdownMenuLabel>{t('yourCities')}</DropdownMenuLabel>
            {cities.map((c) => (
              <DropdownMenuItem key={c.id} className="flex-col items-start gap-0.5" onSelect={() => nav.toCity(c.id)}>
                <span className={cn(c.id === nav.cityId && 'font-semibold')}>
                  {c.name}{' '}
                  <span className="text-muted-foreground tabular-nums">
                    ({c.x},{c.y})
                  </span>
                </span>
                <MayorSummary mayor={mayorOf(c.id === nav.cityId && city ? city : c)} />
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onDialog('city')}>{t('citySettings')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {city && (
          <div className="hidden sm:block">
            <MayorChip mayor={mayor} onClick={() => nav.open('heroes')} />
          </div>
        )}
        <nav aria-label={t('viewSwitch')} className="mx-auto hidden gap-1 rounded-lg bg-muted p-1 lg:flex">
          {VIEWS.map((v) => (
            <Button
              key={v.id}
              size="sm"
              variant={nav.screen === v.id ? 'default' : 'ghost'}
              aria-current={nav.screen === v.id ? 'page' : undefined}
              className="h-7 gap-1.5"
              onClick={() => nav.go(v.id)}
            >
              <v.icon className="size-4" />
              {v.label}
            </Button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-x-3 lg:ml-0">
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
              <DropdownMenuLabel className="font-normal">
                <PlayerSummary />
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onDialog('lord')}>{t('account.playerSettings')}</DropdownMenuItem>
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
      <div className="px-3 pb-2 lg:hidden">{city ? <ResourceBar resource={city.resource} mayor={mayor} /> : <Skeleton className="h-5 w-2/3" />}</div>
    </header>
  );
}
