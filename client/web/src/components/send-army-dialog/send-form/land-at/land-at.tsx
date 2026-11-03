import { Trans, useTranslation } from 'react-i18next';

import { BALANCE } from '@marchlands/core';

import { Countdown } from '@/components/countdown/countdown';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useServerNow } from '@/hooks/use-server-now';
import { duration, utcClock } from '@/lib/format';
import { firstLanding, landingTime, utcFields } from '@/lib/landing-time';
import { clockOffset } from '@/lib/server-clock';
import { LOSS_TEXT } from '@/lib/tones';
import { cn } from '@/lib/utils';

/**
 * Camp times (docs/features/camp-times.md): land the army at a chosen second, in UTC, by the server's clock. The army
 * waits at home and leaves in time; `marchMs` is the march for the troops chosen (null until there are some).
 */
export function LandAt({
  marchMs,
  value,
  onChange,
}: {
  marchMs: number | null;
  value: { date: string; time: string } | null;
  onChange: (v: { date: string; time: string } | null) => void;
}) {
  const { t } = useTranslation('send-army-dialog');
  const now = useServerNow();
  const land = value ? landingTime(value.date, value.time) : null;
  const leaves = land != null && marchMs != null ? land - marchMs : null;
  const problem =
    value && land == null
      ? t('landAt.invalid')
      : leaves != null && leaves < now
        ? t('landAt.tooSoon', { time: duration(marchMs ?? 0) })
        : land != null && land - now > BALANCE.landAtMaxAheadMs
          ? t('landAt.tooLate', { time: duration(BALANCE.landAtMaxAheadMs) })
          : null;
  return (
    <div className="grid gap-2 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="land-at" className="font-medium">
          {t('landAt.toggle')}
        </Label>
        <Switch
          id="land-at"
          checked={value != null}
          onCheckedChange={(on) => onChange(on ? utcFields(firstLanding(Date.now() + clockOffset(), marchMs ?? 0)) : null)}
        />
      </div>
      <p className="text-xs text-muted-foreground tabular-nums">{t('landAt.serverTime', { time: utcClock(now) })}</p>
      {value && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1">
              <Label htmlFor="land-at-date" className="text-xs">
                {t('landAt.date')}
              </Label>
              <Input id="land-at-date" type="date" className="h-8" value={value.date} onChange={(e) => onChange({ ...value, date: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="land-at-time" className="text-xs">
                {t('landAt.time')}
              </Label>
              <Input
                id="land-at-time"
                type="time"
                step={1}
                className="h-8 tabular-nums"
                value={value.time}
                onChange={(e) => onChange({ ...value, time: e.target.value })}
              />
            </div>
          </div>
          {problem ? (
            <p className={cn('text-xs', LOSS_TEXT)}>{problem}</p>
          ) : (
            leaves != null && (
              <p className="text-xs text-muted-foreground tabular-nums">
                <Trans
                  t={t}
                  i18nKey="landAt.leaves"
                  values={{ time: utcClock(leaves) }}
                  components={{ timer: <Countdown endTime={leaves - clockOffset()} /> }}
                />
              </p>
            )
          )}
        </>
      )}
    </div>
  );
}
