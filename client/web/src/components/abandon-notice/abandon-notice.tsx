import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { type CityBean, deleteCitiesAbandonMutation, getCitiesByCityIdQueryKey, getPlayerQueryKey } from '@marchlands/api-client';
import { BALANCE } from '@marchlands/core';

import { ConfirmDialog } from '@/components/confirm-dialog/confirm-dialog';
import { Countdown } from '@/components/countdown/countdown';
import { Button } from '@/components/ui/button';
import { useCommand } from '@/hooks/use-game';
import { duration } from '@/lib/format';
import { LOSS_TEXT } from '@/lib/tones';
import { cn } from '@/lib/utils';

/** A city being abandoned (docs/features/abandoning-a-city.md): the time it has left, and the way to keep it. Nothing for any other city. */
export function AbandonNotice({ city, className }: { city: Pick<CityBean, 'id' | 'name' | 'abandonAt' | 'movedOut'>; className?: string }) {
  const { t } = useTranslation('abandon-notice');
  const [asking, setAsking] = useState(false);
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
      <Button
        size="xs"
        variant="outline"
        disabled={keep.isPending}
        onClick={() => (city.movedOut ? setAsking(true) : keep.mutate({ path: { cityId: city.id } }))}
      >
        {t('keep')}
      </Button>
      {asking && (
        <ConfirmDialog
          open
          onOpenChange={setAsking}
          title={t('keepMovedTitle', { city: city.name })}
          description={t('keepMovedDescription', { time: duration(BALANCE.abandon.moveOutCooldownMs) })}
          confirmLabel={t('keep')}
          onConfirm={() => keep.mutateAsync({ path: { cityId: city.id } })}
        />
      )}
    </div>
  );
}
