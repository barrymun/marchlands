import { useTranslation } from 'react-i18next';

import { ItemIcon } from '@/components/item-icon/item-icon';
import { Section } from '@/components/stats-panel/section/section';
import type { Counters } from '@/components/stats-panel/types';
import { fmt, fmtExact } from '@/lib/format';
import { itemName } from '@/lib/game-data';

/** The items the player used, most first, each with its icon. */
export function ItemsUsed({ c, className }: { c: Counters; className?: string }) {
  const { t } = useTranslation(['stats-panel', 'common']);
  const used = Object.entries(c)
    .filter(([k, v]) => k.startsWith('items.used.') && v > 0)
    .map(([k, v]) => [k.slice('items.used.'.length), v] as const)
    .sort((a, b) => b[1] - a[1]);
  return (
    <Section className={className} title={t('itemsUsed.title')}>
      {used.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('common:noneYet')}</p>
      ) : (
        <ul className="grid gap-x-6 sm:grid-cols-2 xl:grid-cols-3">
          {used.map(([id, n]) => (
            <li key={id} className="flex items-center gap-2 border-b py-1.5 text-sm">
              <ItemIcon id={id} />
              <span className="min-w-0 flex-1 truncate">{itemName(id)}</span>
              <span className="tabular-nums" title={fmtExact(n)}>
                {fmt(n)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
