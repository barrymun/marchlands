import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getCitiesByCityIdQueryKey,
  getPlayerQueryKey,
  postCitiesTroopsInjuredCureMutation,
  postCitiesTroopsInjuredDisbandMutation,
  type CityBean,
} from '@marchlands/api-client';
import { BALANCE, healCost, healHonorCost, researchLevel, TechType, TROOP_KEYS, type TroopKey } from '@marchlands/core';
import { ConfirmButton } from '@/components/confirm-button/confirm-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CostList } from '@/components/cost-list/cost-list';
import { useCommand, usePlayer } from '@/hooks/use-game';
import { fmt, fmtExact } from '@/lib/format';
import { UnitName } from '@/components/military-panel/unit-name/unit-name';

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
          {medicine > 0 ? t('injured.medicine', { level: medicine, percent: Math.round(share * 100) }) : t('injured.noMedicine')}{' '}
          {t('injured.healInfo', { percent: Math.round(BALANCE.healCostShare * 100), honor: fmtExact(honor) })}
        </CardDescription>
      </CardHeader>
      {injured.length > 0 && (
        <CardContent className="grid gap-3">
          {injured.map((u) => (
            <div key={u.key} className="flex items-center justify-between gap-2 text-sm">
              <span>
                <UnitName id={u.id} /> <span className="text-muted-foreground">({fmtExact(u.count)})</span>
              </span>
              <Input
                className="h-8 w-24"
                inputMode="numeric"
                placeholder={t('injured.allPlaceholder', { n: fmtExact(u.count) })}
                value={amounts[u.key] ?? ''}
                onChange={(e) => setAmounts({ ...amounts, [u.key]: e.target.value.replace(/\D/g, '') })}
              />
            </div>
          ))}
          <CostList cost={cost} have={have} />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={total <= 0 || !affordable || heal.isPending}
              onClick={() => heal.mutate({ path, body: { troops: chosen, payWith: 'resources' } }, { onSuccess: done })}
            >
              {t('injured.healResources', { n: fmtExact(total) })}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={total <= 0 || honor < honorCost || heal.isPending}
              title={honor < honorCost ? t('injured.notEnoughHonor', { n: fmtExact(honorCost) }) : undefined}
              onClick={() => heal.mutate({ path, body: { troops: chosen, payWith: 'honor' } }, { onSuccess: done })}
            >
              {t('injured.healHonor', { n: fmt(honorCost) })}
            </Button>
            <ConfirmButton
              size="sm"
              variant="outline"
              disabled={total <= 0 || dismiss.isPending}
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
