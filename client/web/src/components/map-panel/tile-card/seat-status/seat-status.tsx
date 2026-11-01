import { useTranslation } from 'react-i18next';

import type { CityBean } from '@marchlands/api-client';
import { BALANCE, HISTORIC_LEVELS } from '@marchlands/core';

import { useServerNow } from '@/hooks/use-server-now';
import { fmt, fmtExact, realHourly } from '@/lib/format';
import { WARN_TEXT } from '@/lib/tones';
import { cn } from '@/lib/utils';

/**
 * One of the player's historic cities, on its tile's card (docs/features/historical-cities.md): its loyalty, what it
 * lacks (losing it loyalty, until at 0 it rises up), what holding it costs an hour and the share its alliance gets.
 */
export function SeatStatus({ seat }: { seat: CityBean }) {
  const { t } = useTranslation('map-panel');
  const now = useServerNow();
  const level = HISTORIC_LEVELS.find((l) => l === seat.historicLevel);
  if (!level) return null;
  const r = seat.resource;
  const truce = seat.truceUntil > now;
  return (
    <div className="grid gap-0.5 text-xs">
      <p className={cn('tabular-nums', seat.seatNeglect.length > 0 && WARN_TEXT)}>
        {t('seat.loyalty', { loyalty: fmtExact(seat.seatLoyalty), max: fmtExact(BALANCE.historic.loyalty) })}
      </p>
      {truce && <p className="text-muted-foreground">{t('seat.truce')}</p>}
      {seat.seatNeglect.map((n) => (
        <p key={n} className={WARN_TEXT}>
          {n === 'garrison' ? t('seat.garrison', { troops: fmtExact(BALANCE.historic.unrest.garrison[level]) }) : t('seat.unpaid')}
        </p>
      ))}
      <p className="text-muted-foreground">{t('seat.upkeep', { gold: fmt(realHourly(r.seatUpkeepGold)), food: fmt(realHourly(r.seatUpkeepFood)) })}</p>
      {r.tributeShared > 0 && <p className="text-muted-foreground">{t('seat.shared', { gold: fmt(realHourly(r.tributeShared)) })}</p>}
    </div>
  );
}
