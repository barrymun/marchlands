import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import {
  type CityBean,
  getArmiesQueryKey,
  getCitiesByCityIdQueryKey,
  getPlansQueryKey,
  postCitiesArmies,
  postCitiesArmiesEstimate,
  postPlansWaves,
} from '@marchlands/api-client';
import {
  armyLoad,
  BuffId,
  buildingLevel,
  BuildingType,
  heroPower,
  HeroStatus,
  marchTimeMs,
  maxArmyTroops,
  Mission,
  reliefMarchMs,
  TROOP_KEYS,
  type TroopKey,
} from '@marchlands/core';

import { MISSION_NAMES } from '@/components/armies-panel/constants';
import { Countdown } from '@/components/countdown/countdown';
import { NumberField } from '@/components/number-field/number-field';
import { ResourceIcon } from '@/components/resource-icon/resource-icon';
import { ArmyPresets } from '@/components/send-army-dialog/send-form/army-presets/army-presets';
import { RES } from '@/components/send-army-dialog/send-form/constants';
import { LandAt } from '@/components/send-army-dialog/send-form/land-at/land-at';
import { ScoutNote } from '@/components/send-army-dialog/send-form/scout-note/scout-note';
import { capTroops, defaultHero, freeTroops } from '@/components/send-army-dialog/send-form/utils';
import type { PlanSlot, SendTarget } from '@/components/send-army-dialog/types';
import { TroopBadge } from '@/components/troop-badge/troop-badge';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCommand, usePlayer } from '@/hooks/use-game';
import { useNow } from '@/hooks/use-now';
import { useServerNow } from '@/hooks/use-server-now';
import { duration, fmt, fmtExact, resourceLabel, utcClock } from '@/lib/format';
import { typedAmounts } from '@/lib/forms';
import { itemName, troopName } from '@/lib/game-data';
import { landingTime } from '@/lib/landing-time';
import { translateMessage } from '@/lib/messages';
import { textInRange } from '@/lib/ranges';
import { clockOffset } from '@/lib/server-clock';
import { ITEM_BONUS_TEXT, LOSS_TEXT } from '@/lib/tones';
import { cn } from '@/lib/utils';

/**
 * Send an army to the target. The dialog stays open after sending, so more waves can follow. With a `slot` (the Plans
 * panel) it adds a wave to that plan instead, from troops and heroes not already in the player's unsent waves.
 */
export function SendForm({ city, target, slot }: { city: CityBean; target: SendTarget; slot?: PlanSlot }) {
  const { t } = useTranslation(['send-army-dialog', 'common']);
  // a wave plan's other waves keep their heroes and troops until they're sent
  const heroes = slot ? city.heros.filter((h) => !slot.planned.heroIds.includes(h.id)) : city.heros;
  const free = slot ? freeTroops(city.troop, slot.planned.troops) : city.troop;
  const [mission, setMission] = useState(String(target.mission ?? target.missions[0]));
  // an attack is led by the strongest idle hero (by Attack) unless the player picks one; other missions go without
  const [heroId, setHeroId] = useState(() => defaultHero(Number(mission), heroes));
  const [heroPicked, setHeroPicked] = useState(false);
  const [troops, setTroops] = useState<Partial<Record<TroopKey, string>>>(target.troops ?? {});
  // typing is never capped (more than are home shows as invalid), but after a wave, when the city has fewer, amounts
  // come down to what is left; by content, as the city refetches every tick with the same troops
  const home = JSON.stringify(free);
  const [seenHome, setSeenHome] = useState(home);
  if (home !== seenHome) {
    setSeenHome(home);
    setTroops(capTroops(troops, free));
  }
  const scouting = Number(mission) === Mission.SCOUT;
  const [resources, setResources] = useState<Partial<Record<(typeof RES)[number], string>>>({});
  // camp times: a landing time in UTC, kept for the next wave so waves land together
  const [landAt, setLandAt] = useState<{ date: string; time: string } | null>(null);
  const arriveAt = landAt ? landingTime(landAt.date, landAt.time) : null;
  // every troop type, those the city has none of greyed out; only scouts go on a scouting mission
  const listed = Object.entries(TROOP_KEYS).filter(([, key]) => !scouting || key === 'scouter');
  const hasAny = listed.some(([, key]) => (free[key] ?? 0) > 0);
  const idleHeroes = heroes.filter((h) => h.status === HeroStatus.IDLE && !h.seized);
  const troopBody = typedAmounts(scouting ? { scouter: troops.scouter } : troops);
  // troops one army may hold (Rally Spot level x 10,000, +25% with a War Ensign)
  const player = usePlayer();
  const now = useNow();
  const ensign = (player.data?.buffs ?? []).some((b) => b.id === BuffId.WAR_ENSIGN && b.endTime > now);
  const cap = maxArmyTroops(city.buildings, ensign, city.historicLevel);
  const rally = buildingLevel(city.buildings, BuildingType.RALLY_SPOT);
  const chosen = Object.values(troopBody).reduce<number>((t, n) => t + Number(n), 0);
  const over = chosen > cap;
  // each amount within what is home (blank is none)
  const troopsValid = listed.every(([, key]) => textInRange(troops[key] ?? '', { min: 0, max: free[key] ?? 0 }, { blank: true }));
  // attack / defense items (Ivory Horn …) that will count in the battle
  const battleBuffs =
    Number(mission) === Mission.ATTACK ? (player.data?.buffs ?? []).filter((b) => (b.id === BuffId.ATTACK || b.id === BuffId.DEFENSE) && b.endTime > now) : [];
  const resourceBody = typedAmounts(resources);
  // the march as the server works it out (armyMarchMs): to the player's own city or valley a Relief Station shortens it
  const rawMarchMs = chosen > 0 ? marchTimeMs(city.fieldId, target.tileId, troopBody, player.data?.research ?? {}, city.buildings) : null;
  const marchMs = rawMarchMs != null && target.own ? reliefMarchMs(rawMarchMs, city.buildings) : rawMarchMs;
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
          arriveAt: arriveAt ?? undefined,
        },
        throwOnError: true,
      });
      return data;
    },
    () => [getArmiesQueryKey(), getCitiesByCityIdQueryKey({ path: { cityId: city.id } })],
    t('form.dispatched'),
  );
  const carriesResources = Number(mission) === Mission.TRANSPORT || Number(mission) === Mission.BUILD_CITY;
  // a plan's wave: when it must leave to land in its place, which its march may already have passed
  const serverNow = useServerNow();
  const leaves = slot && marchMs != null ? slot.landAt + slot.position - marchMs : null;
  const late = leaves != null && leaves < serverNow;
  const add = useCommand(
    async (plan: PlanSlot) => {
      await postPlansWaves({
        path: { planId: plan.planId },
        body: { cityId: city.id, mission: Number(mission), troops: troopBody, heroId: heroId === 'none' ? null : Number(heroId) },
        throwOnError: true,
      });
    },
    () => [getPlansQueryKey()],
    t('form.added'),
  );
  // after a wave goes (sent, or added to the plan) the dialog stays open for the next: the hero just used is busy (an
  // attack picks the next strongest), and the resources it carried are gone; troop amounts are capped to what is left
  const nextWave = () => {
    setHeroId(defaultHero(Number(mission), heroes, heroId === 'none' ? undefined : Number(heroId)));
    setHeroPicked(false);
    setResources({});
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{slot ? t('form.planTitle') : t('form.title')}</DialogTitle>
        <DialogDescription>
          {slot
            ? t('form.planDescription', { from: city.name, to: target.name, time: utcClock(slot.landAt) })
            : t('form.description', { from: city.name, to: target.name })}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        {slot && (
          <div className="grid gap-2">
            <Label>{t('form.from')}</Label>
            <Select value={String(city.id)} onValueChange={(c) => slot.onCity(Number(c))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {slot.cities.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t('form.plannedNote')}</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label>{t('form.mission')}</Label>
            <Select
              value={mission}
              onValueChange={(m) => {
                setMission(m);
                if (!heroPicked) setHeroId(defaultHero(Number(m), heroes));
              }}
            >
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
            <Label>{t('form.hero')}</Label>
            <Select
              value={heroId}
              onValueChange={(h) => {
                setHeroId(h);
                setHeroPicked(true);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('common:noHero')}</SelectItem>
                {idleHeroes.map((h) => (
                  <SelectItem key={h.id} value={String(h.id)}>
                    {t('form.heroOption', { name: h.name, level: h.level, attack: heroPower(h) })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {!scouting && <ArmyPresets city={city} troops={troopBody} onLoad={setTroops} />}
        <div className="grid gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <Label>{t('form.troops')}</Label>
            <span className={over ? 'text-xs font-medium text-destructive tabular-nums' : 'text-xs text-muted-foreground tabular-nums'}>
              {ensign ? (
                <Trans
                  t={t}
                  i18nKey="form.capacityEnsign"
                  values={{ chosen: fmtExact(chosen), cap: fmtExact(cap), rally }}
                  components={{ b: <span className={over ? undefined : ITEM_BONUS_TEXT} /> }}
                />
              ) : (
                t('form.capacity', { chosen: fmtExact(chosen), cap: fmtExact(cap), rally })
              )}
            </span>
          </div>
          {battleBuffs.map((b) => (
            <p key={b.id} className={cn('text-xs tabular-nums', ITEM_BONUS_TEXT)}>
              {b.itemId ? `${itemName(b.itemId)}: ` : ''}
              <Trans t={t} i18nKey="form.battleBuff" values={{ desc: translateMessage(b.desc) }} components={{ timer: <Countdown endTime={b.endTime} /> }} />
            </p>
          ))}
          {!hasAny && <p className="text-sm text-muted-foreground">{scouting ? t('form.noScouts') : t('form.noTroops')}</p>}
          {scouting && <ScoutNote kind={target.kind} />}
          {/* two to a row from lg (workers and warriors, then scouts and pikemen …), so the dialog needn't scroll */}
          <div className="grid gap-x-8 gap-y-2 lg:grid-cols-2">
            {listed.map(([id, key]) => {
              const have = free[key] ?? 0;
              return (
                <div key={key} className={cn('flex items-center justify-between gap-2 text-sm', have === 0 && 'text-muted-foreground')}>
                  <span className={cn('flex items-center gap-2', have === 0 && 'opacity-60')}>
                    <TroopBadge id={Number(id)} />
                    <span>
                      {troopName(Number(id))} <span className="text-muted-foreground">({fmtExact(have)})</span>
                    </span>
                  </span>
                  <div className="flex items-center gap-1">
                    <NumberField
                      className="h-8 w-24"
                      aria-label={troopName(Number(id))}
                      disabled={have === 0}
                      value={troops[key] ?? ''}
                      placeholder="0"
                      range={{ min: 0, max: have }}
                      blank
                      onChange={(text) => setTroops({ ...troops, [key]: text })}
                    />
                    <Button
                      size="xs"
                      variant="ghost"
                      disabled={have === 0}
                      title={t('form.allTitle')}
                      onClick={() => {
                        // room left in the army without this type, so "All" never goes over the Rally Spot limit
                        const others = chosen - Number(troopBody[key] ?? 0);
                        setTroops({ ...troops, [key]: String(Math.max(0, Math.min(have, cap - others))) });
                      }}
                    >
                      {t('common:actions.all')}
                    </Button>
                    <Button size="xs" variant="ghost" disabled={!troops[key]} title={t('form.noneTitle')} onClick={() => setTroops({ ...troops, [key]: '' })}>
                      {t('common:actions.none')}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {carriesResources && (
          <div className="grid gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label>{t('form.resources')}</Label>
              <span className={overloaded ? 'text-xs font-medium text-destructive tabular-nums' : 'text-xs text-muted-foreground tabular-nums'}>
                {capacity > 0 ? t('form.carried', { loaded: fmtExact(loaded), capacity: fmtExact(capacity) }) : t('form.chooseTroops')}
              </span>
            </div>
            <div className="grid gap-x-8 gap-y-2 lg:grid-cols-2">
              {RES.map((r) => (
                <div key={r} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2">
                    {/* the margin makes up the width of a troop's badge, so the names line up with the troops' above */}
                    <ResourceIcon resource={r} className="mx-1" />
                    <span className="capitalize">
                      {resourceLabel(r)} <span className="text-muted-foreground">({fmtExact(inCity(r))})</span>
                    </span>
                  </span>
                  <div className="flex items-center gap-1">
                    <Input
                      className="h-8 w-28"
                      inputMode="numeric"
                      placeholder="0"
                      value={resources[r] ?? ''}
                      onChange={(e) => setResources({ ...resources, [r]: e.target.value.replace(/\D/g, '') })}
                    />
                    <Button size="xs" variant="ghost" disabled={capacity <= 0} title={t('form.maxTitle')} onClick={() => maxOf(r)}>
                      {t('common:actions.max')}
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      disabled={!resources[r]}
                      title={t('form.noneResourceTitle')}
                      onClick={() => setResources({ ...resources, [r]: '' })}
                    >
                      {t('common:actions.none')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {slot ? (
          leaves != null && (
            <p className={cn('text-xs tabular-nums', late ? LOSS_TEXT : 'text-muted-foreground')}>
              {late ? (
                t('form.planLate', { time: duration(marchMs ?? 0) })
              ) : (
                <Trans
                  t={t}
                  i18nKey="form.planLeaves"
                  values={{ time: utcClock(leaves) }}
                  components={{ timer: <Countdown endTime={leaves - clockOffset()} /> }}
                />
              )}
            </p>
          )
        ) : (
          <LandAt marchMs={marchMs} value={landAt} onChange={setLandAt} />
        )}
        {estimate.data && (
          <p className="text-sm text-muted-foreground">{t('form.estimate', { time: duration(estimate.data.marchTime), load: fmt(estimate.data.load) })}</p>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" disabled={!Object.keys(troopBody).length} onClick={() => estimate.mutate()}>
          {t('form.estimateButton')}
        </Button>
        {slot ? (
          <Button
            disabled={!Object.keys(troopBody).length || over || !troopsValid || late || add.isPending}
            onClick={() => add.mutate(slot, { onSuccess: nextWave })}
          >
            {t('form.addToPlan')}
          </Button>
        ) : (
          <Button
            disabled={
              !Object.keys(troopBody).length ||
              over ||
              !troopsValid ||
              (carriesResources && overloaded) ||
              (landAt != null && arriveAt == null) ||
              send.isPending
            }
            onClick={() => send.mutate(undefined, { onSuccess: nextWave })}
          >
            {t('common:actions.send')}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}
