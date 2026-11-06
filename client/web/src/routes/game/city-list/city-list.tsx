import { Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { CityBean } from '@marchlands/api-client';

import { AbandonNotice } from '@/components/abandon-notice/abandon-notice';
import { Button } from '@/components/ui/button';
import { usePlayer } from '@/hooks/use-game';
import { useGameNav } from '@/hooks/use-game-nav';
import { cn } from '@/lib/utils';
import { HistoricBadge } from '@/routes/game/historic-badge/historic-badge';
import { MayorSummary } from '@/routes/game/mayor-summary/mayor-summary';
import { mayorOf } from '@/routes/game/utils';

/**
 * The player's cities, the current one marked and historic cities badged; picking one switches to it on the same screen,
 * and the button beside each of the others sends an army there from the current one.
 */
export function CityList({ city, onPick, onSend }: { city?: CityBean; onPick?: () => void; onSend: (cityId: number) => void }) {
  const { t } = useTranslation('game');
  const nav = useGameNav();
  const cities = usePlayer().data?.castles ?? [];
  return (
    <section aria-label={t('yourCities')} className="grid gap-1">
      <h2 className="text-xs font-medium text-muted-foreground">{t('yourCities')}</h2>
      {cities.map((c) => {
        const here = c.id === nav.cityId;
        return (
          <div key={c.id} className="grid gap-0.5">
            <div
              className={cn(
                'flex items-center gap-1 rounded-md border pe-1 transition hover:bg-muted',
                here ? 'border-primary/60 bg-muted/60' : 'border-transparent',
              )}
            >
              <button
                type="button"
                aria-current={here ? 'true' : undefined}
                className="grid min-w-0 flex-1 gap-1 py-1.5 ps-2.5 text-start text-sm"
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
              {/* a city can't send an army to itself, and none can go to a city being abandoned */}
              {!here && !c.abandonAt && (
                <Button
                  size="icon-sm"
                  // the row turns the colour a ghost button would on hover, so the button keeps its own border and fills on its own hover
                  variant="outline"
                  className="shrink-0 hover:bg-primary hover:text-primary-foreground dark:hover:bg-primary"
                  title={t('sendTo', { city: c.name })}
                  aria-label={t('sendTo', { city: c.name })}
                  onClick={() => onSend(c.id)}
                >
                  <Send />
                </Button>
              )}
            </div>
            <AbandonNotice city={c} className="ps-2.5" />
          </div>
        );
      })}
    </section>
  );
}
