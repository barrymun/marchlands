import { useTranslation } from 'react-i18next';

import type { CityBean } from '@marchlands/api-client';
import { BALANCE, Feature } from '@marchlands/core';

import { useFeature } from '@/hooks/use-game';
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
  // its loyalty, its truce and the risk are about being taken by another player
  const pvp = useFeature(Feature.PVP);
  if (!seat.historicLevel) return null;
  const r = seat.resource;
  const truce = seat.truceUntil > now;
  return (
    <div className="grid gap-0.5 text-xs">
      {pvp && <p className="tabular-nums">{t('seat.loyalty', { loyalty: fmtExact(seat.seatLoyalty), max: fmtExact(BALANCE.historic.loyalty) })}</p>}
      {pvp && truce && <p className="text-muted-foreground">{t('seat.truce')}</p>}
      {r.tributeShared > 0 && <p className="text-muted-foreground">{t('seat.shared', { gold: fmt(realHourly(r.tributeShared)) })}</p>}
      {pvp && <p className={WARN_TEXT}>{t('seat.risk')}</p>}
    </div>
  );
}
