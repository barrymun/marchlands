import { useQuery } from '@tanstack/react-query';
import type { CityBean, HeroBean } from '@evony/api-client';
import { BuildingType, HeroStatus } from '@evony/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { qk, useCommand } from '@/hooks/use-game';
import { api, unwrap } from '@/lib/api';
import { fmt } from '@/lib/format';

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
  const mayor = useCommand((heroId: number) => unwrap(api.POST('/api/v1/heroes/{heroId}/mayor', { params: { path: { heroId } } })), refresh, 'Mayor appointed');
  const levelUp = useCommand((heroId: number) => unwrap(api.POST('/api/v1/heroes/{heroId}/level-up', { params: { path: { heroId } } })), refresh, 'Level up!');
  const fire = useCommand((heroId: number) => unwrap(api.POST('/api/v1/heroes/{heroId}/fire', { params: { path: { heroId } } })), refresh, 'Hero dismissed');

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
            <HeroRow key={h.id} hero={h}>
              <Badge variant={h.status === HeroStatus.MAYOR ? 'default' : 'secondary'}>{h.seized ? 'Captive' : (STATUS[h.status] ?? h.status)}</Badge>
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
            {tavern.data?.heros.map((h) => (
              <HeroRow key={h.id} hero={h}>
                <span className="text-xs text-muted-foreground tabular-nums">{fmt(h.level * 1000)} gold</span>
                <Button size="xs" disabled={hire.isPending} onClick={() => hire.mutate(h.id)}>
                  Hire
                </Button>
              </HeroRow>
            ))}
          </CardContent>
        )}
      </Card>
    </div>
  );
}

function HeroRow({ hero, children }: { hero: HeroBean; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
      <div>
        <div className="text-sm font-medium">
          {hero.name} <span className="font-normal text-muted-foreground">Lv {hero.level}</span>
        </div>
        <div className="text-xs text-muted-foreground tabular-nums">
          pol {hero.management} · att {hero.power} · int {hero.stratagem} · loyalty {hero.loyalty}
          {hero.remainPoint > 0 && ` · ${hero.remainPoint} points`}
        </div>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
