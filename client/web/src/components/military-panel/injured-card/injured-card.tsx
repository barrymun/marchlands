import { useState } from 'react';
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
    `Healed ${fmtExact(total)} troops`,
  );
  const honor = player.data?.playerInfo.honor ?? 0;
  const honorCost = healHonorCost(chosen);
  const dismiss = useCommand(
    postCitiesTroopsInjuredDisbandMutation(),
    () => [getCitiesByCityIdQueryKey({ path })],
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
            <Button
              size="sm"
              disabled={total <= 0 || !affordable || heal.isPending}
              onClick={() => heal.mutate({ path, body: { troops: chosen, payWith: 'resources' } }, { onSuccess: done })}
            >
              Heal {fmtExact(total)} · resources
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={total <= 0 || honor < honorCost || heal.isPending}
              title={honor < honorCost ? `Not enough honor (${fmtExact(honorCost)} needed)` : undefined}
              onClick={() => heal.mutate({ path, body: { troops: chosen, payWith: 'honor' } }, { onSuccess: done })}
            >
              Heal · {fmt(honorCost)} honor
            </Button>
            <ConfirmButton
              size="sm"
              variant="outline"
              disabled={total <= 0 || dismiss.isPending}
              title={`Dismiss ${fmtExact(total)} injured troops?`}
              description="They leave for good instead of being healed. This cannot be undone."
              confirmLabel="Dismiss"
              onConfirm={() => dismiss.mutateAsync({ path, body: { troops: chosen } }).then(done)}
            >
              Dismiss
            </ConfirmButton>
            {!affordable && total > 0 && <span className="self-center text-xs text-destructive">Not enough resources.</span>}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
