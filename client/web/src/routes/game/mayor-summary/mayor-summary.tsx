import { Landmark } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { HeroBean } from '@marchlands/api-client';

import { DominantBadge } from '@/routes/game/dominant-badge/dominant-badge';

/** The city switcher's mayor line: name, then the strongest attribute below it. */
export function MayorSummary({ mayor }: { mayor?: HeroBean }) {
  const { t } = useTranslation(['game', 'common']);
  if (!mayor) return <span className="text-xs text-amber-700 dark:text-amber-400">{t('common:noMayor')}</span>;
  return (
    <span className="flex flex-col items-start gap-1 text-xs">
      <span className="flex items-center gap-1.5 whitespace-nowrap">
        <Landmark className="size-3 text-muted-foreground" />
        <span className="font-medium">{mayor.name}</span>
      </span>
      <DominantBadge hero={mayor} />
    </span>
  );
}
