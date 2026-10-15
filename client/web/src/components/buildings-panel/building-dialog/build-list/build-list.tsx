import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { type CityBean, getCitiesBuildingsAvailableOptions, getCitiesByCityIdQueryKey, postCitiesBuildingsMutation } from '@marchlands/api-client';
import { BuildingType } from '@marchlands/core';

import { areaOf } from '@/components/buildings-panel/building-dialog/build-list/utils';
import { MayorBuildExp } from '@/components/buildings-panel/building-dialog/mayor-build-exp/mayor-build-exp';
import { MayorBuildHint } from '@/components/buildings-panel/building-dialog/mayor-build-hint/mayor-build-hint';
import { Unlocks } from '@/components/buildings-panel/building-dialog/unlocks/unlocks';
import { CostList } from '@/components/cost-list/cost-list';
import { Requirements } from '@/components/requirements/requirements';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useCommand } from '@/hooks/use-game';
import { buildingName } from '@/lib/game-data';
import { translateMessage } from '@/lib/messages';

export function BuildList({ city, positionId, onDone }: { city: CityBean; positionId: number; onDone: () => void }) {
  const { t } = useTranslation('buildings-panel');
  const area = areaOf(positionId);
  const list = useQuery(getCitiesBuildingsAvailableOptions({ path: { cityId: city.id }, query: { area } }));
  const build = useCommand(postCitiesBuildingsMutation(), () => [getCitiesByCityIdQueryKey({ path: { cityId: city.id } })], t('buildList.started'));
  const options = (list.data?.buildings ?? []).filter((b) => b != null).filter((b) => (positionId === -1 ? b.typeId === BuildingType.TOWN_HALL : true));
  const have = {
    gold: city.resource.gold,
    food: city.resource.food.amount,
    wood: city.resource.wood.amount,
    stone: city.resource.stone.amount,
    iron: city.resource.iron.amount,
  };
  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('buildList.title')}</DialogTitle>
        <DialogDescription>{area === 'outside' ? t('buildList.outside') : t('buildList.inside')}</DialogDescription>
      </DialogHeader>
      <MayorBuildHint city={city} />
      {list.isPending && <Skeleton className="h-32" />}
      <div className="grid gap-2">
        {options.map((b) => (
          <div key={b.typeId} className="grid gap-2 rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{buildingName(b.typeId)}</span>
              <Button
                size="sm"
                disabled={!b.ok || build.isPending}
                onClick={() => build.mutate({ path: { cityId: city.id }, body: { typeId: b.typeId, positionId } }, { onSuccess: onDone })}
              >
                {t('buildList.build')}
              </Button>
            </div>
            {b.info.summary && <p className="text-sm text-muted-foreground">{translateMessage(b.info.summary)}</p>}
            {b.effect && (
              <p className="text-xs">
                <span className="text-muted-foreground">{t('buildList.firstLevel')}</span>{' '}
                <span className="text-emerald-600 dark:text-emerald-400">{translateMessage(b.effect)}</span>
              </p>
            )}
            <Unlocks list={b.info.unlocks} />
            <CostList cost={b} seconds={b.time} have={have} />
            <MayorBuildExp city={city} typeId={b.typeId} level={1} />
            <Requirements list={b.requirements.filter((r) => !r.ok)} />
          </div>
        ))}
        {list.data && options.length === 0 && <p className="text-sm text-muted-foreground">{t('buildList.nothing')}</p>}
      </div>
    </>
  );
}
