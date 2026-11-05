import { useTranslation } from 'react-i18next';

import type { CityBean } from '@marchlands/api-client';
import { BALANCE } from '@marchlands/core';

import { useServerNow } from '@/hooks/use-server-now';
import { fmt, fmtExact, realHourly } from '@/lib/format';
import { WARN_TEXT } from '@/lib/tones';

/**
 * One of the player's historic cities, on its tile's card (docs/features/historical-cities.md): its loyalty, its truce
 * the share its alliance gets, and what its holder would lose with it.
 */
export function SeatStatus({ seat }: { seat: CityBean }) {
  const { t } = useTranslation('map-panel');
  const now = useServerNow();
  if (!seat.historicLevel) return null;
  const r = seat.resource;
  const truce = seat.truceUntil > now;
  return (
    <div className="grid gap-0.5 text-xs">
      <p className="tabular-nums">{t('seat.loyalty', { loyalty: fmtExact(seat.seatLoyalty), max: fmtExact(BALANCE.historic.loyalty) })}</p>
      {truce && <p className="text-muted-foreground">{t('seat.truce')}</p>}
      {r.tributeShared > 0 && <p className="text-muted-foreground">{t('seat.shared', { gold: fmt(realHourly(r.tributeShared)) })}</p>}
      <p className={WARN_TEXT}>{t('seat.risk')}</p>
    </div>
  );
}
