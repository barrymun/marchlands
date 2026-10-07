import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import type { BuildingBean, CityBean } from '@evony/api-client';
import { BALANCE, buildingHeroExp, buildingLevel, BuildingType, heroManagement, HeroStatus, heroTimeMultiplier } from '@evony/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSticky } from '@/hooks/use-sticky';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Countdown, TimerBar } from '@/components/countdown';
import { CostList, Requirements } from '@/components/cost-list';
import { SpeedupOptions } from '@/components/speedup-options';
import { qk, useCommand } from '@/hooks/use-game';
import { api, unwrap } from '@/lib/api';
import { buildingName } from '@/lib/format';
import { cn } from '@/lib/utils';

const INSIDE = Array.from({ length: 32 }, (_, i) => i);
const OUTSIDE = Array.from({ length: 40 }, (_, i) => 1001 + i);

export function BuildingsPanel({ city }: { city: CityBean }) {
  const [selected, setSelected] = useState<number | null>(null);
  const byPos = new Map(city.buildings.map((b) => [b.positionId, b]));
  const townHall = byPos.get(-1)?.level ?? 0;
  const outerSlots = 10 + 3 * townHall;
  const busy = city.buildings.filter((b) => b.status !== 0);
  // tag filter: one tag per building type present; with tags selected only those buildings show
  const [tags, setTags] = useState<number[]>([]);
  const typeCounts = new Map<number, number>();
  for (const b of city.buildings) if (b.typeId) typeCounts.set(b.typeId, (typeCounts.get(b.typeId) ?? 0) + 1);
  const typeList = [...typeCounts.entries()].sort((a, b) => buildingName(a[0]).localeCompare(buildingName(b[0])));
  const active = tags.filter((t) => typeCounts.has(t));
  const toggle = (t: number) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  const filtered = city.buildings
    .filter((b) => active.includes(b.typeId))
    .sort((a, b) => buildingName(a.typeId).localeCompare(buildingName(b.typeId)) || b.level - a.level || a.positionId - b.positionId);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter buildings by type">
        <Button size="xs" variant={active.length === 0 ? 'default' : 'outline'} onClick={() => setTags([])}>
          Show all
        </Button>
        {typeList.map(([typeId, n]) => {
          const on = active.includes(typeId);
          return (
            <Button key={typeId} size="xs" variant={on ? 'default' : 'outline'} aria-pressed={on} onClick={() => toggle(typeId)} className="gap-1">
              {buildingName(typeId)}
              <span className={cn('tabular-nums', on ? 'opacity-80' : 'text-muted-foreground')}>{n}</span>
            </Button>
          );
        })}
      </div>
      {busy.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Construction</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {busy.map((b) => (
              <button key={b.positionId} className="grid gap-1 text-left" onClick={() => setSelected(b.positionId)}>
                <span className="text-sm">
                  {b.status === 2 ? 'Demolishing' : 'Building'} {b.name} → Lv {b.status === 2 ? b.level - 1 : b.level + 1}
                </span>
                <TimerBar startTime={b.startTime} endTime={b.endTime} />
              </button>
            ))}
          </CardContent>
        </Card>
      )}
      {active.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {active.map(buildingName).join(', ')}{' '}
              <span className="font-normal text-muted-foreground">
                ({filtered.length} building{filtered.length === 1 ? '' : 's'} · levels {Math.min(...filtered.map((b) => b.level))}–
                {Math.max(...filtered.map((b) => b.level))})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {filtered.map((b) => (
              <Slot key={b.positionId} pos={b.positionId} building={b} onClick={() => setSelected(b.positionId)} />
            ))}
          </CardContent>
        </Card>
      )}
      {active.length === 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Inside the walls</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {[-1, -2].map((pos) => (
              <Slot key={pos} pos={pos} building={byPos.get(pos)} onClick={() => setSelected(pos)} fixedName={pos === -1 ? 'Town Hall' : 'Walls'} />
            ))}
            {INSIDE.map((pos) => (
              <Slot key={pos} pos={pos} building={byPos.get(pos)} onClick={() => setSelected(pos)} />
            ))}
          </CardContent>
        </Card>
      )}
      {active.length === 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Fields{' '}
              <span className="font-normal text-muted-foreground">
                ({outerSlots} of 40 unlocked by Town Hall Lv {townHall})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
            {OUTSIDE.map((pos, i) => (
              <Slot key={pos} pos={pos} building={byPos.get(pos)} locked={i >= outerSlots} onClick={() => setSelected(pos)} />
            ))}
          </CardContent>
        </Card>
      )}
      <BuildingDialog city={city} positionId={selected} building={selected != null ? byPos.get(selected) : undefined} onClose={() => setSelected(null)} />
    </div>
  );
}

function Slot({
  pos,
  building,
  locked,
  fixedName,
  onClick,
}: {
  pos: number;
  building?: BuildingBean;
  locked?: boolean;
  fixedName?: string;
  onClick: () => void;
}) {
  if (locked) return <div className="h-16 rounded-md border border-dashed opacity-40" />;
  if (!building || building.typeId === 0) {
    return (
      <button
        onClick={onClick}
        className="flex h-16 items-center justify-center rounded-md border border-dashed text-muted-foreground transition hover:bg-muted"
        aria-label={`Build at slot ${pos}`}
      >
        {fixedName ?? <Plus className="size-4" />}
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex h-16 flex-col items-start justify-between rounded-md border p-2 text-left transition hover:bg-muted',
        building.status !== 0 && 'border-amber-500',
      )}
    >
      <span className="line-clamp-1 text-xs font-medium">{building.name}</span>
      <span className="flex w-full items-center justify-between text-xs text-muted-foreground">
        Lv {building.level}
        {building.status !== 0 && (
          <span className="text-amber-600">
            <Countdown endTime={building.endTime} />
          </span>
        )}
      </span>
    </button>
  );
}

function BuildingDialog({ city, positionId, building, onClose }: { city: CityBean; positionId: number | null; building?: BuildingBean; onClose: () => void }) {
  const open = positionId != null;
  const pos = useSticky(positionId);
  const bld = useSticky(open ? (building ?? { typeId: 0 }) : null);
  const empty = !bld || bld.typeId === 0;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        {pos != null &&
          (empty ? (
            <BuildList city={city} positionId={pos} onDone={onClose} />
          ) : (
            <BuildingDetail city={city} building={bld as BuildingBean} onDone={onClose} />
          ))}
      </DialogContent>
    </Dialog>
  );
}

function areaOf(pos: number): 'inside' | 'outside' | 'walls' {
  if (pos === -2) return 'walls';
  return pos >= 1000 ? 'outside' : 'inside';
}

function BuildList({ city, positionId, onDone }: { city: CityBean; positionId: number; onDone: () => void }) {
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

function BuildingDetail({ city, building, onDone }: { city: CityBean; building: BuildingBean; onDone: () => void }) {
  const pos = building.positionId;
  const path = { cityId: city.id, positionId: pos };
  const info = useQuery({
    queryKey: qk.upgrade(city.id, pos),
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/cities/{cityId}/buildings/{positionId}', {
          params: { path },
        }),
      ),
  });
  const refresh = () => [qk.city(city.id), qk.upgrade(city.id, pos)];
  const upgrade = useCommand(
    () =>
      unwrap(
        api.POST('/api/v1/cities/{cityId}/buildings/{positionId}/upgrade', {
          params: { path },
        }),
      ),
    refresh,
    'Upgrade started',
  );
  const demolish = useCommand(
    () =>
      unwrap(
        api.POST('/api/v1/cities/{cityId}/buildings/{positionId}/demolish', {
          params: { path },
        }),
      ),
    refresh,
    'Demolition started',
  );
  const cancel = useCommand(
    () =>
      unwrap(
        api.POST('/api/v1/cities/{cityId}/buildings/{positionId}/cancel', {
          params: { path },
        }),
      ),
    refresh,
    'Cancelled',
  );
  const speedup = useCommand(
    (itemId: string) =>
      unwrap(
        api.POST('/api/v1/cities/{cityId}/buildings/{positionId}/speedup', {
          params: { path },
          body: { itemId },
        }),
      ),
    () => [...refresh(), qk.player],
  );
  const working = building.status !== 0;
  const coins = useQuery({
    queryKey: ['speedup-cost', city.id, pos, building.endTime],
    enabled: working,
    refetchInterval: 15_000,
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/cities/{cityId}/buildings/{positionId}/speedup', {
          params: { path },
        }),
      ),
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
            demolishing={building.status === 2}
            coinsNeed={coins.data?.coinsNeed}
            pending={speedup.isPending}
            onUse={(itemId) => speedup.mutate(itemId)}
          />
          <Button
            size="sm"
            variant="outline"
            className="justify-self-start"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate(undefined, { onSuccess: onDone })}
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
                <Button size="sm" disabled={!next.ok || upgrade.isPending} onClick={() => upgrade.mutate(undefined, { onSuccess: onDone })}>
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
            info.data && <p className="text-sm text-muted-foreground">Maximum level reached.</p>
          )}
          {pos !== -1 && pos !== -2 && building.level > 0 && (
            <>
              <Separator />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  Demolish one level
                  {info.data ? ` (${Math.round(info.data.demolishTime / 60)} min)` : ''}
                </span>
                <Button size="sm" variant="destructive" disabled={demolish.isPending} onClick={() => demolish.mutate(undefined, { onSuccess: onDone })}>
                  Demolish
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

/** How the mayor's Politics shortens build times (×0.995 per point, at most to BALANCE.heroTimeFloor.building); refreshed live with the hero. */
function MayorBuildHint({ city }: { city: CityBean }) {
  const mayor = city.heros.find((h) => h.status === HeroStatus.MAYOR);
  if (!mayor) return <p className="text-xs text-muted-foreground">No mayor: appoint one with high Politics in the Heroes tab to build faster.</p>;
  const politics = heroManagement(mayor);
  const cut = Math.round((1 - heroTimeMultiplier(politics, BALANCE.heroTimeFloor.building)) * 1000) / 10;
  return (
    <p className="text-xs text-muted-foreground">
      Times include mayor {mayor.name}'s Politics {politics}: −{cut}%. A mayor with higher Politics builds faster.
    </p>
  );
}

/** Experience the mayor earns when this building level completes (construction.ts buildingHeroExp). */
function MayorBuildExp({ city, typeId, level }: { city: CityBean; typeId: number; level: number }) {
  const mayor = city.heros.find((h) => h.status === HeroStatus.MAYOR);
  if (!mayor) return null;
  // a Town Hall upgrade counts its own new level, as on the server
  const th = typeId === BuildingType.TOWN_HALL ? level : buildingLevel(city.buildings, BuildingType.TOWN_HALL);
  return (
    <span className="text-xs text-muted-foreground">
      Mayor {mayor.name} gains {Math.floor(buildingHeroExp(typeId, level, th)).toLocaleString('en')} exp when it completes
    </span>
  );
}

function Unlocks({ list }: { list: { name: string; level: number }[] }) {
  if (!list.length) return null;
  return <p className="text-xs text-muted-foreground">Unlocks: {list.map((u) => `${u.name} (Lv ${u.level})`).join(', ')}</p>;
}
