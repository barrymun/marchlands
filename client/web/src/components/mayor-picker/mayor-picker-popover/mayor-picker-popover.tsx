import { Suspense } from 'react';

import type { CityBean } from '@marchlands/api-client';

import { MayorPicker } from '@/components/mayor-picker/constants';
import { PopoverContent } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * The quick mayor swap in a popover, the screen staying in view; goes inside a `Popover` beside its trigger. As tall as the
 * room below the trigger allows (it follows the window's size); only the list of heroes scrolls. Focus goes to the popover
 * itself, not its first Make mayor, whose tooltip would open with it.
 */
export function MayorPickerPopover({ city, onDone }: { city: CityBean; onDone: () => void }) {
  return (
    <PopoverContent
      align="start"
      collisionPadding={8}
      tabIndex={-1}
      onOpenAutoFocus={(e) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).focus();
      }}
      className="max-h-(--radix-popover-content-available-height) w-80 outline-none"
    >
      <Suspense fallback={<Skeleton className="h-24" />}>
        <MayorPicker city={city} onDone={onDone} />
      </Suspense>
    </PopoverContent>
  );
}
