import { useTranslation } from 'react-i18next';

import type { CityBean } from '@marchlands/api-client';

import { usePlayer } from '@/hooks/use-game';
import { useGameNav } from '@/hooks/use-game-nav';
import { cn } from '@/lib/utils';
import { HistoricBadge } from '@/routes/game/historic-badge/historic-badge';
import { MayorSummary } from '@/routes/game/mayor-summary/mayor-summary';
import { mayorOf } from '@/routes/game/utils';

/** The player's cities, the current one marked and historic cities badged; picking one switches to it on the same screen. */
export function CityList({ city, onPick }: { city?: CityBean; onPick?: () => void }) {
  const { t } = useTranslation('game');
  const nav = useGameNav();
  const cities = usePlayer().data?.castles ?? [];
  return (
    <section aria-label={t('yourCities')} className="grid gap-1">
      <h2 className="text-xs font-medium text-muted-foreground">{t('yourCities')}</h2>
      {cities.map((c) => {
        const here = c.id === nav.cityId;
        return (
          <button
            key={c.id}
            type="button"
            aria-current={here ? 'true' : undefined}
            className={cn(
              'grid gap-1 rounded-md border px-2.5 py-1.5 text-start text-sm transition hover:bg-muted',
              here ? 'border-primary/60 bg-muted/60' : 'border-transparent',
            )}
            onClick={() => {
              // this city too: picking it shows it (the map goes back to it)
              nav.toCity(c.id);
              onPick?.();
            }}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <span className={cn('truncate', here && 'font-semibold')}>
                {c.name}{' '}
                <span className="font-normal text-muted-foreground tabular-nums">
                  ({c.x},{c.y})
                </span>
              </span>
              <HistoricBadge level={c.historicLevel} />
            </span>
            <MayorSummary mayor={mayorOf(here && city ? city : c)} />
          </button>
        );
      })}
    </section>
  );
}
