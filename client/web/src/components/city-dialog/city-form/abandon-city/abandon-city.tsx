import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { CityBean } from '@marchlands/api-client';
import { BALANCE } from '@marchlands/core';

import { AbandonNotice } from '@/components/abandon-notice/abandon-notice';
import { AbandonConfirm } from '@/components/city-dialog/city-form/abandon-city/abandon-confirm/abandon-confirm';
import { keepsRegularCity } from '@/components/city-dialog/city-form/abandon-city/utils';
import { Button } from '@/components/ui/button';
import { usePlayer } from '@/hooks/use-game';
import { duration } from '@/lib/format';
import { LOSS_TEXT } from '@/lib/tones';

/** Giving the city up (docs/features/abandoning-a-city.md): what it means, the way in, and the time left once it's started. */
export function AbandonCity({ city }: { city: CityBean }) {
  const { t } = useTranslation('city-dialog');
  const castles = usePlayer().data?.castles ?? [];
  const [confirming, setConfirming] = useState(false);
  if (city.abandonAt) return <AbandonNotice city={city} />;
  const allowed = keepsRegularCity(castles, city.id);
  return (
    <div className="grid gap-2">
      <p className={`text-xs ${LOSS_TEXT}`}>{t('abandon.warning', { time: duration(BALANCE.abandon.delayMs) })}</p>
      {!allowed && <p className="text-xs text-muted-foreground">{t('abandon.keepRegular')}</p>}
      <Button variant="destructive" className="justify-self-start" disabled={!allowed} onClick={() => setConfirming(true)}>
        {t('abandon.button')}
      </Button>
      {confirming && <AbandonConfirm city={city} onClose={() => setConfirming(false)} />}
    </div>
  );
}
