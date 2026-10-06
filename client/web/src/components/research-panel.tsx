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
  const list = useResearchList(city.id);
  const refresh = () => [qk.research(city.id), qk.city(city.id)];
  const start = useCommand(
    (techId: number) => unwrap(api.POST('/api/v1/cities/{cityId}/research', { params: { path }, body: { techId } })),
    refresh,
    'Research started',
  );
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
  const have = {
    gold: city.resource.gold,
    food: city.resource.food.amount,
    wood: city.resource.wood.amount,
    stone: city.resource.stone.amount,
    iron: city.resource.iron.amount,
  };
  const here = list.data.techs.filter((t) => t.upgrading && t.castleId === city.id);
  const elsewhere = list.data.techs.filter((t) => t.upgrading && t.castleId !== city.id);
  const full = here.length >= list.data.slots;

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            Academy · researching {here.length}/{list.data.slots}
          </CardTitle>
          <CardDescription>
            {full
              ? 'Every research slot is busy: wait for one to finish or speed it up.'
              : `This city can research ${list.data.slots} technologies at the same time.`}
          </CardDescription>
        </CardHeader>
        {(here.length > 0 || elsewhere.length > 0) && (
          <CardContent className="grid gap-4">
            {here.map((t) => (
              <ResearchJob key={t.typeId} city={city} tech={t} />
            ))}
            {elsewhere.map((t) => (
              <div key={t.typeId} className="grid gap-1">
                <span className="text-sm">
                  {t.name} → Lv {t.level + 1} <span className="text-muted-foreground">(in another city)</span>
                </span>
                <TimerBar startTime={t.startTime} endTime={t.endTime} />
              </div>
            ))}
          </CardContent>
        )}
      </Card>
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
                <Button size="sm" disabled={!t.permission || start.isPending} onClick={() => start.mutate(t.typeId)}>
                  Research
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{t.description}</p>
            {(t.effect || t.nextEffect) && (
              <div className="grid gap-0.5 text-xs">
                {t.effect && (
                  <span>
                    <span className="text-muted-foreground">Now:</span> {t.effect}
                    {t.effectiveLevel < t.level && <span className="text-muted-foreground"> (capped by Academy Lv {list.data!.academyLevel})</span>}
                  </span>
                )}
                {t.nextEffect && (
                  <span>
                    <span className="text-muted-foreground">Lv {t.level + 1}:</span>{' '}
                    <span className="text-emerald-600 dark:text-emerald-400">{t.nextEffect}</span>
                    {t.level + 1 > list.data!.academyLevel && <span className="text-muted-foreground"> (needs Academy Lv {t.level + 1} to take effect)</span>}
                  </span>
                )}
              </div>
            )}
            {t.unlocks.length > 0 && <p className="text-xs text-muted-foreground">Unlocks: {t.unlocks.map((u) => `${u.name} (Lv ${u.level})`).join(', ')}</p>}
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

type Tech = NonNullable<ReturnType<typeof useResearchList>['data']>['techs'][number];
const useResearchList = (cityId: number) =>
  useQuery({ queryKey: qk.research(cityId), queryFn: () => unwrap(api.GET('/api/v1/cities/{cityId}/research', { params: { path: { cityId } } })) });

/** One running research in this city: progress, speed-ups and cancel. */
function ResearchJob({ city, tech }: { city: CityBean; tech: Tech }) {
  const path = { cityId: city.id };
  const techId = tech.typeId;
  const refresh = () => [qk.research(city.id), qk.city(city.id)];
  const cancel = useCommand(
    () => unwrap(api.DELETE('/api/v1/cities/{cityId}/research', { params: { path, query: { techId } } })),
    refresh,
    `${tech.name} research cancelled`,
  );
  const speedup = useCommand(
    (itemId: string) => unwrap(api.POST('/api/v1/cities/{cityId}/research/speedup', { params: { path }, body: { itemId, techId } })),
    () => [...refresh(), qk.player],
  );
  const coins = useQuery({
    queryKey: ['research-speedup-cost', city.id, techId, tech.endTime],
    refetchInterval: 15_000,
    queryFn: () => unwrap(api.GET('/api/v1/cities/{cityId}/research/speedup', { params: { path, query: { techId } } })),
  });
  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium">
        {tech.name} → Lv {tech.level + 1}
      </span>
      <TimerBar startTime={tech.startTime} endTime={tech.endTime} />
      <SpeedupOptions endTime={tech.endTime} coinsNeed={coins.data?.coinsNeed} pending={speedup.isPending} onUse={(itemId) => speedup.mutate(itemId)} />
      <Button size="sm" variant="outline" className="justify-self-start" onClick={() => cancel.mutate(undefined)}>
        Cancel
      </Button>
    </div>
  );
}
