import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import type { CityBean, HeroBean } from '@evony/api-client';
import { BALANCE, BuildingType, HeroStatus, heroManagement, heroPower, heroStratagem } from '@evony/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HeroPointsDialog } from '@/components/hero-points-dialog';
import { qk, useCommand } from '@/hooks/use-game';
import { api, unwrap } from '@/lib/api';
import { fmt, signed } from '@/lib/format';

const STATUS: Record<number, string> = { [HeroStatus.IDLE]: 'Idle', [HeroStatus.MAYOR]: 'Mayor', [HeroStatus.ATTACK]: 'Marching', [HeroStatus.SEIZED]: 'Captive', [HeroStatus.RETURN]: 'Returning' };

export function HeroesPanel({ city }: { city: CityBean }) {
  const hasInn = city.buildings.some((b) => b.typeId === BuildingType.INN && b.level > 0);
  const tavern = useQuery({
    queryKey: ['tavern', city.id],
    enabled: hasInn,
    queryFn: () => unwrap(api.GET('/api/v1/cities/{cityId}/tavern', { params: { path: { cityId: city.id } } })),
  });
  const refresh = () => [qk.city(city.id), ['tavern', city.id]];
  const hire = useCommand(
    (heroId: number) => unwrap(api.POST('/api/v1/cities/{cityId}/tavern/{heroId}/hire', { params: { path: { cityId: city.id, heroId } } })),
    refresh,
    'Hero hired',
  );
  const reroll = useCommand(
    (payWith: 'gold' | 'item') =>
      unwrap(api.POST('/api/v1/cities/{cityId}/tavern/refresh', { params: { path: { cityId: city.id } }, body: { payWith } })),
    refresh,
    'New heroes at the Inn',
  );
  const mayor = useCommand((heroId: number) => unwrap(api.POST('/api/v1/heroes/{heroId}/mayor', { params: { path: { heroId } } })), refresh, 'Mayor appointed');
  const levelUp = useCommand((heroId: number) => unwrap(api.POST('/api/v1/heroes/{heroId}/level-up', { params: { path: { heroId } } })), refresh, 'Level up!');
  const fire = useCommand((heroId: number) => unwrap(api.POST('/api/v1/heroes/{heroId}/fire', { params: { path: { heroId } } })), refresh, 'Hero dismissed');

  // the mayor's politics adds a percentage of (efficiency-adjusted) field output to every basic resource
  const fieldOutput = (['food', 'wood', 'stone', 'iron'] as const).reduce((sum, r) => sum + city.resource[r].breakdown.fields, 0);
  const mayorPct = (h: HeroBean) => Math.round(heroManagement(h) * BALANCE.mayorManagementProductionFactor * 100);
  const mayorGain = (h: HeroBean) => Math.round(fieldOutput * heroManagement(h) * BALANCE.mayorManagementProductionFactor);
  const currentMayor = city.heros.find((h) => h.status === HeroStatus.MAYOR);
  const [pointsFor, setPointsFor] = useState<number | null>(null);
  const currentGain = currentMayor ? mayorGain(currentMayor) : 0;
  const mayorNote = (h: HeroBean) => {
    if (h.seized) return null;
    if (h.status === HeroStatus.MAYOR) {
      return (
        <span className="text-emerald-600 dark:text-emerald-400">
          Mayor bonus +{mayorPct(h)}% production · {signed(mayorGain(h))}/h
        </span>
      );
    }
    if (h.status !== HeroStatus.IDLE) return null;
    const diff = mayorGain(h) - currentGain;
    return (
      <span>
        As mayor: +{mayorPct(h)}% production · {signed(mayorGain(h))}/h
        {currentMayor && <span className={diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : diff < 0 ? 'text-destructive' : ''}> ({signed(diff)}/h vs {currentMayor.name})</span>}
      </span>
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Your heroes</CardTitle>
          <CardDescription>A Feasting Hall raises how many heroes the city can keep.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {city.heros.length === 0 && <p className="text-sm text-muted-foreground">No heroes yet. Hire one at the Inn.</p>}
          {city.heros.map((h) => (
            <HeroRow key={h.id} hero={h} note={mayorNote(h)}>
              <Badge variant={h.status === HeroStatus.MAYOR ? 'default' : 'secondary'}>{h.seized ? 'Captive' : (STATUS[h.status] ?? h.status)}</Badge>
              {!h.seized && (h.status === HeroStatus.IDLE || h.status === HeroStatus.MAYOR) && (
                <Button size="xs" variant={h.remainPoint > 0 ? 'default' : 'outline'} onClick={() => setPointsFor(h.id)}>
                  Points{h.remainPoint > 0 ? ` (${h.remainPoint})` : ''}
                </Button>
              )}
              {h.experience >= h.upgradeExp && (
                <Button size="xs" onClick={() => levelUp.mutate(h.id)}>
                  Level up
                </Button>
              )}
              {h.status === HeroStatus.IDLE && !h.seized && (
                <>
                  <Button size="xs" variant="outline" onClick={() => mayor.mutate(h.id)}>
                    Make mayor
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => fire.mutate(h.id)}>
                    Dismiss
                  </Button>
                </>
              )}
            </HeroRow>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Inn</CardTitle>
          <CardDescription>{hasInn ? `${tavern.data?.posCount ?? '…'} free hero slots.` : 'Build an Inn to recruit heroes.'}</CardDescription>
        </CardHeader>
        {hasInn && (
          <CardContent className="grid gap-2">
            {tavern.data && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={reroll.isPending || city.resource.gold < tavern.data.refreshCost}
                  onClick={() => reroll.mutate('gold')}
                >
                  <RefreshCw /> New offers ({fmt(tavern.data.refreshCost)} gold)
                </Button>
                {tavern.data.huntingItems > 0 && (
                  <Button size="sm" variant="outline" disabled={reroll.isPending} onClick={() => reroll.mutate('item')}>
                    Use Hero Hunting ({tavern.data.huntingItems})
                  </Button>
                )}
              </div>
            )}
            {tavern.data?.heros.map((h) => (
              <HeroRow key={h.id} hero={h} note={mayorNote(h)}>
                <span className="text-xs text-muted-foreground tabular-nums">{fmt(h.level * 1000)} gold</span>
                <Button size="xs" disabled={hire.isPending} onClick={() => hire.mutate(h.id)}>
                  Hire
                </Button>
              </HeroRow>
            ))}
          </CardContent>
        )}
      </Card>
      <HeroPointsDialog hero={city.heros.find((h) => h.id === pointsFor) ?? null} cityId={city.id} fieldOutput={fieldOutput} onClose={() => setPointsFor(null)} />
    </div>
  );
}

function HeroRow({ hero, note, children }: { hero: HeroBean; note?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
      <div>
        <div className="text-sm font-medium">
          {hero.name} <span className="font-normal text-muted-foreground">Lv {hero.level}</span>
        </div>
        <div className="text-xs text-muted-foreground tabular-nums">
          pol {heroManagement(hero)} · att {heroPower(hero)} · int {heroStratagem(hero)} · loyalty {hero.loyalty}
          {hero.remainPoint > 0 && ` · ${hero.remainPoint} points`}
        </div>
        {note && <div className="text-xs tabular-nums">{note}</div>}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
