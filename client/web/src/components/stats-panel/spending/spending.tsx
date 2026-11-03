import { useTranslation } from 'react-i18next';

import { ResourceIcon } from '@/components/resource-icon/resource-icon';
import { SectionId } from '@/components/stats-panel/section/constants';
import { Section } from '@/components/stats-panel/section/section';
import { SpendingTable } from '@/components/stats-panel/spending/spending-table/spending-table';
import { honorSpent, spendingRows } from '@/components/stats-panel/spending/utils';
import type { Counters } from '@/components/stats-panel/types';
import { fmt, fmtExact, resourceLabel } from '@/lib/format';

/** What the resources were spent on: a line a thing, with what it took of each resource. */
export function Spending({ c, className }: { c: Counters; className?: string }) {
  const { t } = useTranslation(['stats-panel', 'common']);
  const rows = spendingRows(c);
  const honor = honorSpent(c);
  return (
    <Section
      className={className}
      title={t('spending.title')}
      description={honor ? t('spending.descriptionHonor', { honor: fmt(honor) }) : t('spending.description')}
      table={{ id: SectionId.SPENDING, view: <SpendingTable c={c} /> }}
    >
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('common:nothingYet')}</p>
      ) : (
        <ul className="grid divide-y text-sm">
          {rows.map(({ group, label, amounts }) => (
            <li key={group} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
              <span>{label}</span>
              <span className="flex flex-wrap gap-x-3 gap-y-1">
                {amounts.map(({ resource, amount }) => (
                  <span
                    key={resource}
                    className="flex items-center gap-1 tabular-nums"
                    title={t('spending.amount', { resource: resourceLabel(resource), amount: fmtExact(amount) })}
                  >
                    <ResourceIcon resource={resource} />
                    {fmt(amount)}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
