import type { HeroBean } from '@marchlands/api-client';

import { PointsForm } from '@/components/hero-points-dialog/points-form/points-form';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useSticky } from '@/hooks/use-sticky';

/** Spend a hero's unassigned points (and optionally reset them). `fieldOutput` previews a mayor's production change. */
export function HeroPointsDialog({ hero, cityId, fieldOutput, onClose }: { hero: HeroBean | null; cityId: number; fieldOutput: number; onClose: () => void }) {
  const shown = useSticky(hero);
  return (
    <Dialog open={hero != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        {shown && <PointsForm key={`${shown.id}-${shown.remainPoint}`} hero={shown} cityId={cityId} fieldOutput={fieldOutput} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
