import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import {
  type CityBean,
  deleteCitiesFortificationsQueuesByQueueIdMutation,
  deleteCitiesTroopsQueuesByQueueIdMutation,
  getCitiesByCityIdQueryKey,
  getCitiesFortificationsQueuesOptions,
  getCitiesFortificationsQueuesQueryKey,
  getCitiesFortificationsTrainableOptions,
  getCitiesTroopsQueuesOptions,
  getCitiesTroopsQueuesQueryKey,
  getCitiesTroopsTrainableOptions,
  getPlayerQueryKey,
  postCitiesFortificationsQueuesSpeedupMutation,
  postCitiesFortificationsTrainManyMutation,
  postCitiesTroopsQueuesSpeedupMutation,
  postCitiesTroopsTrainManyMutation,
} from '@marchlands/api-client';
import { BALANCE, BuildingType, itemGoldPrice, ItemId, researchLevel, TechType, usedWallSpace, wallCapacity } from '@marchlands/core';

import { CostList } from '@/components/cost-list/cost-list';
import { RES_KEYS } from '@/components/military-panel/production/constants';
import { MayorExpHint } from '@/components/military-panel/production/mayor-exp-hint/mayor-exp-hint';
import { MayorTrainingHint } from '@/components/military-panel/production/mayor-training-hint/mayor-training-hint';
import { TrainDiscountHint } from '@/components/military-panel/production/train-discount-hint/train-discount-hint';
import { TrainEstimate } from '@/components/military-panel/production/train-estimate/train-estimate';
import type { TrainLimit } from '@/components/military-panel/production/types';
import { limitLabel, maxTrainable } from '@/components/military-panel/production/utils';
import { Requirements } from '@/components/requirements/requirements';
import { TimerBar } from '@/components/timer-bar/timer-bar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCommand, usePlayer } from '@/hooks/use-game';
import { useInventory } from '@/hooks/use-inventory';
import { fmt, fmtExact, realHourly } from '@/lib/format';
import { itemName, troopName } from '@/lib/game-data';
import { translateMessage } from '@/lib/messages';
import { cn } from '@/lib/utils';

export function Production({ city, fort }: { city: CityBean; fort: boolean }) {
  const { t } = useTranslation(['military-panel', 'common']);
  const player = usePlayer();
  // carrying capacity per unit, with the Logistics bonus
  const loadFactor = 1 + BALANCE.logisticsLoadPerLevel * researchLevel(player.data?.research ?? {}, TechType.LOGISTICS);
  const barracks = city.buildings.filter((b) => b.typeId === BuildingType.BARRACKS && b.level > 0);
  const walls = city.buildings.find((b) => b.positionId === -2 && b.level > 0);
  const [position, setPosition] = useState<string>('');
  const pos = Number(position || barracks[0]?.positionId || 0);
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [tab, setTab] = useState<'train' | 'queue'>('train');
  // with several barracks, orders are split so every barracks trains a share in parallel
  const [split, setSplit] = useState(true);
  const splitting = !fort && split && barracks.length > 1;
  const path = { cityId: city.id };
  const trainable = useQuery(fort ? getCitiesFortificationsTrainableOptions({ path }) : getCitiesTroopsTrainableOptions({ path }));
  const queuesKey = fort ? getCitiesFortificationsQueuesQueryKey({ path }) : getCitiesTroopsQueuesQueryKey({ path });
  const queues = useQuery(fort ? getCitiesFortificationsQueuesOptions({ path }) : getCitiesTroopsQueuesOptions({ path }));
  const cityKey = getCitiesByCityIdQueryKey({ path });
  // every amount entered is ordered in one go, all or nothing; the amounts clear once it is queued
  const trainAll = useCommand(fort ? postCitiesFortificationsTrainManyMutation() : postCitiesTroopsTrainManyMutation(), () => [cityKey, queuesKey]);
  const inv = useInventory();
  const boostItem = fort ? ItemId.ARCHIMEDES_NOTE : ItemId.NAPOLEONS_DIARY;
  const boostGold = itemGoldPrice(boostItem) ?? 0;
  const boost = useCommand(
    fort ? postCitiesFortificationsQueuesSpeedupMutation() : postCitiesTroopsQueuesSpeedupMutation(),
    () => [cityKey, queuesKey, getPlayerQueryKey()],
    t('production.boosted', { item: itemName(fort ? ItemId.ARCHIMEDES_NOTE : ItemId.NAPOLEONS_DIARY) }),
  );
  const cancel = useCommand(
    fort ? deleteCitiesFortificationsQueuesByQueueIdMutation() : deleteCitiesTroopsQueuesByQueueIdMutation(),
    () => [cityKey, queuesKey],
    t('production.batchCancelled'),
  );

  if (fort ? !walls : barracks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{fort ? t('production.fortifications') : t('production.training')}</CardTitle>
          <CardDescription>{fort ? t('production.noWalls') : t('production.noBarracks')}</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  const have = {
    gold: city.resource.gold,
    food: city.resource.food.amount,
    wood: city.resource.wood.amount,
    stone: city.resource.stone.amount,
    iron: city.resource.iron.amount,
  };
  const queueList = queues.data?.queues ?? [];
  // batches shown under "In progress": every queue when splitting (or for the walls), else the chosen barracks
  const batches = queueList
    .filter((q) => fort || splitting || q.positionId === pos)
    .flatMap((q) => q.allProduceQueue.map((b) => ({ ...b, positionId: q.positionId })));
  // free wall space for fortifications: capacity minus built and queued ones
  const wallRoom = fort
    ? wallCapacity(city.buildings) -
      usedWallSpace(
        city.fortification,
        queueList.flatMap((q) => q.allProduceQueue.map((b) => ({ troopId: b.type, count: b.num, queueId: b.queueId, costTime: 0, startTime: 0, endTime: 0 }))),
      )
    : Infinity;

  // the amounts entered, and what they cost together
  const countOf = (typeId: number) => Number(counts[typeId] ?? 0);
  // costs per unit as paid now (costShare: a Quartermaster item's discount on troops)
  const units = (trainable.data ?? []).map((u) => ({ ...u, ...Object.fromEntries(RES_KEYS.map((k) => [k, u[k] * u.costShare])) }) as typeof u);
  const orders = units.filter((u) => u.permission && countOf(u.typeId) > 0).map((u) => ({ u, count: countOf(u.typeId) }));
  const ordered = orders.reduce((n, o) => n + o.count, 0);
  // each order's cost is rounded up, as the server charges it
  const costOf = (list: typeof orders, k: (typeof RES_KEYS)[number]) => list.reduce((n, o) => n + Math.ceil(o.u[k] * o.count), 0);
  const sumOf = (list: typeof orders) => ({
    gold: costOf(list, 'gold'),
    food: costOf(list, 'food'),
    wood: costOf(list, 'wood'),
    stone: costOf(list, 'stone'),
    iron: costOf(list, 'iron'),
    population: list.reduce((n, o) => n + o.u.population * o.count, 0),
    space: list.reduce((n, o) => n + (BALANCE.fortSpace[o.u.typeId] ?? 1) * o.count, 0),
  });
  const total = sumOf(orders);
  const others = (typeId: number) => sumOf(orders.filter((o) => o.u.typeId !== typeId));
  // what is left for a type once the other amounts are paid for (its Max button)
  const leftFor = (typeId: number) => {
    const o = others(typeId);
    return { gold: have.gold - o.gold, food: have.food - o.food, wood: have.wood - o.wood, stone: have.stone - o.stone, iron: have.iron - o.iron };
  };
  const idleFor = (typeId: number) => city.resource.idlePopulation - others(typeId).population;
  const wallFor = (typeId: number) => wallRoom - others(typeId).space;
  const overBudget: TrainLimit | null =
    RES_KEYS.find((k) => total[k] > have[k]) ??
    (total.population > city.resource.idlePopulation ? 'idlePopulation' : fort && total.space > wallRoom ? 'wallSpace' : null);

  return (
    <Card className="overflow-visible">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm">{fort ? t('production.fortifications') : t('production.training')}</CardTitle>
        {!fort && barracks.length > 1 && (
          <div className="flex items-center gap-2">
            <Switch id="split-barracks" checked={split} onCheckedChange={setSplit} />
            <Label htmlFor="split-barracks" className="text-xs font-normal">
              {t('production.split', { n: barracks.length })}
            </Label>
          </div>
        )}
        {!fort && barracks.length > 1 && !splitting && (
          <Select value={String(pos)} onValueChange={setPosition}>
            <SelectTrigger size="sm" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {barracks.map((b) => (
                <SelectItem key={b.positionId} value={String(b.positionId)}>
                  {t('production.barracksOption', { level: b.level, slot: b.positionId })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </CardHeader>
      <CardContent className="grid gap-3">
        <MayorTrainingHint city={city} fort={fort} />
        {!fort && units[0] && units[0].costShare < 1 && <TrainDiscountHint share={units[0].costShare} />}
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'train' | 'queue')}>
          <TabsList>
            <TabsTrigger value="train">{fort ? t('production.build') : t('production.train')}</TabsTrigger>
            <TabsTrigger value="queue" className="gap-1.5">
              {t('production.inProgress')}
              {batches.length > 0 && (
                <Badge variant="secondary" className="h-4 min-w-4 px-1 tabular-nums">
                  {batches.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {tab === 'queue' && batches.length === 0 && (
          <p className="text-sm text-muted-foreground">{fort ? t('production.nothingBuilding') : t('production.nothingTraining')}</p>
        )}
        {tab === 'queue' &&
          batches.map((b) => (
            <div key={`${b.positionId}-${b.queueId}`} className="grid gap-1 rounded-md border p-2 text-sm">
              <div className="flex items-center justify-between">
                <span>
                  {fmtExact(b.num)} × {troopName(b.type)}
                  {splitting && <span className="text-xs text-muted-foreground"> · {t('production.queueBarracks', { slot: b.positionId })}</span>}
                </span>
                <div className="flex gap-1">
                  {b.endTime > 0 && (
                    <Button
                      size="xs"
                      variant="secondary"
                      disabled={boost.isPending || (inv.count(boostItem) === 0 && city.resource.gold < boostGold)}
                      onClick={() => boost.mutate({ path: { ...path, positionId: b.positionId, queueId: b.queueId } })}
                    >
                      {t('production.boost', {
                        item: itemName(boostItem),
                        price: inv.count(boostItem) > 0 ? `×${inv.count(boostItem)}` : t('common:gold', { n: fmt(boostGold) }),
                      })}
                    </Button>
                  )}
                  <Button size="xs" variant="ghost" onClick={() => cancel.mutate({ path: { ...path, positionId: b.positionId, queueId: b.queueId } })}>
                    {t('common:actions.cancel')}
                  </Button>
                </div>
              </div>
              {b.endTime > 0 ? (
                <TimerBar startTime={b.startTime} endTime={b.endTime} />
              ) : (
                <span className="text-xs text-muted-foreground">{t('production.waiting')}</span>
              )}
            </div>
          ))}
        {tab === 'train' && (
          <form
            className="grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!orders.length || overBudget) return;
              trainAll.mutate(
                { path, body: { orders: orders.map((o) => ({ troopId: o.u.typeId, count: o.count })), split: splitting, positionId: fort ? undefined : pos } },
                {
                  onSuccess: (r) => {
                    setCounts({});
                    toast.success(t(fort ? 'production.queuedBuild' : 'production.queuedTrain', { units: fmtExact(r.units), count: r.orders }));
                  },
                },
              );
            }}
          >
            {units.map((u) => {
              const count = countOf(u.typeId);
              const m = maxTrainable(u, leftFor(u.typeId), idleFor(u.typeId), fort ? wallFor(u.typeId) : Infinity, fort);
              return (
                <div key={u.typeId} className={cn('grid gap-2 rounded-md border p-3', count > 0 && 'border-primary/60')}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">{troopName(u.typeId)}</div>
                      <div className="text-xs text-muted-foreground">
                        {[
                          t('production.stats', { attack: u.stats.attack, defense: u.stats.defense, life: u.stats.life }),
                          !fort &&
                            t('production.troopStats', {
                              speed: u.stats.speed,
                              range: u.stats.range,
                              load: fmt(Math.floor(u.stats.load * loadFactor)),
                              upkeep: fmt(BALANCE.upkeepPerRealHour ? u.stats.upkeep : realHourly(u.stats.upkeep)),
                            }),
                          fort && u.stats.range > 0 && t('production.range', { range: u.stats.range }),
                          t('production.population', { n: u.population }),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        className="h-8 w-24"
                        inputMode="numeric"
                        placeholder="0"
                        aria-label={t(fort ? 'production.toBuild' : 'production.toTrain', { unit: troopName(u.typeId) })}
                        disabled={!u.permission}
                        value={counts[u.typeId] ?? ''}
                        onChange={(e) => setCounts({ ...counts, [u.typeId]: e.target.value.replace(/\D/g, '') })}
                      />
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        disabled={!u.permission || m.count <= 0}
                        title={`${m.count > 0 ? t('production.maxLimited', { n: fmtExact(m.count), limit: limitLabel(m.limit) }) : t('production.maxNone', { limit: limitLabel(m.limit) })}${orders.some((o) => o.u.typeId !== u.typeId) ? t('production.maxAfterOthers') : ''}${m.limit === 'idlePopulation' ? t('production.maxFreeWorkers') : ''}`}
                        onClick={() => setCounts({ ...counts, [u.typeId]: String(m.count) })}
                      >
                        {t('common:actions.max')}
                      </Button>
                    </div>
                  </div>
                  {u.description && <p className="text-sm text-muted-foreground">{translateMessage(u.description)}</p>}
                  <CostList cost={u} have={have} />
                  <TrainEstimate unitSeconds={u.time} count={count} queues={queueList} barracks={barracks} pos={pos} splitting={splitting} fort={fort} />
                  <MayorExpHint city={city} typeId={u.typeId} count={count} />
                  {!u.permission && <Requirements list={u.requirements.filter((r) => !r.ok)} />}
                </div>
              );
            })}
            {orders.length > 0 && (
              <div className="sticky bottom-2 z-10 grid gap-2 rounded-md border bg-card/95 p-3 shadow-md backdrop-blur">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="grid gap-0.5 text-sm">
                    <span className="font-medium">
                      {t('production.units', { count: ordered, n: fmtExact(ordered) })} ·{' '}
                      {orders.map((o) => t('production.order', { n: fmtExact(o.count), unit: troopName(o.u.typeId) })).join(t('common:list.separator'))}
                    </span>
                    <CostList cost={total} have={have} />
                    <span
                      className={cn('text-xs tabular-nums', total.population > city.resource.idlePopulation ? 'text-destructive' : 'text-muted-foreground')}
                    >
                      {t('production.populationUsed', { used: fmt(total.population), idle: fmt(city.resource.idlePopulation) })}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setCounts({})}>
                      {t('production.clear')}
                    </Button>
                    <Button type="submit" size="sm" disabled={!!overBudget || trainAll.isPending}>
                      {orders.length > 1
                        ? t(fort ? 'production.buildAll' : 'production.trainAll', { n: orders.length })
                        : t(fort ? 'production.build' : 'production.train')}
                    </Button>
                  </div>
                </div>
                {overBudget && <p className="text-xs text-destructive">{t('production.overBudget', { limit: limitLabel(overBudget) })}</p>}
              </div>
            )}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
