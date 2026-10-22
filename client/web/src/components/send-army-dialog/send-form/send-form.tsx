import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { type CityBean, getArmiesQueryKey, getCitiesByCityIdQueryKey, postCitiesArmies, postCitiesArmiesEstimate } from '@marchlands/api-client';
import { armyLoad, BuffId, buildingLevel, BuildingType, heroPower, HeroStatus, maxArmyTroops, Mission, TROOP_KEYS, type TroopKey } from '@marchlands/core';

import { MISSION_NAMES } from '@/components/armies-panel/constants';
import { Countdown } from '@/components/countdown/countdown';
import { ArmyPresets } from '@/components/send-army-dialog/send-form/army-presets/army-presets';
import { RES } from '@/components/send-army-dialog/send-form/constants';
import { ScoutNote } from '@/components/send-army-dialog/send-form/scout-note/scout-note';
import { capTroops, defaultHero } from '@/components/send-army-dialog/send-form/utils';
import type { SendTarget } from '@/components/send-army-dialog/types';
import { TroopBadge } from '@/components/troop-badge/troop-badge';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCommand, usePlayer } from '@/hooks/use-game';
import { useNow } from '@/hooks/use-now';
import { duration, fmt, fmtExact, resourceLabel } from '@/lib/format';
import { typedAmounts } from '@/lib/forms';
import { itemName, troopName } from '@/lib/game-data';
import { translateMessage } from '@/lib/messages';
import { ITEM_BONUS_TEXT } from '@/lib/tones';
import { cn } from '@/lib/utils';

/** Send an army to the target. The dialog stays open after sending, so more waves can follow. */
export function SendForm({ city, target }: { city: CityBean; target: SendTarget }) {
  const { t } = useTranslation(['send-army-dialog', 'common']);
  const [mission, setMission] = useState(String(target.mission ?? target.missions[0]));
  // an attack is led by the strongest idle hero (by Attack) unless the player picks one; other missions go without
  const [heroId, setHeroId] = useState(() => defaultHero(Number(mission), city.heros));
  const [heroPicked, setHeroPicked] = useState(false);
  const [entered, setTroops] = useState<Partial<Record<TroopKey, string>>>(target.troops ?? {});
  // never more than the city has (it has fewer after each wave)
  const troops = capTroops(entered, city.troop);
  const scouting = Number(mission) === Mission.SCOUT;
  const [resources, setResources] = useState<Partial<Record<(typeof RES)[number], string>>>({});
  // only scouts go on a scouting mission
  const available = Object.entries(TROOP_KEYS).filter(([, key]) => (city.troop[key] ?? 0) > 0 && (!scouting || key === 'scouter'));
  const idleHeroes = city.heros.filter((h) => h.status === HeroStatus.IDLE && !h.seized);
  const troopBody = typedAmounts(scouting ? { scouter: troops.scouter } : troops);
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
  const resourceBody = typedAmounts(resources);
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
    t('form.dispatched'),
  );
  const carriesResources = Number(mission) === Mission.TRANSPORT || Number(mission) === Mission.BUILD_CITY;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('form.title')}</DialogTitle>
        <DialogDescription>{t('form.description', { from: city.name, to: target.name })}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label>{t('form.mission')}</Label>
            <Select
              value={mission}
              onValueChange={(m) => {
                setMission(m);
                if (!heroPicked) setHeroId(defaultHero(Number(m), city.heros));
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
          {available.length === 0 && <p className="text-sm text-muted-foreground">{scouting ? t('form.noScouts') : t('form.noTroops')}</p>}
          {scouting && <ScoutNote kind={target.kind} />}
          {available.map(([id, key]) => (
            <div key={key} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2">
                <TroopBadge id={Number(id)} />
                <span>
                  {troopName(Number(id))} <span className="text-muted-foreground">({fmtExact(city.troop[key] ?? 0)})</span>
                </span>
              </span>
              <div className="flex items-center gap-1">
                <Input
                  className="h-8 w-24"
                  inputMode="numeric"
                  value={troops[key] ?? ''}
                  placeholder="0"
                  onChange={(e) => setTroops(capTroops({ ...troops, [key]: e.target.value.replace(/\D/g, '') }, city.troop))}
                />
                <Button
                  size="xs"
                  variant="ghost"
                  title={t('form.allTitle')}
                  onClick={() => {
                    // room left in the army without this type, so "All" never goes over the Rally Spot limit
                    const others = chosen - Number(troopBody[key] ?? 0);
                    setTroops({ ...troops, [key]: String(Math.max(0, Math.min(city.troop[key] ?? 0, cap - others))) });
                  }}
                >
                  {t('common:actions.all')}
                </Button>
              </div>
            </div>
          ))}
        </div>
        {carriesResources && (
          <div className="grid gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label>{t('form.resources')}</Label>
              <span className={overloaded ? 'text-xs font-medium text-destructive tabular-nums' : 'text-xs text-muted-foreground tabular-nums'}>
                {capacity > 0 ? t('form.carried', { loaded: fmtExact(loaded), capacity: fmtExact(capacity) }) : t('form.chooseTroops')}
              </span>
            </div>
            {RES.map((r) => (
              <div key={r} className="flex items-center justify-between gap-2 text-sm">
                <span className="capitalize">
                  {resourceLabel(r)} <span className="text-muted-foreground">({fmtExact(inCity(r))})</span>
                </span>
                <div className="flex items-center gap-1">
                  <Input
                    className="h-8 w-32"
                    inputMode="numeric"
                    placeholder="0"
                    value={resources[r] ?? ''}
                    onChange={(e) => setResources({ ...resources, [r]: e.target.value.replace(/\D/g, '') })}
                  />
                  <Button size="xs" variant="ghost" disabled={capacity <= 0} title={t('form.maxTitle')} onClick={() => maxOf(r)}>
                    {t('common:actions.max')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        {estimate.data && (
          <p className="text-sm text-muted-foreground">{t('form.estimate', { time: duration(estimate.data.marchTime), load: fmt(estimate.data.load) })}</p>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" disabled={!Object.keys(troopBody).length} onClick={() => estimate.mutate()}>
          {t('form.estimateButton')}
        </Button>
        <Button
          disabled={!Object.keys(troopBody).length || over || (carriesResources && overloaded) || send.isPending}
          onClick={() =>
            send.mutate(undefined, {
              // stay open for the next wave: the hero just sent is busy now (an attack picks the next strongest), and the
              // resources it carried are gone; troop amounts are capped to what is left once the city refreshes
              onSuccess: () => {
                setHeroId(defaultHero(Number(mission), city.heros, heroId === 'none' ? undefined : Number(heroId)));
                setHeroPicked(false);
                setResources({});
              },
            })
          }
        >
          {t('common:actions.send')}
        </Button>
      </DialogFooter>
    </>
  );
}
