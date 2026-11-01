import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getPlansOptions, getPlansQueryKey, postPlans, postPlansWaves } from '@marchlands/api-client';
import { Mission } from '@marchlands/core';

import type { SendTarget } from '@/components/send-army-dialog/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useCommand, usePlayer } from '@/hooks/use-game';
import { utcClock } from '@/lib/format';

/**
 * Camp times' wave planner (docs/features/camp-times.md): instead of sending, add the army to a plan on this target, or
 * start one landing at the time set; the Plans panel sends it later. Attacks and scouts only.
 */
export function AddToPlan({
  cityId,
  target,
  wave,
  arriveAt,
}: {
  cityId: number;
  target: SendTarget;
  wave: { mission: number; troops: Record<string, number>; heroId: number | null } | null;
  arriveAt: number | null;
}) {
  const { t } = useTranslation('send-army-dialog');
  const plans = (useQuery(getPlansOptions()).data ?? []).filter((p) => p.targetTileId === target.tileId);
  const [picked, setPicked] = useState<string | null>(null);
  const [shared, setShared] = useState(false);
  const inAlliance = usePlayer().data?.playerInfo.allianceId != null;
  const planId = picked ?? (plans[0] ? String(plans[0].id) : null);
  const add = useCommand(
    async (to: { planId: number } | { landAt: number }) => {
      if (!wave) return;
      const id =
        'planId' in to
          ? to.planId
          : (await postPlans({ body: { name: target.name.slice(0, 40), targetTileId: target.tileId, landAt: to.landAt, shared }, throwOnError: true })).data.id;
      await postPlansWaves({ path: { planId: id }, body: { cityId, ...wave }, throwOnError: true });
    },
    () => [getPlansQueryKey()],
    t('plan.added'),
  );
  if (wave && wave.mission !== Mission.ATTACK && wave.mission !== Mission.SCOUT) return null;
  if (!plans.length && arriveAt == null) return null;
  return (
    <div className="grid gap-2 rounded-md border p-3">
      <p className="text-sm font-medium">{t('plan.title')}</p>
      {plans.length > 0 && planId && (
        <div className="flex flex-wrap items-center gap-2">
          <Select value={planId} onValueChange={setPicked}>
            <SelectTrigger className="h-8 min-w-40 flex-1" aria-label={t('plan.pick')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {plans.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {t('plan.option', { name: p.name, time: utcClock(p.landAt) })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" disabled={!wave || add.isPending} onClick={() => add.mutate({ planId: Number(planId) })}>
            {t('plan.add')}
          </Button>
        </div>
      )}
      {arriveAt != null && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" disabled={!wave || add.isPending} onClick={() => add.mutate({ landAt: arriveAt })}>
            {t('plan.new', { time: utcClock(arriveAt) })}
          </Button>
          {inAlliance && (
            <div className="flex items-center gap-2">
              <Switch id="plan-shared" checked={shared} onCheckedChange={setShared} />
              <Label htmlFor="plan-shared" className="text-xs">
                {t('plan.shared')}
              </Label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
