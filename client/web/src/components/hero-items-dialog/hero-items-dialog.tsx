import type { HeroBean } from '@marchlands/api-client';
import { useSticky } from '@/hooks/use-sticky';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { HeroItems } from '@/components/hero-items-dialog/hero-items/hero-items';

export function HeroItemsDialog({ hero, cityId, onClose }: { hero: HeroBean | null; cityId: number; onClose: () => void }) {
  const shown = useSticky(hero);
  return (
    <Dialog open={hero != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">{shown && <HeroItems hero={shown} cityId={cityId} />}</DialogContent>
    </Dialog>
  );
}
