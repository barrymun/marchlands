import { useQuery } from '@tanstack/react-query';
import type { CityBean } from '@evony/api-client';
import { BALANCE, scaled } from '@evony/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TimerBar } from '@/components/countdown';
import { CostList, Requirements } from '@/components/cost-list';
import { qk, useCommand } from '@/hooks/use-game';
import { useNow } from '@/hooks/use-now';
import { api, unwrap } from '@/lib/api';

export function ResearchPanel({ city }: { city: CityBean }) {
  const now = useNow();
  const path = { cityId: city.id };
  const list = useQuery({ queryKey: qk.research(city.id), queryFn: () => unwrap(api.GET('/api/v1/cities/{cityId}/research', { params: { path } })) });
  const refresh = () => [qk.research(city.id), qk.city(city.id)];
  const start = useCommand((techId: number) => unwrap(api.POST('/api/v1/cities/{cityId}/research', { params: { path }, body: { techId } })), refresh, 'Research started');
  const cancel = useCommand(() => unwrap(api.DELETE('/api/v1/cities/{cityId}/research', { params: { path } })), refresh, 'Research cancelled');
  const speedup = useCommand(() => unwrap(api.POST('/api/v1/cities/{cityId}/research/speedup', { params: { path }, body: { itemId: 'free.speed' } })), refresh);

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
              <div className="flex gap-2">
                <Button size="sm" disabled={busy.endTime - now > scaled(BALANCE.freeSpeedupMs)} onClick={() => speedup.mutate(undefined)}>
                  Finish now (free)
                </Button>
                <Button size="sm" variant="outline" onClick={() => cancel.mutate(undefined)}>
                  Cancel
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
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
