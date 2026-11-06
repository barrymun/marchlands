import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { type CityBean, getArmiesOptions, getPlayerQueryKey, postCitiesAbandonMoveOutMutation } from '@marchlands/api-client';
import { BALANCE } from '@marchlands/core';

import { ConfirmDialog } from '@/components/confirm-dialog/confirm-dialog';
import { Countdown } from '@/components/countdown/countdown';
import { STAYS } from '@/components/move-out/constants';
import type { HeroChoices } from '@/components/move-out/types';
import {
  attackOnTheWay,
  destinations,
  freeSlots,
  hasAnything,
  heroMoves,
  movableHeroes,
  moveOutShares,
  slotsLeftFor,
  toggled,
} from '@/components/move-out/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCommand, usePlayer } from '@/hooks/use-game';
import { useNow } from '@/hooks/use-now';
import { duration, fmt, fmtExact } from '@/lib/format';
import { WARN_TEXT } from '@/lib/tones';

/** Moving a city being abandoned out at once: its troops and resources shared between other cities, and any heroes chosen (docs/features/abandoning-a-city.md). */
export function MoveOut({ city }: { city: CityBean }) {
  const { t } = useTranslation(['move-out', 'common']);
  const baseId = useId();
  const now = useNow();
  const player = usePlayer().data;
  const armies = useQuery(getArmiesOptions());
  const [chosen, setChosen] = useState<number[]>([]);
  const [choices, setChoices] = useState<HeroChoices>({});
  const [confirming, setConfirming] = useState(false);
  const move = useCommand(postCitiesAbandonMoveOutMutation(), () => [getPlayerQueryKey()], t('done', { city: city.name }));

  const places = destinations(player?.castles ?? [], city.id);
  // a city taken off the player's list while chosen no longer counts
  const targets = chosen.flatMap((id) => places.find((c) => c.id === id) ?? []);
  const shares = moveOutShares(city, targets.length);
  const anything = hasAnything(moveOutShares(city, 1));
  const heroes = movableHeroes(city.heros);
  const moves = heroMoves(choices).filter((m) => heroes.some((h) => h.id === m.heroId) && places.some((c) => c.id === m.cityId));
  const anyRoom = places.some((c) => freeSlots(c) > 0);
  const blockedUntil = player?.playerInfo.moveOutBlockedUntil ?? 0;
  const blocked = blockedUntil > now;
  const attacked = attackOnTheWay(armies.data?.enemy, city.fieldId);
  const ready = ((targets.length > 0 && anything) || moves.length > 0) && !blocked && !attacked;

  return (
    <div className="grid gap-2 border-t pt-3">
      <p className="text-sm font-medium">{t('title')}</p>
      <p className="text-xs text-muted-foreground">{t('description')}</p>
      {places.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('noCities')}</p>
      ) : (
        <ul className="grid gap-1">
          {places.map((place) => (
            <li key={place.id} className="flex items-center gap-2">
              <Checkbox
                id={`${baseId}-${place.id}`}
                checked={chosen.includes(place.id)}
                onCheckedChange={() => {
                  setChosen((list) => toggled(list, place.id));
                }}
              />
              <Label htmlFor={`${baseId}-${place.id}`} className="text-xs font-normal">
                {place.name}
              </Label>
            </li>
          ))}
        </ul>
      )}
      {targets.length > 0 && (
        <table className="w-full text-xs tabular-nums">
          <thead className="text-muted-foreground">
            <tr>
              <th className="text-start font-normal">{t('table.city')}</th>
              <th className="text-end font-normal">{t('table.troops')}</th>
              <th className="text-end font-normal">{t('table.injured')}</th>
              <th className="text-end font-normal">{t('table.goods')}</th>
            </tr>
          </thead>
          <tbody>
            {targets.map((target, i) => (
              <tr key={target.id}>
                <td className="text-start">{target.name}</td>
                <td className="text-end">{fmtExact(shares[i]?.troops ?? 0)}</td>
                <td className="text-end">{fmtExact(shares[i]?.injured ?? 0)}</td>
                <td className="text-end">{fmt(shares[i]?.goods ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!anything && <p className="text-xs text-muted-foreground">{t('nothing')}</p>}
      {heroes.length > 0 && places.length > 0 && (
        <div className="grid gap-1">
          <p className="text-xs font-medium">{t('heroes')}</p>
          {!anyRoom && <p className="text-xs text-muted-foreground">{t('noRoom')}</p>}
          {anyRoom && (
            <ul className="grid gap-1">
              {heroes.map((hero) => (
                <li key={hero.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate">
                    {hero.name} {t('common:level.short', { level: hero.level })}
                  </span>
                  <Select
                    value={String(choices[hero.id] ?? STAYS)}
                    onValueChange={(value) => {
                      setChoices(({ [hero.id]: _, ...rest }) => (value === STAYS ? rest : { ...rest, [hero.id]: Number(value) }));
                    }}
                  >
                    <SelectTrigger size="sm" className="w-44 shrink-0 text-xs" aria-label={hero.name}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={STAYS}>{t('stays')}</SelectItem>
                      {places.map((place) => {
                        const left = slotsLeftFor(place, choices, hero.id);
                        return (
                          <SelectItem key={place.id} value={String(place.id)} disabled={left === 0}>
                            {t('cityFree', { city: place.name, n: fmtExact(left) })}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {attacked && <p className={`text-xs ${WARN_TEXT}`}>{t('underAttack')}</p>}
      {blocked && (
        <p className={`text-xs ${WARN_TEXT}`}>
          <Trans t={t} i18nKey="cooldown" components={{ countdown: <Countdown endTime={blockedUntil} /> }} />
        </p>
      )}
      <Button
        variant="outline"
        size="sm"
        className="justify-self-start"
        disabled={!ready}
        onClick={() => {
          setConfirming(true);
        }}
      >
        {t('button')}
      </Button>
      {confirming && (
        <ConfirmDialog
          open
          onOpenChange={setConfirming}
          title={t('confirmTitle', { city: city.name })}
          description={t('confirmDescription', { city: city.name, time: duration(BALANCE.abandon.moveOutCooldownMs) })}
          confirmLabel={t('button')}
          onConfirm={() =>
            move
              .mutateAsync({
                path: { cityId: city.id },
                body: { targetCityIds: anything ? targets.map((target) => target.id) : [], heroes: moves },
              })
              .then(() => {
                setChosen([]);
                setChoices({});
              })
          }
        />
      )}
    </div>
  );
}
