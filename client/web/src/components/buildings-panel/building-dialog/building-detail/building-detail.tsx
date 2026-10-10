import { useQuery } from '@tanstack/react-query';
import { CircleCheck } from 'lucide-react';
import {
  getCitiesBuildingsByPositionIdOptions,
  getCitiesBuildingsByPositionIdQueryKey,
  getCitiesBuildingsSpeedupOptions,
  getCitiesBuildingsSpeedupQueryKey,
  getCitiesByCityIdQueryKey,
  getPlayerQueryKey,
  postCitiesBuildingsCancelMutation,
  postCitiesBuildingsDemolishMutation,
  postCitiesBuildingsSpeedupMutation,
  postCitiesBuildingsUpgradeMutation,
  type BuildingBean,
  type CityBean,
} from '@marchlands/api-client';
import { BALANCE } from '@marchlands/core';
import { Badge } from '@/components/ui/badge';
import { ConfirmButton } from '@/components/confirm-button/confirm-button';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { TimerBar } from '@/components/timer-bar/timer-bar';
import { CostList } from '@/components/cost-list/cost-list';
import { Requirements } from '@/components/requirements/requirements';
import { SpeedupOptions } from '@/components/speedup-options/speedup-options';
import { useCommand } from '@/hooks/use-game';
import { buildingName } from '@/lib/format';
import { STATUS_DONE } from '@/lib/tones';
import { cn } from '@/lib/utils';
import { refundText } from '@/components/buildings-panel/building-dialog/building-detail/utils';
import { MayorBuildHint } from '@/components/buildings-panel/building-dialog/mayor-build-hint/mayor-build-hint';
import { MayorBuildExp } from '@/components/buildings-panel/building-dialog/mayor-build-exp/mayor-build-exp';
import { Unlocks } from '@/components/buildings-panel/building-dialog/unlocks/unlocks';

export function BuildingDetail({ city, building, onDone }: { city: CityBean; building: BuildingBean; onDone: () => void }) {
  const pos = building.positionId;
  const path = { cityId: city.id, positionId: pos };
  const info = useQuery(getCitiesBuildingsByPositionIdOptions({ path }));
  const refresh = () => [getCitiesByCityIdQueryKey({ path: { cityId: city.id } }), getCitiesBuildingsByPositionIdQueryKey({ path })];
  const upgrade = useCommand(postCitiesBuildingsUpgradeMutation(), refresh, 'Upgrade started');
  const demolish = useCommand(postCitiesBuildingsDemolishMutation(), refresh, BALANCE.instantDemolish ? 'Building demolished' : 'Demolition started');
  const cancel = useCommand(postCitiesBuildingsCancelMutation(), refresh, 'Cancelled');
  // the speed-up cost depends on the time left, so refresh it with the building
  const speedup = useCommand(postCitiesBuildingsSpeedupMutation(), () => [...refresh(), getPlayerQueryKey(), getCitiesBuildingsSpeedupQueryKey({ path })]);
  const working = building.status !== 0;
  const coins = useQuery({
    ...getCitiesBuildingsSpeedupOptions({ path }),
    enabled: working,
    refetchInterval: 15_000,
  });
  const have = {
    gold: city.resource.gold,
    food: city.resource.food.amount,
    wood: city.resource.wood.amount,
    stone: city.resource.stone.amount,
    iron: city.resource.iron.amount,
  };
  const next = info.data?.next;

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {building.name} <Badge variant="secondary">Lv {building.level}</Badge>
        </DialogTitle>
        <DialogDescription>Slot {pos}</DialogDescription>
      </DialogHeader>
      {working ? (
        <div className="grid gap-3">
          <p className="text-sm">{building.status === 2 ? `Demolishing to level ${building.level - 1}` : `Upgrading to level ${building.level + 1}`}</p>
          <TimerBar startTime={building.startTime} endTime={building.endTime} />
          <SpeedupOptions
            endTime={building.endTime}
            goldNeed={coins.data?.goldNeed}
            gold={city.resource.gold}
            pending={speedup.isPending}
            onUse={(itemId) => speedup.mutate({ path, body: { itemId } })}
          />
          <Button
            size="sm"
            variant="outline"
            className="justify-self-start"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate({ path }, { onSuccess: onDone })}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {info.isPending && <Skeleton className="h-20" />}
          {info.data && (
            <div className="grid gap-1">
              <p className="text-sm text-muted-foreground">{info.data.info.summary}</p>
              {info.data.effect && (
                <p className="text-xs">
                  <span className="text-muted-foreground">Now:</span> {info.data.effect}
                </p>
              )}
              <Unlocks list={info.data.info.unlocks} />
              <p className="text-xs text-muted-foreground">{info.data.info.placement}</p>
            </div>
          )}
          {next && <MayorBuildHint city={city} />}
          {next ? (
            <div className="grid gap-2 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Upgrade to level {next.level}</span>
                <Button size="sm" disabled={!next.ok || upgrade.isPending} onClick={() => upgrade.mutate({ path }, { onSuccess: onDone })}>
                  Upgrade
                </Button>
              </div>
              {next.effect && (
                <p className="text-xs">
                  <span className="text-muted-foreground">Lv {next.level}:</span> <span className="text-emerald-600 dark:text-emerald-400">{next.effect}</span>
                </p>
              )}
              <CostList cost={next} seconds={next.time} have={have} />
              <MayorBuildExp city={city} typeId={building.typeId} level={next.level} />
              <Requirements list={next.requirements} />
            </div>
          ) : (
            info.data && (
              <p className={cn('flex items-center gap-1.5 text-sm', STATUS_DONE)}>
                <CircleCheck className="size-4" aria-hidden /> Maximum level reached.
              </p>
            )
          )}
          {pos !== -1 && pos !== -2 && building.level > 0 && (
            <>
              <Separator />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {BALANCE.instantDemolish ? 'Demolish the whole building, instantly' : 'Demolish one level'}
                  {info.data && !BALANCE.instantDemolish ? ` (${Math.round(info.data.demolishTime / 60)} min)` : ''}
                  {info.data?.demolishRefund && <> · returns {refundText(info.data.demolishRefund)}</>}
                </span>
                <ConfirmButton
                  size="sm"
                  variant="destructive"
                  disabled={demolish.isPending}
                  title={
                    BALANCE.instantDemolish
                      ? `Demolish ${buildingName(building.typeId)} (Lv ${building.level})?`
                      : `Demolish one level of ${buildingName(building.typeId)}?`
                  }
                  description={
                    BALANCE.instantDemolish
                      ? `The whole building goes at once${info.data?.demolishRefund ? `, returning ${refundText(info.data.demolishRefund)}` : ''}. This cannot be undone.`
                      : 'The level is removed when the demolition finishes.'
                  }
                  confirmLabel="Demolish"
                  onConfirm={() => demolish.mutateAsync({ path }).then(onDone)}
                >
                  Demolish
                </ConfirmButton>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
