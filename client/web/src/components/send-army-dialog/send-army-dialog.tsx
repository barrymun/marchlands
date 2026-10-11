import type { CityBean } from '@marchlands/api-client';
import { useSticky } from '@/hooks/use-sticky';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { SendTarget } from '@/components/send-army-dialog/types';
import { SendForm } from '@/components/send-army-dialog/send-form/send-form';

export function SendArmyDialog({ city, target, onClose }: { city: CityBean; target: SendTarget | null; onClose: () => void }) {
  const shown = useSticky(target);
  return (
    <Dialog open={target != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">{shown && <SendForm key={shown.tileId} city={city} target={shown} />}</DialogContent>
    </Dialog>
  );
}
