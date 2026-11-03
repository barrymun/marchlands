import { useTranslation } from 'react-i18next';

import { StatTile } from '@/components/stats-panel/headline/stat-tile/stat-tile';
import { headline } from '@/components/stats-panel/headline/utils';
import type { Counters } from '@/components/stats-panel/types';
import { unitName } from '@/components/stats-panel/utils';
import { fmt, percent } from '@/lib/format';

/** The page's first row: the few numbers that sum it up, each with a line about it. */
export function Headline({ c }: { c: Counters }) {
  const { t } = useTranslation('stats-panel');
  const h = headline(c);
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-3">
      <StatTile
        label={t('headline.attacksWon')}
        value={h.attacksWon}
        sub={h.attacks > 0 && t('headline.attacksOf', { count: h.attacks, n: fmt(h.attacks), share: percent(h.attacksWon / h.attacks, 1) })}
      />
      {h.defenses > 0 && (
        <StatTile
          label={t('headline.defensesWon')}
          value={h.defensesWon}
          sub={t('headline.defensesOf', { count: h.defenses, n: fmt(h.defenses), share: percent(h.defensesWon / h.defenses, 1) })}
        />
      )}
      <StatTile label={t('headline.honorGained')} value={h.honor} />
      <StatTile label={t('headline.enemies')} value={h.enemies} sub={h.topEnemy && t('headline.enemiesMost', { unit: unitName(h.topEnemy) })} />
      <StatTile label={t('headline.trained')} value={h.trained} sub={h.fell > 0 && t('headline.fell', { count: h.fell, n: fmt(h.fell) })} />
      <StatTile
        label={t('headline.citiesCaptured')}
        value={h.citiesCaptured}
        sub={h.valleys > 0 && t('headline.valleys', { count: h.valleys, n: fmt(h.valleys) })}
      />
    </div>
  );
}
