import type { HeroBean } from '@marchlands/api-client';
import { heroManagement, heroPower, heroStratagem } from '@marchlands/core';
import { ConfirmDialog } from '@/components/confirm-dialog/confirm-dialog';
import { useSticky } from '@/hooks/use-sticky';

/** Asks before a hero is dismissed for good. */
export function DismissHeroDialog({ hero, onCancel, onConfirm }: { hero: HeroBean | null; onCancel: () => void; onConfirm: (h: HeroBean) => unknown }) {
  const shown = useSticky(hero);
  return (
    <ConfirmDialog
      open={hero != null}
      onOpenChange={(o) => !o && onCancel()}
      title={`Dismiss ${shown?.name ?? ''}?`}
      description={
        shown &&
        `${shown.name} (Lv ${shown.level}, att ${heroPower(shown)} · pol ${heroManagement(shown)} · int ${heroStratagem(shown)}) will leave your city for good. This cannot be undone.`
      }
      cancelLabel={`Keep ${shown?.name ?? ''}`}
      confirmLabel="Dismiss"
      onConfirm={() => shown && onConfirm(shown)}
    />
  );
}
