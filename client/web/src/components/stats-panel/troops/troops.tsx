import { useTranslation } from 'react-i18next';

import { BarRow } from '@/components/stats-panel/bar-row/bar-row';
import { UnitGroup } from '@/components/stats-panel/constants';
import { SectionId } from '@/components/stats-panel/section/constants';
import { Section } from '@/components/stats-panel/section/section';
import { UNIT_COLUMNS } from '@/components/stats-panel/troops/units-table/constants';
import { UnitsTable } from '@/components/stats-panel/troops/units-table/units-table';
import { troopBar, troopRows } from '@/components/stats-panel/troops/utils';
import type { Counters } from '@/components/stats-panel/types';
import { shareOf, unitName } from '@/components/stats-panel/utils';
import { fmtExact } from '@/lib/format';

/** The player's own troops and fortifications: a bar each as long as those trained, the part that fell for good in red. */
export function Troops({ c }: { c: Counters }) {
  const { t } = useTranslation(['stats-panel', 'common']);
  const rows = troopRows(c);
  const most = Math.max(0, ...rows.map((r) => troopBar(r).total));
  return (
    <Section title={t('troops.title')} description={t('troops.description')} table={{ id: SectionId.TROOPS, view: <UnitsTable c={c} /> }}>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('common:nothingYet')}</p>
      ) : (
        <div className="grid gap-2">
          <div className="grid">
            {rows.map((r) => {
              const { total, fell } = troopBar(r);
              return (
                <BarRow
                  key={r.key}
                  label={unitName(r.key)}
                  value={r.trained}
                  segments={[
                    { share: shareOf(total - fell, most), className: 'bg-foreground/60' },
                    { share: shareOf(fell, most), className: 'bg-destructive' },
                  ]}
                  tip={
                    <dl className="grid grid-cols-[auto_auto] gap-x-3">
                      {UNIT_COLUMNS.flatMap((col) => (col.group === UnitGroup.KILLED ? [] : [col])).map(({ group, label }) => (
                        <div key={group} className="contents">
                          <dt>{label}</dt>
                          <dd className="text-end tabular-nums">{fmtExact(r[group])}</dd>
                        </div>
                      ))}
                    </dl>
                  }
                />
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-xs bg-foreground/60" aria-hidden />
              {t('troops.trained')}
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-xs bg-destructive" aria-hidden />
              {t('troops.fell')}
            </span>
          </div>
        </div>
      )}
    </Section>
  );
}
