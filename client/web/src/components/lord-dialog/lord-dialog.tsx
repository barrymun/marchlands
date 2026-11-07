import { Suspense } from 'react';

import type { CityBean } from '@marchlands/api-client';

import { LordForm } from '@/components/lord-dialog/constants';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

/** Player-wide actions: rename and change gender (free, once a day each), change flag and its colour (free), truce (bought with `city`'s gold when none is owned). */
export function LordDialog({ open, onClose, city }: { open: boolean; onClose: () => void; city?: CityBean }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-md lg:max-w-3xl">
        <Suspense fallback={<Skeleton className="h-96" />}>
          <LordForm city={city} />
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}
