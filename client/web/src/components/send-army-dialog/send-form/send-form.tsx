import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { getArmiesQueryKey, getCitiesByCityIdQueryKey, postCitiesArmies, postCitiesArmiesEstimate, type CityBean } from '@marchlands/api-client';
import {
  armyLoad,
  buildingLevel,
  BuildingType,
  heroPower,
  HeroStatus,
  itemConfig,
  maxArmyTroops,
  Mission,
  TROOP_KEYS,
  type TroopKey,
  BuffId,
} from '@marchlands/core';
import { Countdown } from '@/components/countdown/countdown';
import { Button } from '@/components/ui/button';
import { useNow } from '@/hooks/use-now';
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MISSION_NAMES } from '@/components/armies-panel/constants';
import { useCommand, usePlayer } from '@/hooks/use-game';
import { duration, fmt, fmtExact, troopName } from '@/lib/format';
import { ITEM_BONUS_TEXT } from '@/lib/tones';
import { cn } from '@/lib/utils';
import type { SendTarget } from '@/components/send-army-dialog/types';
import { RES } from '@/components/send-army-dialog/send-form/constants';
import { ScoutNote } from '@/components/send-army-dialog/send-form/scout-note/scout-note';
import { ArmyPresets } from '@/components/send-army-dialog/send-form/army-presets/army-presets';

export function SendForm({ city, target, onDone }: { city: CityBean; target: SendTarget; onDone: () => void }) {
  const [mission, setMission] = useState(String(target.mission ?? target.missions[0]));
  // the strongest idle hero (by Attack) leads by default
  const [heroId, setHeroId] = useState(() => {
    const best = city.heros
      .filter((h) => h.status === HeroStatus.IDLE && !h.seized)
      .reduce<CityBean['heros'][number] | null>((top, h) => (!top || heroPower(h) > heroPower(top) ? h : top), null);
    return best ? String(best.id) : 'none';
  });
  const [troops, setTroops] = useState<Partial<Record<TroopKey, string>>>(target.troops ?? {});
  const scouting = Number(mission) === Mission.SCOUT;
  const [resources, setResources] = useState<Partial<Record<(typeof RES)[number], string>>>({});
  // only scouts go on a scouting mission
  const available = Object.entries(TROOP_KEYS).filter(([, key]) => city.troop[key] > 0 && (!scouting || key === 'scouter'));
  const idleHeroes = city.heros.filter((h) => h.status === HeroStatus.IDLE && !h.seized);
  const troopBody = Object.fromEntries(
    Object.entries(troops)
      .map(([k, v]) => [k, Number(v || 0)])
      .filter(([k, n]) => Number(n) > 0 && (!scouting || k === 'scouter')),
  );
  // troops one army may hold (Rally Spot level x 10,000, +25% with a War Ensign)
  const player = usePlayer();
  const now = useNow();
  const ensign = (player.data?.buffs ?? []).some((b) => b.id === BuffId.WAR_ENSIGN && b.endTime > now);
  const cap = maxArmyTroops(city.buildings, ensign);
  const rally = buildingLevel(city.buildings, BuildingType.RALLY_SPOT);
  const chosen = Object.values(troopBody).reduce<number>((t, n) => t + Number(n), 0);
  const over = chosen > cap;
  // attack / defense items (Ivory Horn …) that will count in the battle
  const battleBuffs =
    Number(mission) === Mission.ATTACK ? (player.data?.buffs ?? []).filter((b) => (b.id === BuffId.ATTACK || b.id === BuffId.DEFENSE) && b.endTime > now) : [];
  const resourceBody = Object.fromEntries(
    Object.entries(resources)
      .map(([k, v]) => [k, Number(v || 0)])
      .filter(([, n]) => Number(n) > 0),
  );
  const path = { cityId: city.id };
  // carrying capacity of the chosen troops (troop load x Logistics), shared by every resource
  const capacity = armyLoad(troopBody, player.data?.research ?? {});
  const loaded = Object.values(resourceBody).reduce<number>((t, n) => t + Number(n), 0);
  const overloaded = loaded > capacity;
  const inCity = (r: (typeof RES)[number]) => Math.floor(r === 'gold' ? city.resource.gold : city.resource[r].amount);
  /** Fill one resource with whatever the troops can still carry (and the city has). */
  const maxOf = (r: (typeof RES)[number]) => {
    const others = loaded - Number(resourceBody[r] ?? 0);
    setResources({ ...resources, [r]: String(Math.max(0, Math.min(inCity(r), capacity - others))) });
  };

  const estimate = useMutation({
    mutationFn: async () => {
      const { data } = await postCitiesArmiesEstimate({ path, body: { targetTileId: target.tileId, troops: troopBody }, throwOnError: true });
      return data;
    },
  });
  const send = useCommand(
    async () => {
      const { data } = await postCitiesArmies({
        path,
        body: {
          targetTileId: target.tileId,
          mission: Number(mission),
          troops: troopBody,
          resources: Number(mission) === Mission.TRANSPORT || Number(mission) === Mission.BUILD_CITY ? resourceBody : undefined,
          heroId: heroId === 'none' ? null : Number(heroId),
        },
        throwOnError: true,
      });
      return data;
    },
    () => [getArmiesQueryKey(), getCitiesByCityIdQueryKey({ path: { cityId: city.id } })],
    'Army dispatched',
  );
  const carriesResources = Number(mission) === Mission.TRANSPORT || Number(mission) === Mission.BUILD_CITY;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Send army</DialogTitle>
        <DialogDescription>
          From {city.name} to {target.name}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label>Mission</Label>
            <Select value={mission} onValueChange={setMission}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {target.missions.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {MISSION_NAMES[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Hero</Label>
            <Select value={heroId} onValueChange={setHeroId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No hero</SelectItem>
                {idleHeroes.map((h) => (
                  <SelectItem key={h.id} value={String(h.id)}>
                    {h.name} (Lv {h.level}, att {heroPower(h)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {!scouting && <ArmyPresets city={city} troops={troopBody} onLoad={setTroops} />}
        <div className="grid gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <Label>Troops</Label>
            <span className={over ? 'text-xs font-medium text-destructive tabular-nums' : 'text-xs text-muted-foreground tabular-nums'}>
              {fmtExact(chosen)} / {fmtExact(cap)} (Rally Spot Lv {rally}
              {ensign && <span className={over ? undefined : ITEM_BONUS_TEXT}>, War Ensign +25%</span>})
            </span>
          </div>
          {battleBuffs.map((b) => (
            <p key={b.id} className={cn('text-xs tabular-nums', ITEM_BONUS_TEXT)}>
              {b.itemId ? `${itemConfig(b.itemId)?.name.trim()}: ` : ''}
              {b.desc} in this battle · <Countdown endTime={b.endTime} /> left
            </p>
          ))}
          {available.length === 0 && (
            <p className="text-sm text-muted-foreground">{scouting ? 'No Scouts in the city: train some in the Military tab.' : 'No troops in the city.'}</p>
          )}
          {scouting && <ScoutNote kind={target.kind} />}
          {available.map(([id, key]) => (
            <div key={key} className="flex items-center justify-between gap-2 text-sm">
              <span>
                {troopName(Number(id))} <span className="text-muted-foreground">({fmtExact(city.troop[key])})</span>
              </span>
              <div className="flex items-center gap-1">
                <Input
                  className="h-8 w-24"
                  inputMode="numeric"
                  value={troops[key] ?? ''}
                  placeholder="0"
                  onChange={(e) => setTroops({ ...troops, [key]: e.target.value.replace(/\D/g, '') })}
                />
                <Button
                  size="xs"
                  variant="ghost"
                  title="As many as fit in the army"
                  onClick={() => {
                    // room left in the army without this type, so "All" never goes over the Rally Spot limit
                    const others = chosen - Number(troopBody[key] ?? 0);
                    setTroops({ ...troops, [key]: String(Math.max(0, Math.min(city.troop[key], cap - others))) });
                  }}
                >
                  All
                </Button>
              </div>
            </div>
          ))}
        </div>
        {carriesResources && (
          <div className="grid gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label>Resources</Label>
              <span className={overloaded ? 'text-xs font-medium text-destructive tabular-nums' : 'text-xs text-muted-foreground tabular-nums'}>
                {capacity > 0 ? `${fmtExact(loaded)} / ${fmtExact(capacity)} carried` : 'Choose troops to carry resources'}
              </span>
            </div>
            {RES.map((r) => (
              <div key={r} className="flex items-center justify-between gap-2 text-sm">
                <span className="capitalize">
                  {r === 'wood' ? 'lumber' : r} <span className="text-muted-foreground">({fmtExact(inCity(r))})</span>
                </span>
                <div className="flex items-center gap-1">
                  <Input
                    className="h-8 w-32"
                    inputMode="numeric"
                    placeholder="0"
                    value={resources[r] ?? ''}
                    onChange={(e) => setResources({ ...resources, [r]: e.target.value.replace(/\D/g, '') })}
                  />
                  <Button size="xs" variant="ghost" disabled={capacity <= 0} title="As much as the troops can still carry" onClick={() => maxOf(r)}>
                    Max
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        {estimate.data && (
          <p className="text-sm text-muted-foreground">
            March {duration(estimate.data.marchTime)} · carries {fmt(estimate.data.load)}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" disabled={!Object.keys(troopBody).length} onClick={() => estimate.mutate()}>
          Estimate
        </Button>
        <Button
          disabled={!Object.keys(troopBody).length || over || (carriesResources && overloaded) || send.isPending}
          onClick={() => send.mutate(undefined, { onSuccess: onDone })}
        >
          Send
        </Button>
      </DialogFooter>
    </>
  );
}
