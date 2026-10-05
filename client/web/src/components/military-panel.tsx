import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CityBean } from '@evony/api-client';
import { BuildingType, FORT_KEYS, heroManagement, heroPower, HeroStatus, itemConfig, TROOP_KEYS } from '@evony/core';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TimerBar } from '@/components/countdown';
import { CostList, Requirements } from '@/components/cost-list';
import { qk, useCommand } from '@/hooks/use-game';
import { useInventory } from '@/hooks/use-inventory';
import { api, unwrap } from '@/lib/api';
import { fmtExact, troopName } from '@/lib/format';

export function MilitaryPanel({ city }: { city: CityBean }) {
  const garrison = Object.entries(TROOP_KEYS).map(([id, key]) => ({ id: Number(id), count: city.troop[key], injured: city.injuredTroop[key] }));
  const forts = Object.entries(FORT_KEYS).map(([id, key]) => ({ id: Number(id), count: city.fortification[key] }));
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
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
                  <TableCell>{troopName(t.id)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtExact(t.count)}</TableCell>
                  <TableCell className="text-right tabular-nums">{t.injured ? fmtExact(t.injured) : '—'}</TableCell>
                </TableRow>
              ))}
              {forts.map((f) => (
                <TableRow key={f.id} className={f.count ? '' : 'text-muted-foreground'}>
                  <TableCell>{troopName(f.id)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtExact(f.count)}</TableCell>
                  <TableCell />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <div className="grid content-start gap-4">
        <Production city={city} fort={false} />
        <Production city={city} fort />
      </div>
    </div>
  );
}

function Production({ city, fort }: { city: CityBean; fort: boolean }) {
  const kind = fort ? 'fortifications' : 'troops';
  const barracks = city.buildings.filter((b) => b.typeId === BuildingType.BARRACKS && b.level > 0);
  const walls = city.buildings.find((b) => b.positionId === -2 && b.level > 0);
  const [position, setPosition] = useState<string>('');
  const pos = Number(position || barracks[0]?.positionId || 0);
  const [counts, setCounts] = useState<Record<number, string>>({});
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
    (b: { troopId: number; count: number }) => unwrap(api.POST(`/api/v1/cities/{cityId}/${kind}/train`, { params: { path }, body: { ...b, positionId: fort ? undefined : pos } })),
    () => [qk.city(city.id), qk.queues(city.id, fort)],
    'Added to the queue',
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
  const have = { gold: city.resource.gold, food: city.resource.food.amount, wood: city.resource.wood.amount, stone: city.resource.stone.amount, iron: city.resource.iron.amount };
  const queueList = queues.data?.queues ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm">{fort ? 'Fortifications' : 'Training'}</CardTitle>
        {!fort && barracks.length > 1 && (
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
          .filter((q) => fort || q.positionId === pos)
          .flatMap((q) => q.allProduceQueue.map((b) => ({ ...b, positionId: q.positionId })))
          .map((b) => (
            <div key={`${b.positionId}-${b.queueId}`} className="grid gap-1 rounded-md border p-2 text-sm">
              <div className="flex items-center justify-between">
                <span>
                  {fmtExact(b.num)} × {troopName(b.type)}
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
                  atk {u.stats.attack} · def {u.stats.defense} · hp {u.stats.life} · load {u.stats.load} · {u.population} pop
                </div>
              </div>
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const count = Number(counts[u.typeId] ?? 0);
                  if (count > 0) train.mutate({ troopId: u.typeId, count });
                }}
              >
                <Input
                  className="h-8 w-20"
                  inputMode="numeric"
                  placeholder="0"
                  value={counts[u.typeId] ?? ''}
                  onChange={(e) => setCounts({ ...counts, [u.typeId]: e.target.value.replace(/\D/g, '') })}
                />
                <Button size="sm" disabled={!u.permission || train.isPending}>
                  {fort ? 'Build' : 'Train'}
                </Button>
              </form>
            </div>
            <CostList cost={u} seconds={u.time} have={have} />
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
  if (!mayor) return <p className="text-xs text-muted-foreground">No mayor: appoint one with high {stat} in the Heroes tab to {fort ? 'build fortifications' : 'train'} faster.</p>;
  const value = fort ? heroManagement(mayor) : heroPower(mayor);
  const cut = Math.round((1 - Math.pow(0.995, value)) * 1000) / 10;
  return (
    <p className="text-xs text-muted-foreground">
      Times include mayor {mayor.name}'s {stat} {value}: −{cut}% (new batches). A mayor with higher {stat} {fort ? 'builds them' : 'trains'} faster.
    </p>
  );
}
