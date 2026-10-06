import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CityBean } from '@evony/api-client';
import {
  BALANCE,
  usedWallSpace,
  wallCapacity,
  healCost,
  healHonorCost,
  researchLevel,
  TechType,
  buildingLevel,
  BuildingType,
  FORT_KEYS,
  getGameSpeed,
  troopDescription,
  heroManagement,
  heroPower,
  HeroStatus,
  itemConfig,
  prestigeOf,
  PrestigeAction,
  splitTraining,
  TROOP_KEYS,
  type TroopKey,
  unitExp,
} from '@evony/core';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TimerBar } from '@/components/countdown';
import { CostList, Requirements } from '@/components/cost-list';
import { qk, useCommand, usePlayer } from '@/hooks/use-game';
import { useInventory } from '@/hooks/use-inventory';
import { api, unwrap } from '@/lib/api';
import { duration, fmt, fmtExact, realHourly, troopName } from '@/lib/format';

export function MilitaryPanel({ city }: { city: CityBean }) {
  const garrison = Object.entries(TROOP_KEYS).map(([id, key]) => ({ id: Number(id), count: city.troop[key], injured: city.injuredTroop[key] }));
  const forts = Object.entries(FORT_KEYS).map(([id, key]) => ({ id: Number(id), count: city.fortification[key] }));
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <div className="grid content-start gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Garrison</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Ready</TableHead>
                  <TableHead className="text-right">Injured</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {garrison.map((t) => (
                  <TableRow key={t.id} className={t.count || t.injured ? '' : 'text-muted-foreground'}>
                    <TableCell>
                      <UnitName id={t.id} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmtExact(t.count)}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.injured ? fmtExact(t.injured) : '—'}</TableCell>
                  </TableRow>
                ))}
                {forts.map((f) => (
                  <TableRow key={f.id} className={f.count ? '' : 'text-muted-foreground'}>
                    <TableCell>
                      <UnitName id={f.id} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmtExact(f.count)}</TableCell>
                    <TableCell />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <InjuredCard city={city} />
      </div>
      <div className="grid content-start gap-4">
        <Production city={city} fort={false} />
        <Production city={city} fort />
      </div>
    </div>
  );
}

function Production({ city, fort }: { city: CityBean; fort: boolean }) {
  const kind = fort ? 'fortifications' : 'troops';
  const player = usePlayer();
  // carrying capacity per unit, with the Logistics bonus
  const loadFactor = 1 + BALANCE.logisticsLoadPerLevel * researchLevel(player.data?.research ?? {}, TechType.LOGISTICS);
  const barracks = city.buildings.filter((b) => b.typeId === BuildingType.BARRACKS && b.level > 0);
  const walls = city.buildings.find((b) => b.positionId === -2 && b.level > 0);
  const [position, setPosition] = useState<string>('');
  const pos = Number(position || barracks[0]?.positionId || 0);
  const [counts, setCounts] = useState<Record<number, string>>({});
  // with several barracks, orders are split so every barracks trains a share in parallel
  const [split, setSplit] = useState(true);
  const splitting = !fort && split && barracks.length > 1;
  const path = { cityId: city.id };
  const trainable = useQuery({
    queryKey: qk.trainable(city.id, fort),
    queryFn: () => unwrap(api.GET(`/api/v1/cities/{cityId}/${kind}/trainable`, { params: { path } })),
  });
  const queues = useQuery({
    queryKey: qk.queues(city.id, fort),
    queryFn: () => unwrap(api.GET(`/api/v1/cities/{cityId}/${kind}/queues`, { params: { path } })),
  });
  const train = useCommand(
    (b: { troopId: number; count: number }) =>
      unwrap(api.POST(`/api/v1/cities/{cityId}/${kind}/train`, { params: { path }, body: { ...b, positionId: fort ? undefined : pos } })),
    () => [qk.city(city.id), qk.queues(city.id, fort)],
    'Added to the queue',
  );
  const trainSplit = useCommand(
    (b: { troopId: number; count: number }) => unwrap(api.POST('/api/v1/cities/{cityId}/troops/train-split', { params: { path }, body: b })),
    () => [qk.city(city.id), qk.queues(city.id, fort)],
  );
  const inv = useInventory();
  const boostItem = fort ? 'player.fort.1.c' : 'player.troop.1.b';
  const boostCents = fort ? 35 : 30;
  const boost = useCommand(
    (b: { positionId: number; queueId: number }) =>
      unwrap(api.POST(`/api/v1/cities/{cityId}/${kind}/queues/{positionId}/{queueId}/speedup`, { params: { path: { ...path, ...b } } })),
    () => [qk.city(city.id), qk.queues(city.id, fort), qk.player],
    `${itemConfig(fort ? 'player.fort.1.c' : 'player.troop.1.b')?.name}: −30%`,
  );
  const cancel = useCommand(
    (b: { positionId: number; queueId: number }) =>
      unwrap(api.DELETE(`/api/v1/cities/{cityId}/${kind}/queues/{positionId}/{queueId}`, { params: { path: { ...path, ...b } } })),
    () => [qk.city(city.id), qk.queues(city.id, fort)],
    'Batch cancelled',
  );

  if (fort ? !walls : barracks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{fort ? 'Fortifications' : 'Training'}</CardTitle>
          <CardDescription>{fort ? 'Build Walls to construct fortifications.' : 'Build a Barracks to train troops.'}</CardDescription>
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
  // free wall space for fortifications: capacity minus built and queued ones
  const wallRoom = fort
    ? wallCapacity(city.buildings) -
      usedWallSpace(
        city.fortification,
        queueList.flatMap((q) => q.allProduceQueue.map((b) => ({ troopId: b.type, count: b.num, queueId: b.queueId, costTime: 0, startTime: 0, endTime: 0 }))),
      )
    : Infinity;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm">{fort ? 'Fortifications' : 'Training'}</CardTitle>
        {!fort && barracks.length > 1 && (
          <div className="flex items-center gap-2">
            <Switch id="split-barracks" checked={split} onCheckedChange={setSplit} />
            <Label htmlFor="split-barracks" className="text-xs font-normal">
              Split across {barracks.length} barracks
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
                  Barracks Lv {b.level} (slot {b.positionId})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </CardHeader>
      <CardContent className="grid gap-3">
        <MayorTrainingHint city={city} fort={fort} />
        {queueList
          .filter((q) => fort || splitting || q.positionId === pos)
          .flatMap((q) => q.allProduceQueue.map((b) => ({ ...b, positionId: q.positionId })))
          .map((b) => (
            <div key={`${b.positionId}-${b.queueId}`} className="grid gap-1 rounded-md border p-2 text-sm">
              <div className="flex items-center justify-between">
                <span>
                  {fmtExact(b.num)} × {troopName(b.type)}
                  {splitting && <span className="text-xs text-muted-foreground"> · barracks {b.positionId}</span>}
                </span>
                <div className="flex gap-1">
                  {b.endTime > 0 && (
                    <Button
                      size="xs"
                      variant="secondary"
                      disabled={boost.isPending || (inv.count(boostItem) === 0 && inv.cents < boostCents)}
                      onClick={() => boost.mutate({ positionId: b.positionId, queueId: b.queueId })}
                    >
                      {itemConfig(boostItem)?.name} −30% · {inv.count(boostItem) > 0 ? `×${inv.count(boostItem)}` : `${boostCents} cents`}
                    </Button>
                  )}
                  <Button size="xs" variant="ghost" onClick={() => cancel.mutate({ positionId: b.positionId, queueId: b.queueId })}>
                    Cancel
                  </Button>
                </div>
              </div>
              {b.endTime > 0 ? <TimerBar startTime={b.startTime} endTime={b.endTime} /> : <span className="text-xs text-muted-foreground">Waiting</span>}
            </div>
          ))}
        {trainable.data?.map((u) => (
          <div key={u.typeId} className="grid gap-2 rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-medium">{troopName(u.typeId)}</div>
                <div className="text-xs text-muted-foreground">
                  atk {u.stats.attack} · def {u.stats.defense} · hp {u.stats.life}
                  {!fort &&
                    ` · speed ${u.stats.speed} · range ${u.stats.range} · carries ${fmt(Math.floor(u.stats.load * loadFactor))} · ${fmt(BALANCE.upkeepPerRealHour ? u.stats.upkeep : realHourly(u.stats.upkeep))} food/h`}
                  {fort && u.stats.range > 0 && ` · range ${u.stats.range}`} · {u.population} pop
                </div>
              </div>
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const count = Number(counts[u.typeId] ?? 0);
                  if (count <= 0) return;
                  if (!splitting) return train.mutate({ troopId: u.typeId, count });
                  trainSplit.mutate(
                    { troopId: u.typeId, count },
                    {
                      onSuccess: (r) =>
                        toast.success(`Training ${fmtExact(count)} ${troopName(u.typeId)} in ${r.batches.length} barracks`, {
                          description: `All done in ${duration(r.finishAt - Date.now())}`,
                        }),
                    },
                  );
                }}
              >
                <Input
                  className="h-8 w-20"
                  inputMode="numeric"
                  placeholder="0"
                  value={counts[u.typeId] ?? ''}
                  onChange={(e) => setCounts({ ...counts, [u.typeId]: e.target.value.replace(/\D/g, '') })}
                />
                {(() => {
                  const m = maxTrainable(u, have, city.resource.idlePopulation, fort ? wallRoom : Infinity, fort);
                  return (
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      disabled={!u.permission || m.count <= 0}
                      title={m.count > 0 ? `${fmtExact(m.count)}: limited by ${m.limit}` : `None: not enough ${m.limit}`}
                      onClick={() => setCounts({ ...counts, [u.typeId]: String(m.count) })}
                    >
                      Max
                    </Button>
                  );
                })()}
                <Button size="sm" disabled={!u.permission || train.isPending || trainSplit.isPending}>
                  {fort ? 'Build' : 'Train'}
                </Button>
              </form>
            </div>
            <p className="text-sm text-muted-foreground">{u.description}</p>
            <CostList cost={u} have={have} />
            <TrainEstimate
              unitSeconds={u.time}
              count={Number(counts[u.typeId] ?? 0)}
              queues={queueList}
              barracks={barracks}
              pos={pos}
              splitting={splitting}
              fort={fort}
            />
            <MayorExpHint city={city} typeId={u.typeId} count={Number(counts[u.typeId] ?? 0)} />
            {!u.permission && <Requirements list={u.requirements.filter((r) => !r.ok)} />}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** The mayor's Attack (troops) or Politics (fortifications) shortens training: ×0.995 per point. */
function MayorTrainingHint({ city, fort }: { city: CityBean; fort: boolean }) {
  const stat = fort ? 'Politics' : 'Attack';
  const mayor = city.heros.find((h) => h.status === HeroStatus.MAYOR);
  if (!mayor)
    return (
      <p className="text-xs text-muted-foreground">
        No mayor: appoint one with high {stat} in the Heroes tab to {fort ? 'build fortifications' : 'train'} faster.
      </p>
    );
  const value = fort ? heroManagement(mayor) : heroPower(mayor);
  const cut = Math.round((1 - Math.pow(0.995, value)) * 1000) / 10;
  return (
    <p className="text-xs text-muted-foreground">
      Times include mayor {mayor.name}'s {stat} {value}: −{cut}% (new batches). A mayor with higher {stat} {fort ? 'builds them' : 'trains'} faster.
    </p>
  );
}

/** Experience the mayor earns when the units finish: their experience weight plus the training prestige. */
function MayorExpHint({ city, typeId, count }: { city: CityBean; typeId: number; count: number }) {
  const mayor = city.heros.find((h) => h.status === HeroStatus.MAYOR);
  if (!mayor) return null;
  const th = buildingLevel(city.buildings, BuildingType.TOWN_HALL);
  const each = unitExp(typeId) * BALANCE.heroExpPerTrain + prestigeOf(PrestigeAction.TRAIN, typeId, 1, th);
  const n = (x: number) => x.toLocaleString('en', { maximumFractionDigits: 2 });
  return (
    <span className="text-xs text-muted-foreground">
      Mayor {mayor.name} gains {n(each)} exp per unit
      {count > 0 && (
        <>
          {' '}
          · <span className="font-medium text-foreground">+{n(Math.floor(each * count))} exp</span> for {fmtExact(count)}
        </>
      )}
    </span>
  );
}

const RES_KEYS = ['gold', 'food', 'wood', 'stone', 'iron'] as const;

/** Most units of a type the city can order now: resources, idle population and (fortifications) wall space. */
function maxTrainable(
  u: { typeId: number; population: number } & Record<(typeof RES_KEYS)[number], number>,
  have: Record<(typeof RES_KEYS)[number], number>,
  idlePopulation: number,
  wallRoom: number,
  fort: boolean,
): { count: number; limit: string } {
  const limits: [string, number][] = RES_KEYS.filter((k) => u[k] > 0).map((k) => [k === 'wood' ? 'lumber' : k, Math.floor(have[k] / u[k])]);
  if (u.population > 0) limits.push(['idle population', Math.floor(idlePopulation / u.population)]);
  if (fort) limits.push(['wall space', Math.floor(wallRoom / (BALANCE.fortSpace[u.typeId] ?? 1))]);
  if (!limits.length) return { count: 0, limit: 'resources' };
  const [limit, count] = limits.reduce((a, b) => (b[1] < a[1] ? b : a));
  return { count: Math.max(0, count), limit };
}

type Queue = { positionId: number; allProduceQueue: { endTime: number; costTime: number }[]; capacity?: number };

/** Real time per unit, and (when an amount is entered) when the order would finish: in one barracks, or split. */
function TrainEstimate({
  unitSeconds,
  count,
  queues,
  barracks,
  pos,
  splitting,
  fort,
}: {
  unitSeconds: number;
  count: number;
  queues: Queue[];
  barracks: { positionId: number; level: number }[];
  pos: number;
  splitting: boolean;
  fort: boolean;
}) {
  const now = Date.now();
  const unitMs = (Math.max(BALANCE.minTrainUnitSeconds, unitSeconds) * 1000) / getGameSpeed();
  const freeAt = (q?: Queue) => {
    const list = q?.allProduceQueue ?? [];
    if (!list.length) return now;
    const head = Math.max(now, list[0].endTime || now + list[0].costTime * 1000);
    return head + list.slice(1).reduce((t, b) => t + b.costTime * 1000, 0);
  };
  const perUnit =
    unitMs <= 0
      ? 'instant (mayor and Military Science fast enough)'
      : `${unitMs < 10_000 ? `${(unitMs / 1000).toLocaleString('en', { maximumFractionDigits: 2 })}s` : duration(unitMs)} per unit`;
  const each = <span className="text-xs text-muted-foreground">{perUnit}</span>;
  if (count <= 0 || fort) return each;
  const single = freeAt(queues.find((q) => q.positionId === pos)) + count * unitMs - now;
  if (!splitting) {
    return (
      <span className="text-xs text-muted-foreground">
        {perUnit} · {fmtExact(count)} ready in {duration(single)}
      </span>
    );
  }
  const lanes = barracks
    .filter((b) => (queues.find((q) => q.positionId === b.positionId)?.allProduceQueue.length ?? 0) < b.level)
    .map((b) => ({ positionId: b.positionId, freeAt: freeAt(queues.find((q) => q.positionId === b.positionId)) }));
  const plan = splitTraining(lanes, count, unitMs);
  if (!plan.length) return <span className="text-xs text-destructive">Every barracks queue is full.</span>;
  const finish = Math.max(...plan.map((p) => p.finishAt)) - now;
  return (
    <span className="text-xs text-muted-foreground">
      {perUnit} · {fmtExact(count)} ready in <span className="font-medium text-foreground">{duration(finish)}</span> across {plan.length} barracks (
      {plan.map((p) => fmtExact(p.count)).join(' / ')}) instead of {duration(count * unitMs)} in one
    </span>
  );
}

function UnitName({ id }: { id: number }) {
  return (
    <Tooltip>
      <TooltipTrigger className="cursor-help text-left underline decoration-dotted decoration-muted-foreground/50 underline-offset-2">
        {troopName(id)}
      </TooltipTrigger>
      <TooltipContent className="max-w-72">{troopDescription(id)}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Injured troops of this city: defenders that fell while it was attacked survive injured, a share
 * set by Medicine (BALANCE.medicinePerLevel per level, up to 50%). Heal them for part of their
 * training cost, or dismiss them.
 */
function InjuredCard({ city }: { city: CityBean }) {
  const player = usePlayer();
  const [amounts, setAmounts] = useState<Partial<Record<TroopKey, string>>>({});
  const injured = Object.entries(TROOP_KEYS)
    .map(([id, key]) => ({ id: Number(id), key, count: city.injuredTroop[key] ?? 0 }))
    .filter((t) => t.count > 0);
  const medicine = researchLevel(player.data?.research ?? {}, TechType.MEDICINE);
  const share = Math.min(0.5, medicine * BALANCE.medicinePerLevel);
  // an empty field means "all of them"
  const chosen = Object.fromEntries(
    injured
      .map((t) => [t.key, Math.min(t.count, amounts[t.key] === undefined || amounts[t.key] === '' ? t.count : Number(amounts[t.key]))])
      .filter(([, n]) => Number(n) > 0),
  ) as Record<string, number>;
  const cost = healCost(chosen);
  const have = {
    gold: city.resource.gold,
    food: city.resource.food.amount,
    wood: city.resource.wood.amount,
    stone: city.resource.stone.amount,
    iron: city.resource.iron.amount,
  };
  const affordable = (['gold', 'food', 'wood', 'stone', 'iron'] as const).every((k) => have[k] >= cost[k]);
  const total = Object.values(chosen).reduce((s, n) => s + n, 0);
  const path = { cityId: city.id };
  const [confirming, setConfirming] = useState(false);
  const done = () => {
    setAmounts({});
    setConfirming(false);
  };
  const heal = useCommand(
    (payWith: 'resources' | 'honor') =>
      unwrap(api.POST('/api/v1/cities/{cityId}/troops/injured/cure', { params: { path }, body: { troops: chosen, payWith } })),
    () => [qk.city(city.id), qk.player],
    `Healed ${fmtExact(total)} troops`,
  );
  const honor = player.data?.playerInfo.honor ?? 0;
  const honorCost = healHonorCost(chosen);
  const dismiss = useCommand(
    () => unwrap(api.POST('/api/v1/cities/{cityId}/troops/injured/disband', { params: { path }, body: { troops: chosen } })),
    () => [qk.city(city.id)],
    `Dismissed ${fmtExact(total)} injured troops`,
  );
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Injured troops</CardTitle>
        <CardDescription>
          {medicine > 0
            ? `Medicine Lv ${medicine}: ${Math.round(share * 100)}% of the troops this city loses, defending or attacking, survive injured.`
            : 'Research Medicine so that some of the troops this city loses, defending or attacking, survive injured (5% per level, up to 50%).'}{' '}
          Heal them for {Math.round(BALANCE.healCostShare * 100)}% of their training cost, or for honor ({fmtExact(honor)} available).
        </CardDescription>
      </CardHeader>
      {injured.length > 0 && (
        <CardContent className="grid gap-3">
          {injured.map((t) => (
            <div key={t.key} className="flex items-center justify-between gap-2 text-sm">
              <span>
                <UnitName id={t.id} /> <span className="text-muted-foreground">({fmtExact(t.count)})</span>
              </span>
              <Input
                className="h-8 w-24"
                inputMode="numeric"
                placeholder={`all ${fmtExact(t.count)}`}
                value={amounts[t.key] ?? ''}
                onChange={(e) => setAmounts({ ...amounts, [t.key]: e.target.value.replace(/\D/g, '') })}
              />
            </div>
          ))}
          <CostList cost={cost} have={have} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={total <= 0 || !affordable || heal.isPending} onClick={() => heal.mutate('resources', { onSuccess: done })}>
              Heal {fmtExact(total)} · resources
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={total <= 0 || honor < honorCost || heal.isPending}
              title={honor < honorCost ? `Not enough honor (${fmtExact(honorCost)} needed)` : undefined}
              onClick={() => heal.mutate('honor', { onSuccess: done })}
            >
              Heal · {fmt(honorCost)} honor
            </Button>
            <Button
              size="sm"
              variant={confirming ? 'destructive' : 'outline'}
              disabled={total <= 0 || dismiss.isPending}
              onBlur={() => setConfirming(false)}
              onClick={() => (confirming ? dismiss.mutate(undefined, { onSuccess: done }) : setConfirming(true))}
            >
              {confirming ? `Click again to dismiss ${fmtExact(total)} for good` : 'Dismiss'}
            </Button>
            {!affordable && total > 0 && <span className="self-center text-xs text-destructive">Not enough resources.</span>}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
