import { useTranslation } from 'react-i18next';

import { BarRow } from '@/components/stats-panel/bar-row/bar-row';
import { TOP_ENEMIES } from '@/components/stats-panel/enemies/constants';
import { enemyRows } from '@/components/stats-panel/enemies/utils';
import { Section } from '@/components/stats-panel/section/section';
import type { Counters } from '@/components/stats-panel/types';
import { shareOf, unitName } from '@/components/stats-panel/utils';
import { fmt } from '@/lib/format';

/** The enemy troops and fortifications destroyed, most first, the rest added up in one row. */
export function Enemies({ c }: { c: Counters }) {
  const { t } = useTranslation(['stats-panel', 'common']);
  const { rows, rest } = enemyRows(c, TOP_ENEMIES);
  const most = rows[0]?.count ?? 0;
  return (
    <Section title={t('enemies.title')} description={t('enemies.description')}>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('common:noneYet')}</p>
      ) : (
        <div className="grid">
          {rows.map(({ key, count }) => (
            <BarRow key={key} label={unitName(key)} value={count} segments={[{ share: shareOf(count, most), className: 'bg-foreground/60' }]} />
          ))}
          {rest.types > 0 && <BarRow muted label={t('enemies.more', { count: rest.types, n: fmt(rest.types) })} value={rest.count} segments={[]} />}
        </div>
      )}
    </Section>
  );
}
