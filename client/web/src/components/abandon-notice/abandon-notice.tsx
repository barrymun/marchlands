import { Trans, useTranslation } from 'react-i18next';

import { type CityBean, deleteCitiesAbandonMutation, getCitiesByCityIdQueryKey, getPlayerQueryKey } from '@marchlands/api-client';

import { Countdown } from '@/components/countdown/countdown';
import { Button } from '@/components/ui/button';
import { useCommand } from '@/hooks/use-game';
import { LOSS_TEXT } from '@/lib/tones';
import { cn } from '@/lib/utils';

/** A city being abandoned (docs/features/abandoning-a-city.md): the time it has left, and the way to keep it. Nothing for any other city. */
export function AbandonNotice({ city, className }: { city: Pick<CityBean, 'id' | 'name' | 'abandonAt'>; className?: string }) {
  const { t } = useTranslation('abandon-notice');
  const keep = useCommand(
    deleteCitiesAbandonMutation(),
    () => [getCitiesByCityIdQueryKey({ path: { cityId: city.id } }), getPlayerQueryKey()],
    t('kept', { city: city.name }),
  );
  if (!city.abandonAt) return null;
  return (
    <div role="status" className={cn('flex flex-wrap items-center gap-x-2 gap-y-1 text-xs', LOSS_TEXT, className)}>
      <span>
        <Trans t={t} i18nKey="leaving" values={{ city: city.name }} components={{ countdown: <Countdown endTime={city.abandonAt} /> }} />
      </span>
      <Button size="xs" variant="outline" disabled={keep.isPending} onClick={() => keep.mutate({ path: { cityId: city.id } })}>
        {t('keep')}
      </Button>
    </div>
  );
}
