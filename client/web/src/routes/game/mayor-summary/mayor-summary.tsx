import { useTranslation } from 'react-i18next';
import type { HeroBean } from '@marchlands/api-client';
import { DominantBadge } from '@/routes/game/dominant-badge/dominant-badge';

/** The city lists' mayor line: the mayor's strongest attribute. */
export function MayorSummary({ mayor }: { mayor?: HeroBean }) {
  const { t } = useTranslation('common');
  if (!mayor) return <span className="text-xs text-amber-700 dark:text-amber-400">{t('noMayor')}</span>;
  return (
    <span className="flex items-start text-xs">
      <DominantBadge hero={mayor} />
    </span>
  );
}
