import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getPlansQueryKey, patchPlansByPlanIdMutation, type PlanBean, postPlansMutation } from '@marchlands/api-client';
import { BALANCE, HOUR } from '@marchlands/core';

import { NumberField } from '@/components/number-field/number-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useCommand, usePlayer } from '@/hooks/use-game';
import { useServerNow } from '@/hooks/use-server-now';
import { duration, utcClock } from '@/lib/format';
import { firstLanding, landingTime, utcFields } from '@/lib/landing-time';
import { textInRange } from '@/lib/ranges';
import { LOSS_TEXT } from '@/lib/tones';
import { cn } from '@/lib/utils';

/**
 * A wave plan's name, target coordinates, landing second (UTC, by the server's clock) and sharing: a new plan, or with
 * `plan` that plan changed (its maker's). Once one of its waves is sent its target and second are fixed.
 */
export function PlanForm({ plan, onDone }: { plan?: PlanBean; onDone?: () => void }) {
  const { t } = useTranslation(['plans-panel', 'common']);
  const now = useServerNow();
  const inAlliance = usePlayer().data?.playerInfo.allianceId != null;
  const [name, setName] = useState(plan?.name ?? '');
  const [x, setX] = useState(plan ? String(plan.x) : '');
  const [y, setY] = useState(plan ? String(plan.y) : '');
  // a new plan is offered a round minute about an hour ahead, time enough to plan and send
  const [when, setWhen] = useState(() => utcFields(plan?.landAt ?? firstLanding(now, HOUR)));
  const [shared, setShared] = useState(plan?.shared ?? false);
  const refresh = () => [getPlansQueryKey()];
  const create = useCommand(postPlansMutation(), refresh, t('form.created'));
  const update = useCommand(patchPlansByPlanIdMutation(), refresh, t('form.saved'));
  const fixed = plan?.waves.some((w) => w.armyId != null) ?? false;
  const size = BALANCE.mapSize;
  const coords = { min: 0, max: size - 1 };
  const placed = textInRange(x, coords) && textInRange(y, coords);
  const landAt = landingTime(when.date, when.time);
  // a plan's own second, left as it was, is never refused (it may be near or past by now)
  const problem =
    landAt == null
      ? t('form.invalid')
      : landAt === plan?.landAt
        ? null
        : landAt <= now
          ? t('form.past')
          : landAt - now > BALANCE.landAtMaxAheadMs
            ? t('form.tooFar', { time: duration(BALANCE.landAtMaxAheadMs) })
            : null;
  const pending = create.isPending || update.isPending;
  const save = () => {
    if (landAt == null) return;
    const body = { name: name.trim(), targetTileId: Number(y) * size + Number(x), landAt, shared };
    if (plan) update.mutate({ path: { planId: plan.id }, body }, { onSuccess: onDone });
    else create.mutate({ body }, { onSuccess: () => setName('') });
  };
  return (
    <div className="grid gap-3 text-sm">
      <p className="text-xs text-muted-foreground tabular-nums">{t('form.serverTime', { time: utcClock(now) })}</p>
      <div className="grid gap-1">
        <Label htmlFor={`plan-name-${plan?.id ?? 'new'}`} className="text-xs">
          {t('form.name')}
        </Label>
        <Input
          id={`plan-name-${plan?.id ?? 'new'}`}
          className="h-8"
          value={name}
          maxLength={40}
          placeholder={t('form.namePlaceholder')}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="grid gap-1">
          <Label className="text-xs">{t('form.x')}</Label>
          <NumberField className="h-8" aria-label={t('form.x')} placeholder="x" range={coords} blank disabled={fixed} value={x} onChange={setX} />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">{t('form.y')}</Label>
          <NumberField className="h-8" aria-label={t('form.y')} placeholder="y" range={coords} blank disabled={fixed} value={y} onChange={setY} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`plan-date-${plan?.id ?? 'new'}`} className="text-xs">
            {t('form.date')}
          </Label>
          <Input
            id={`plan-date-${plan?.id ?? 'new'}`}
            type="date"
            className="h-8"
            disabled={fixed}
            value={when.date}
            onChange={(e) => setWhen({ ...when, date: e.target.value })}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`plan-time-${plan?.id ?? 'new'}`} className="text-xs">
            {t('form.time')}
          </Label>
          <Input
            id={`plan-time-${plan?.id ?? 'new'}`}
            type="time"
            step={1}
            className="h-8 tabular-nums"
            disabled={fixed}
            value={when.time}
            onChange={(e) => setWhen({ ...when, time: e.target.value })}
          />
        </div>
      </div>
      {fixed && <p className="text-xs text-muted-foreground">{t('form.fixed')}</p>}
      {problem && <p className={cn('text-xs', LOSS_TEXT)}>{problem}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" disabled={!name.trim() || !placed || problem != null || pending} onClick={save}>
          {plan ? t('common:actions.save') : t('form.create')}
        </Button>
        {onDone && (
          <Button size="sm" variant="outline" onClick={onDone}>
            {t('common:actions.cancel')}
          </Button>
        )}
        {(inAlliance || shared) && (
          <div className="flex items-center gap-2">
            <Switch id={`plan-shared-${plan?.id ?? 'new'}`} checked={shared} onCheckedChange={setShared} />
            <Label htmlFor={`plan-shared-${plan?.id ?? 'new'}`} className="text-xs">
              {t('form.shared')}
            </Label>
          </div>
        )}
      </div>
    </div>
  );
}
