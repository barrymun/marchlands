import { useTranslation } from 'react-i18next';

import { TrendKey } from '@marchlands/core';

import { StatTile } from '@/components/stats-panel/headline/stat-tile/stat-tile';
import { headline } from '@/components/stats-panel/headline/utils';
import type { Counters } from '@/components/stats-panel/types';
import { unitName } from '@/components/stats-panel/utils';
import { fmt, percent } from '@/lib/format';

/** The page's first row: the few numbers that sum it up, each with a line about it and its trend over `days`. */
export function Headline({ c, days, trend }: { c: Counters; days: string[]; trend: Partial<Record<string, number[]>> }) {
  const { t } = useTranslation('stats-panel');
  const h = headline(c);
  const line = (key: TrendKey) => ({ days, values: trend[key] ?? [] });
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-3">
      <StatTile
        label={t('headline.attacksWon')}
        value={h.attacksWon}
        trend={line(TrendKey.ATTACKS_WON)}
        sub={h.attacks > 0 && t('headline.attacksOf', { count: h.attacks, n: fmt(h.attacks), share: percent(h.attacksWon / h.attacks, 1) })}
      />
      {h.defenses > 0 && (
        <StatTile
          label={t('headline.defensesWon')}
          value={h.defensesWon}
          trend={line(TrendKey.DEFENSES_WON)}
          sub={t('headline.defensesOf', { count: h.defenses, n: fmt(h.defenses), share: percent(h.defensesWon / h.defenses, 1) })}
        />
      )}
      <StatTile label={t('headline.honorGained')} value={h.honor} trend={line(TrendKey.HONOR)} />
      <StatTile
        label={t('headline.enemies')}
        value={h.enemies}
        sub={h.topEnemy && t('headline.enemiesMost', { unit: unitName(h.topEnemy) })}
        trend={line(TrendKey.ENEMIES)}
      />
      <StatTile
        label={t('headline.trained')}
        value={h.trained}
        sub={h.fell > 0 && t('headline.fell', { count: h.fell, n: fmt(h.fell) })}
        trend={line(TrendKey.TRAINED)}
      />
      <StatTile
        label={t('headline.citiesCaptured')}
        value={h.citiesCaptured}
        trend={line(TrendKey.CAPTURED)}
        sub={h.valleys > 0 && t('headline.valleys', { count: h.valleys, n: fmt(h.valleys) })}
      />
    </div>
  );
}
