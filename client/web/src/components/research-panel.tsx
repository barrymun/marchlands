import { useQuery } from '@tanstack/react-query';
import type { CityBean } from '@evony/api-client';
import { heroStratagem, HeroStatus } from '@evony/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TimerBar } from '@/components/countdown';
import { CostList, Requirements } from '@/components/cost-list';
import { SpeedupOptions } from '@/components/speedup-options';
import { qk, useCommand } from '@/hooks/use-game';
import { api, unwrap } from '@/lib/api';

export function ResearchPanel({ city }: { city: CityBean }) {
  const path = { cityId: city.id };
  const list = useQuery({ queryKey: qk.research(city.id), queryFn: () => unwrap(api.GET('/api/v1/cities/{cityId}/research', { params: { path } })) });
  const refresh = () => [qk.research(city.id), qk.city(city.id)];
  const start = useCommand((techId: number) => unwrap(api.POST('/api/v1/cities/{cityId}/research', { params: { path }, body: { techId } })), refresh, 'Research started');
  const cancel = useCommand(() => unwrap(api.DELETE('/api/v1/cities/{cityId}/research', { params: { path } })), refresh, 'Research cancelled');
  const speedup = useCommand(
    (itemId: string) => unwrap(api.POST('/api/v1/cities/{cityId}/research/speedup', { params: { path }, body: { itemId } })),
    () => [...refresh(), qk.player],
  );
  const researching = list.data?.techs.find((t) => t.upgrading && t.castleId === city.id);
  const coins = useQuery({
    queryKey: ['research-speedup-cost', city.id, researching?.endTime],
    enabled: !!researching,
    refetchInterval: 15_000,
    queryFn: () => unwrap(api.GET('/api/v1/cities/{cityId}/research/speedup', { params: { path } })),
  });

  if (list.isPending) return <Skeleton className="h-64" />;
  if (!list.data) return null;
  if (list.data.academyLevel === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Research</CardTitle>
          <CardDescription>Build an Academy to research technologies.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  const mayor = city.heros.find((h) => h.status === HeroStatus.MAYOR);
  const mayorCut = mayor ? Math.round((1 - Math.pow(0.995, heroStratagem(mayor))) * 1000) / 10 : 0;
  const have = { gold: city.resource.gold, food: city.resource.food.amount, wood: city.resource.wood.amount, stone: city.resource.stone.amount, iron: city.resource.iron.amount };
  const busy = list.data.techs.find((t) => t.upgrading);

  return (
    <div className="grid gap-4">
      {busy && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Researching {busy.name} → Lv {busy.level + 1}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <TimerBar startTime={busy.startTime} endTime={busy.endTime} />
            {busy.castleId === city.id && (
              <>
                <SpeedupOptions endTime={busy.endTime} coinsNeed={coins.data?.coinsNeed} pending={speedup.isPending} onUse={(itemId) => speedup.mutate(itemId)} />
                <Button size="sm" variant="outline" className="justify-self-start" onClick={() => cancel.mutate(undefined)}>
                  Cancel
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
      <p className="text-xs text-muted-foreground">
        {mayor
          ? `Research times include mayor ${mayor.name}'s Intelligence ${heroStratagem(mayor)}: −${mayorCut}%. A mayor with higher Intelligence researches faster.`
          : 'No mayor: appoint one with high Intelligence in the Heroes tab to research faster.'}
      </p>
      <div className="grid gap-2 md:grid-cols-2">
        {list.data.techs.map((t) => (
          <div key={t.typeId} className="grid gap-2 rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">
                {t.name}{' '}
                <Badge variant="secondary">
                  Lv {t.level}/{t.maxLevel}
                </Badge>
                {t.effectiveLevel < t.level && <span className="ml-1 text-xs text-muted-foreground">(effective {t.effectiveLevel})</span>}
              </span>
              {t.next && (
                <Button size="sm" disabled={!t.permission || !!busy || start.isPending} onClick={() => start.mutate(t.typeId)}>
                  Research
                </Button>
              )}
            </div>
            {t.next && (
              <>
                <CostList cost={t.next} seconds={t.next.time} have={have} />
                <Requirements list={t.next.requirements.filter((r) => !r.ok)} />
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
