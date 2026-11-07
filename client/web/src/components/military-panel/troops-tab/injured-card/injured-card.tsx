import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type CityBean,
  getCitiesByCityIdQueryKey,
  getPlayerQueryKey,
  postCitiesTroopsInjuredCureMutation,
  postCitiesTroopsInjuredDisbandMutation,
} from '@marchlands/api-client';
import { BALANCE, healCost, healHonorCost, HealPayment, researchLevel, RESOURCE_KEYS, TechType, TROOP_KEYS, type TroopKey } from '@marchlands/core';

import { ConfirmButton } from '@/components/confirm-button/confirm-button';
import { CostList } from '@/components/cost-list/cost-list';
import { UnitName } from '@/components/military-panel/unit-name/unit-name';
import { NumberField } from '@/components/number-field/number-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCommand, usePlayer } from '@/hooks/use-game';
import { fmt, fmtExact, percent } from '@/lib/format';
import { troopName } from '@/lib/game-data';
import { textInRange } from '@/lib/ranges';

/**
 * Injured troops of this city: defenders that fell while it was attacked survive injured, a share
 * set by Medicine (BALANCE.medicinePerLevel per level, up to 50%). Heal them for part of their
 * training cost, or dismiss them.
 */
export function InjuredCard({ city }: { city: CityBean }) {
  const { t } = useTranslation('military-panel');
  const player = usePlayer();
  const [amounts, setAmounts] = useState<Partial<Record<TroopKey, string>>>({});
  const injured = Object.entries(TROOP_KEYS)
    .map(([id, key]) => ({ id: Number(id), key, count: city.injuredTroop[key] ?? 0 }))
    .filter((t) => t.count > 0);
  const medicine = researchLevel(player.data?.research ?? {}, TechType.MEDICINE);
  const share = Math.min(0.5, medicine * BALANCE.medicinePerLevel);
  // an empty field means "all of them"; more than are injured shows as invalid, and nothing is healed or dismissed until
  // every amount is in
  const valid = injured.every((u) => textInRange(amounts[u.key] ?? '', { min: 0, max: u.count }, { blank: true }));
  const chosen = Object.fromEntries(injured.map((u) => [u.key, amounts[u.key] ? Number(amounts[u.key]) : u.count]).filter(([, n]) => Number(n) > 0)) as Record<
    string,
    number
  >;
  const cost = healCost(chosen);
  const have = {
    gold: city.resource.gold,
    food: city.resource.food.amount,
    wood: city.resource.wood.amount,
    stone: city.resource.stone.amount,
    iron: city.resource.iron.amount,
  };
  const affordable = RESOURCE_KEYS.every((k) => have[k] >= cost[k]);
  const total = Object.values(chosen).reduce((s, n) => s + n, 0);
  const path = { cityId: city.id };
  const done = () => setAmounts({});
  const heal = useCommand(
    postCitiesTroopsInjuredCureMutation(),
    () => [getCitiesByCityIdQueryKey({ path }), getPlayerQueryKey()],
    t('injured.healed', { count: total, n: fmtExact(total) }),
  );
  const honor = player.data?.playerInfo.honor ?? 0;
  const honorCost = healHonorCost(chosen);
  const dismiss = useCommand(
    postCitiesTroopsInjuredDisbandMutation(),
    () => [getCitiesByCityIdQueryKey({ path })],
    t('injured.dismissed', { count: total, n: fmtExact(total) }),
  );
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{t('injured.title')}</CardTitle>
        <CardDescription>
          {medicine > 0 ? t('injured.medicine', { level: medicine, percent: percent(share) }) : t('injured.noMedicine')}{' '}
          {t('injured.healInfo', { percent: percent(BALANCE.healCostShare), honor: fmtExact(honor) })}
        </CardDescription>
      </CardHeader>
      {injured.length > 0 && (
        <CardContent className="grid gap-3">
          {injured.map((u) => (
            <div key={u.key} className="flex items-center justify-between gap-2 text-sm">
              <span>
                <UnitName id={u.id} /> <span className="text-muted-foreground">({fmtExact(u.count)})</span>
              </span>
              <NumberField
                className="h-8 w-24"
                aria-label={troopName(u.id)}
                placeholder={t('injured.allPlaceholder', { n: fmtExact(u.count) })}
                range={{ min: 0, max: u.count }}
                blank
                value={amounts[u.key] ?? ''}
                onChange={(text) => setAmounts({ ...amounts, [u.key]: text })}
              />
            </div>
          ))}
          <CostList cost={cost} have={have} />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={!valid || total <= 0 || !affordable || heal.isPending}
              onClick={() => heal.mutate({ path, body: { troops: chosen, payWith: HealPayment.RESOURCES } }, { onSuccess: done })}
            >
              {t('injured.healResources', { n: fmtExact(total) })}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!valid || total <= 0 || honor < honorCost || heal.isPending}
              title={honor < honorCost ? t('injured.notEnoughHonor', { n: fmtExact(honorCost) }) : undefined}
              onClick={() => heal.mutate({ path, body: { troops: chosen, payWith: HealPayment.HONOR } }, { onSuccess: done })}
            >
              {t('injured.healHonor', { n: fmt(honorCost) })}
            </Button>
            <ConfirmButton
              size="sm"
              variant="outline"
              disabled={!valid || total <= 0 || dismiss.isPending}
              title={t('injured.dismissTitle', { count: total, n: fmtExact(total) })}
              description={t('injured.dismissDescription')}
              confirmLabel={t('injured.dismiss')}
              onConfirm={() => dismiss.mutateAsync({ path, body: { troops: chosen } }).then(done)}
            >
              {t('injured.dismiss')}
            </ConfirmButton>
            {!affordable && total > 0 && <span className="self-center text-xs text-destructive">{t('injured.notEnoughResources')}</span>}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
