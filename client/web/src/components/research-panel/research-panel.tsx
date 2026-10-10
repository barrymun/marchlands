import { CircleCheck } from 'lucide-react';
import type { CityBean } from '@marchlands/api-client';
import { BALANCE, buildingLevel, BuildingType, heroStratagem, HeroStatus, heroTimeMultiplier, researchHeroExp } from '@marchlands/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TimerBar } from '@/components/timer-bar/timer-bar';
import { CostList } from '@/components/cost-list/cost-list';
import { Requirements } from '@/components/requirements/requirements';
import { qk, useCommand } from '@/hooks/use-game';
import { api, unwrap } from '@/lib/api';
import { STATUS_DONE } from '@/lib/tones';
import { cn } from '@/lib/utils';
import { useResearchList } from '@/components/research-panel/hooks';
import { ResearchJob } from '@/components/research-panel/research-job/research-job';

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
  const townHall = buildingLevel(city.buildings, BuildingType.TOWN_HALL);
  const mayorCut = mayor ? Math.round((1 - heroTimeMultiplier(heroStratagem(mayor), BALANCE.heroTimeFloor.research)) * 1000) / 10 : 0;
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
  // every technology at its maximum level, none still running: nothing left to research
  const allDone = list.data.techs.length > 0 && list.data.techs.every((t) => t.level >= t.maxLevel && !t.upgrading);

  return (
    <div className="grid gap-4">
      {allDone ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <CircleCheck className={cn('size-4', STATUS_DONE)} aria-hidden /> All research complete
            </CardTitle>
            <CardDescription>Every one of the {list.data.techs.length} technologies is at its maximum level.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
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
      )}
      {!allDone && (
        <p className="text-xs text-muted-foreground">
          {mayor
            ? `Research times include mayor ${mayor.name}'s Intelligence ${heroStratagem(mayor)}: −${mayorCut}%. A mayor with higher Intelligence researches faster.`
            : 'No mayor: appoint one with high Intelligence in the Heroes tab to research faster.'}
        </p>
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
                {mayor && (
                  <span className="text-xs text-muted-foreground">
                    Mayor {mayor.name} gains {Math.floor(researchHeroExp(t.typeId, t.level + 1, townHall)).toLocaleString('en')} exp when it completes
                  </span>
                )}
                <Requirements list={t.next.requirements.filter((r) => !r.ok)} />
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
