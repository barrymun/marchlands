import type { CityBean } from '@marchlands/api-client';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CityForm } from '@/components/city-dialog/city-form/city-form';

/** City settings: rename, and moving the city to a chosen free flat with a City Teleporter (bought with the city's gold when none is owned). */
export function CityDialog({ city, open, onClose, target }: { city: CityBean; open: boolean; onClose: () => void; target?: { x: number; y: number } }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-md">
        <CityForm city={city} target={target} onDone={onClose} />
      </DialogContent>
    </Dialog>
  );
}
