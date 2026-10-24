import { useTranslation } from 'react-i18next';

import type { CityBean, HeroBean } from '@marchlands/api-client';

import { BoostChip } from '@/components/hero-summary/boost-chip/boost-chip';
import { HeroStats } from '@/components/hero-summary/hero-stats/hero-stats';
import { canAppoint, isMayor, statusLabel } from '@/components/hero-summary/utils';
import { MakeMayorButton } from '@/components/make-mayor-button/make-mayor-button';
import { Badge } from '@/components/ui/badge';
import { percent, signedRate } from '@/lib/format';
import { mayorGain, mayorShare } from '@/lib/mayor';
import { GAIN_TEXT } from '@/lib/tones';
import { cn } from '@/lib/utils';

/**
 * A hero in a few lines, for the lists with little room (the Heroes page's roster, the mayor swap under the mayor
 * chip): its name and unspent points; its level, its status and its boosts (BoostChip); its stats (HeroStats), and
 * the mayor's bonus or the button to make it mayor. Given `onSelect`, the whole row picks the hero (the name is a
 * button stretched over it), and given `onMove`, Alt with the up or down arrow moves it in the player's order.
 */
export function HeroSummary({
  hero,
  city,
  now,
  current = false,
  onSelect,
  onMove,
}: {
  hero: HeroBean;
  city: CityBean;
  now: number;
  current?: boolean;
  onSelect?: () => void;
  onMove?: (by: -1 | 1) => void;
}) {
  const { t } = useTranslation(['hero-summary', 'common', 'mayor-note']);
  const mayor = isMayor(hero);
  return (
    <div className={cn('relative grid min-w-0 flex-1 gap-1.5 rounded-md px-2 py-1.5 text-sm', onSelect && 'hover:bg-muted')}>
      <span className="flex items-center gap-1.5">
        {onSelect ? (
          <button
            type="button"
            aria-current={current || undefined}
            aria-keyshortcuts={onMove && 'Alt+ArrowUp Alt+ArrowDown'}
            onClick={onSelect}
            onKeyDown={(e) => {
              if (!onMove || !e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
              e.preventDefault();
              onMove(e.key === 'ArrowUp' ? -1 : 1);
            }}
            className={cn(
              'min-w-0 flex-1 truncate text-left after:absolute after:inset-0 after:rounded-md focus-visible:outline-none',
              current && 'font-medium',
            )}
          >
            {hero.name}
          </button>
        ) : (
          <span className="min-w-0 flex-1 truncate font-medium">{hero.name}</span>
        )}
        {hero.remainPoint > 0 && <span className="size-1.5 shrink-0 rounded-full bg-primary" title={t('unspent', { count: hero.remainPoint })} />}
      </span>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
        {t('common:level.short', { level: hero.level })}
        {mayor ? <Badge className="h-4 px-1.5 text-[10px]">{statusLabel(hero)}</Badge> : <span>{statusLabel(hero)}</span>}
        <BoostChip hero={hero} now={now} className="ml-auto" />
      </span>
      <span className="flex min-h-6 items-center gap-1.5 text-xs tabular-nums">
        <HeroStats hero={hero} />
        {mayor && (
          <span className={cn('ml-auto', GAIN_TEXT)} title={t('mayor-note:bonus', { pct: percent(mayorShare(hero)), rate: signedRate(mayorGain(city, hero)) })}>
            +{percent(mayorShare(hero))}
          </span>
        )}
        {canAppoint(hero) && <MakeMayorButton hero={hero} city={city} className="relative z-10 ml-auto" />}
      </span>
    </div>
  );
}
