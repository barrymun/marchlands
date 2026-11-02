import type { CityBean } from '@marchlands/api-client';
import { LordForm } from '@/components/lord-dialog/lord-form/lord-form';
import { Dialog, DialogContent } from '@/components/ui/dialog';

/** Player-wide actions: rename and change gender (free, once a day each), change flag (free), truce (bought with `city`'s gold when none is owned). */
export function LordDialog({ open, onClose, city }: { open: boolean; onClose: () => void; city?: CityBean }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-md lg:max-w-3xl">
        <LordForm city={city} />
      </DialogContent>
    </Dialog>
  );
}
