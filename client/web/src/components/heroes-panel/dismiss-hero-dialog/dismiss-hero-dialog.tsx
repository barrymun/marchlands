import { useTranslation } from 'react-i18next';
import type { HeroBean } from '@marchlands/api-client';
import { heroManagement, heroPower, heroStratagem } from '@marchlands/core';
import { ConfirmDialog } from '@/components/confirm-dialog/confirm-dialog';
import { useSticky } from '@/hooks/use-sticky';

/** Asks before a hero is dismissed for good. */
export function DismissHeroDialog({ hero, onCancel, onConfirm }: { hero: HeroBean | null; onCancel: () => void; onConfirm: (h: HeroBean) => unknown }) {
  const { t } = useTranslation('heroes-panel');
  const shown = useSticky(hero);
  return (
    <ConfirmDialog
      open={hero != null}
      onOpenChange={(o) => !o && onCancel()}
      title={t('dismissDialog.title', { name: shown?.name ?? '' })}
      description={
        shown &&
        t('dismissDialog.description', {
          name: shown.name,
          level: shown.level,
          att: heroPower(shown),
          pol: heroManagement(shown),
          int: heroStratagem(shown),
        })
      }
      cancelLabel={t('dismissDialog.keep', { name: shown?.name ?? '' })}
      confirmLabel={t('dismissDialog.confirm')}
      onConfirm={() => shown && onConfirm(shown)}
    />
  );
}
