import type { HeroBean } from '@marchlands/api-client';

import { HeroItems } from '@/components/hero-items-dialog/hero-items/hero-items';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useSticky } from '@/hooks/use-sticky';

export function HeroItemsDialog({ hero, cityId, onClose }: { hero: HeroBean | null; cityId: number; onClose: () => void }) {
  const shown = useSticky(hero);
  return (
    <Dialog open={hero != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-2xl">{shown && <HeroItems hero={shown} cityId={cityId} />}</DialogContent>
    </Dialog>
  );
}
