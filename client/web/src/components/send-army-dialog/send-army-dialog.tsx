import type { CityBean } from '@marchlands/api-client';

import { SendForm } from '@/components/send-army-dialog/send-form/send-form';
import type { PlanSlot, SendTarget } from '@/components/send-army-dialog/types';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useSticky } from '@/hooks/use-sticky';

/** Send an army to the target, or with a `slot` (the Plans panel) add a wave to that plan. */
export function SendArmyDialog({ city, target, slot, onClose }: { city: CityBean; target: SendTarget | null; slot?: PlanSlot; onClose: () => void }) {
  const shown = useSticky(target);
  return (
    <Dialog open={target != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg lg:max-w-4xl">
        {/* a new city or target starts the form afresh (its hero and troops are that city's) */}
        {shown && <SendForm key={`${shown.tileId}-${city.id}`} city={city} target={shown} slot={slot} />}
      </DialogContent>
    </Dialog>
  );
}
