import { useTranslation } from 'react-i18next';

import { Section } from '@/components/stats-panel/section/section';
import type { Counters } from '@/components/stats-panel/types';
import { sumPrefix } from '@/components/stats-panel/utils';
import { fmt, fmtExact } from '@/lib/format';

/** How the player's cities and heroes grew: levels built, researched and gained, heroes hired, items used (player-wide only). */
export function Growth({ c, playerWide }: { c: Counters; playerWide: boolean }) {
  const { t } = useTranslation('stats-panel');
  const lines: [string, number][] = [
    [t('growth.buildingLevels'), c['levels.building'] ?? 0],
    [t('growth.researchLevels'), c['levels.research'] ?? 0],
    [t('growth.heroLevels'), c['levels.hero'] ?? 0],
    [t('growth.heroesHired'), c['heroes.hired'] ?? 0],
  ];
  if (playerWide) lines.push([t('growth.itemsUsed'), sumPrefix(c, 'items.used.')]);
  return (
    <Section title={t('growth.title')}>
      <dl className="grid divide-y text-sm">
        {lines.map(([label, v]) => (
          <div key={label} className="flex justify-between gap-4 py-2">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="tabular-nums" title={fmtExact(v)}>
              {fmt(v)}
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}
