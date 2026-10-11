import { useTranslation } from 'react-i18next';
import type { UnlockKind } from '@marchlands/core';
import { unlockName } from '@/components/buildings-panel/building-dialog/unlocks/utils';

export function Unlocks({ list }: { list: { kind: UnlockKind; id: number; level: number }[] }) {
  const { t } = useTranslation(['buildings-panel', 'common']);
  if (!list.length) return null;
  return (
    <p className="text-xs text-muted-foreground">
      {t('common:level.unlocks', {
        list: list.map((u) => t('common:level.namedParens', { name: unlockName(u), level: u.level })).join(t('common:list.separator')),
      })}
    </p>
  );
}
