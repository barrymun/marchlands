import { CircleCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { type CityBean, getCitiesByCityIdQueryKey, getCitiesResearchQueryKey, postCitiesResearchMutation } from '@marchlands/api-client';
import { BALANCE, buildingLevel, BuildingType, HeroStatus, heroStratagem, heroTimeMultiplier, researchHeroExp } from '@marchlands/core';

import { CostList } from '@/components/cost-list/cost-list';
import { Requirements } from '@/components/requirements/requirements';
import { useResearchList } from '@/components/research-panel/hooks';
import { ResearchJob } from '@/components/research-panel/research-job/research-job';
import { unlockName } from '@/components/research-panel/utils';
import { TimerBar } from '@/components/timer-bar/timer-bar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCommand } from '@/hooks/use-game';
import { fmtExact, percent } from '@/lib/format';
import { techName } from '@/lib/game-data';
import { translateMessage } from '@/lib/messages';
import { STATUS_DONE } from '@/lib/tones';
import { cn } from '@/lib/utils';

export function ResearchPanel({ city }: { city: CityBean }) {
  const { t } = useTranslation(['research-panel', 'common']);
  const path = { cityId: city.id };
  const list = useResearchList(city.id);
  const refresh = () => [getCitiesResearchQueryKey({ path }), getCitiesByCityIdQueryKey({ path })];
  const start = useCommand(postCitiesResearchMutation(), refresh, t('started'));
  if (list.isPending) return <Skeleton className="h-64" />;
  if (!list.data) return null;
  if (list.data.academyLevel === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t('title')}</CardTitle>
          <CardDescription>{t('needsAcademy')}</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  const mayor = city.heros.find((h) => h.status === HeroStatus.MAYOR);
  const townHall = buildingLevel(city.buildings, BuildingType.TOWN_HALL);
  const mayorCut = mayor ? percent(1 - heroTimeMultiplier(heroStratagem(mayor), BALANCE.heroTimeFloor.research), 1) : '';
  const have = {
    gold: city.resource.gold,
    food: city.resource.food.amount,
    wood: city.resource.wood.amount,
    stone: city.resource.stone.amount,
    iron: city.resource.iron.amount,
  };
  const here = list.data.techs.filter((tech) => tech.upgrading && tech.castleId === city.id);
  const elsewhere = list.data.techs.filter((tech) => tech.upgrading && tech.castleId !== city.id);
  const full = here.length >= list.data.slots;
  // every technology at its maximum level, none still running: nothing left to research
  const allDone = list.data.techs.length > 0 && list.data.techs.every((tech) => tech.level >= tech.maxLevel && !tech.upgrading);

  return (
    <div className="grid gap-4">
      {allDone ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <CircleCheck className={cn('size-4', STATUS_DONE)} aria-hidden /> {t('allDone.title')}
            </CardTitle>
            <CardDescription>{t('allDone.description', { total: list.data.techs.length })}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t('academy.title', { busy: here.length, slots: list.data.slots })}</CardTitle>
            <CardDescription>{full ? t('academy.full') : t('academy.slots', { count: list.data.slots })}</CardDescription>
          </CardHeader>
          {(here.length > 0 || elsewhere.length > 0) && (
            <CardContent className="grid gap-4">
              {here.map((tech) => (
                <ResearchJob key={tech.typeId} city={city} tech={tech} />
              ))}
              {elsewhere.map((tech) => (
                <div key={tech.typeId} className="grid gap-1">
                  <span className="text-sm">
                    {t('job.progress', { name: techName(tech.typeId), level: tech.level + 1 })}{' '}
                    <span className="text-muted-foreground">{t('job.elsewhere')}</span>
                  </span>
                  <TimerBar startTime={tech.startTime} endTime={tech.endTime} />
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}
      {!allDone && (
        <p className="text-xs text-muted-foreground">
          {mayor ? t('mayor.hint', { name: mayor.name, intelligence: heroStratagem(mayor), cut: mayorCut }) : t('mayor.none')}
        </p>
      )}
      <div className="grid gap-2 md:grid-cols-2">
        {list.data.techs.map((tech) => (
          <div key={tech.typeId} className="grid gap-2 rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">
                {techName(tech.typeId)} <Badge variant="secondary">{t('common:level.ofMax', { level: tech.level, max: tech.maxLevel })}</Badge>
                {tech.effectiveLevel < tech.level && (
                  <span className="ml-1 text-xs text-muted-foreground">{t('tech.effective', { level: tech.effectiveLevel })}</span>
                )}
              </span>
              {tech.next && (
                <Button size="sm" disabled={!tech.permission || start.isPending} onClick={() => start.mutate({ path, body: { techId: tech.typeId } })}>
                  {t('tech.research')}
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{translateMessage(tech.description)}</p>
            {(tech.effect || tech.nextEffect) && (
              <div className="grid gap-0.5 text-xs">
                {tech.effect && (
                  <span>
                    <span className="text-muted-foreground">{t('common:level.now')}</span> {translateMessage(tech.effect)}
                    {tech.effectiveLevel < tech.level && <span className="text-muted-foreground">{t('tech.capped', { level: list.data.academyLevel })}</span>}
                  </span>
                )}
                {tech.nextEffect && (
                  <span>
                    <span className="text-muted-foreground">{t('common:level.next', { level: tech.level + 1 })}</span>{' '}
                    <span className="text-emerald-600 dark:text-emerald-400">{translateMessage(tech.nextEffect)}</span>
                    {tech.level + 1 > list.data.academyLevel && (
                      <span className="text-muted-foreground">{t('tech.needsAcademy', { level: tech.level + 1 })}</span>
                    )}
                  </span>
                )}
              </div>
            )}
            {tech.unlocks.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {t('common:level.unlocks', {
                  list: tech.unlocks.map((u) => t('common:level.namedParens', { name: unlockName(u), level: u.level })).join(t('common:list.separator')),
                })}
              </p>
            )}
            {tech.next && (
              <>
                <CostList cost={tech.next} seconds={tech.next.time} have={have} />
                {mayor && (
                  <span className="text-xs text-muted-foreground">
                    {t('common:level.mayorExp', { name: mayor.name, exp: fmtExact(researchHeroExp(tech.typeId, tech.level + 1, townHall)) })}
                  </span>
                )}
                <Requirements list={tech.next.requirements.filter((r) => !r.ok)} />
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
