import { useQuery } from '@tanstack/react-query';
import type { CityBean } from '@marchlands/api-client';
import { BuildingType } from '@marchlands/core';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { CostList } from '@/components/cost-list/cost-list';
import { Requirements } from '@/components/requirements/requirements';
import { qk, useCommand } from '@/hooks/use-game';
import { api, unwrap } from '@/lib/api';
import { buildingName } from '@/lib/format';
import { areaOf } from '@/components/buildings-panel/building-dialog/build-list/utils';
import { MayorBuildHint } from '@/components/buildings-panel/building-dialog/mayor-build-hint/mayor-build-hint';
import { MayorBuildExp } from '@/components/buildings-panel/building-dialog/mayor-build-exp/mayor-build-exp';
import { Unlocks } from '@/components/buildings-panel/building-dialog/unlocks/unlocks';

export function BuildList({ city, positionId, onDone }: { city: CityBean; positionId: number; onDone: () => void }) {
  const area = areaOf(positionId);
  const list = useQuery({
    queryKey: qk.available(city.id, area),
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/cities/{cityId}/buildings/available', {
          params: { path: { cityId: city.id }, query: { area } },
        }),
      ),
  });
  const build = useCommand(
    (typeId: number) =>
      unwrap(
        api.POST('/api/v1/cities/{cityId}/buildings', {
          params: { path: { cityId: city.id } },
          body: { typeId, positionId },
        }),
      ),
    () => [qk.city(city.id)],
    'Construction started',
  );
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
        <DialogTitle>Build</DialogTitle>
        <DialogDescription>{area === 'outside' ? 'Resource fields outside the walls.' : 'Buildings inside the walls.'}</DialogDescription>
      </DialogHeader>
      <MayorBuildHint city={city} />
      {list.isPending && <Skeleton className="h-32" />}
      <div className="grid gap-2">
        {options.map((b) => (
          <div key={b.typeId} className="grid gap-2 rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{buildingName(b.typeId)}</span>
              <Button size="sm" disabled={!b.ok || build.isPending} onClick={() => build.mutate(b.typeId, { onSuccess: onDone })}>
                Build
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">{b.info.summary}</p>
            {b.effect && (
              <p className="text-xs">
                <span className="text-muted-foreground">Lv 1:</span> <span className="text-emerald-600 dark:text-emerald-400">{b.effect}</span>
              </p>
            )}
            <Unlocks list={b.info.unlocks} />
            <CostList cost={b} seconds={b.time} have={have} />
            <MayorBuildExp city={city} typeId={b.typeId} level={1} />
            <Requirements list={b.requirements.filter((r) => !r.ok)} />
          </div>
        ))}
        {list.data && options.length === 0 && <p className="text-sm text-muted-foreground">Nothing can be built here right now.</p>}
      </div>
    </>
  );
}
