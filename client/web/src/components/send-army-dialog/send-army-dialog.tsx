import type { CityBean } from '@marchlands/api-client';

import { SendForm } from '@/components/send-army-dialog/send-form/send-form';
import type { SendTarget } from '@/components/send-army-dialog/types';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useSticky } from '@/hooks/use-sticky';

export function SendArmyDialog({ city, target, onClose }: { city: CityBean; target: SendTarget | null; onClose: () => void }) {
  const shown = useSticky(target);
  return (
    <Dialog open={target != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg lg:max-w-4xl">
        {shown && <SendForm key={shown.tileId} city={city} target={shown} />}
      </DialogContent>
    </Dialog>
  );
}
