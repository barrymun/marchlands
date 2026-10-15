import type { BuildingBean, CityBean } from '@marchlands/api-client';

import { BuildList } from '@/components/buildings-panel/building-dialog/build-list/build-list';
import { BuildingDetail } from '@/components/buildings-panel/building-dialog/building-detail/building-detail';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useSticky } from '@/hooks/use-sticky';

export function BuildingDialog({
  city,
  positionId,
  building,
  onClose,
}: {
  city: CityBean;
  positionId: number | null;
  building?: BuildingBean;
  onClose: () => void;
}) {
  const open = positionId != null;
  const pos = useSticky(positionId);
  const bld = useSticky(open ? (building ?? { typeId: 0 }) : null);
  const empty = !bld || bld.typeId === 0;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        {pos != null &&
          (empty ? (
            <BuildList city={city} positionId={pos} onDone={onClose} />
          ) : (
            <BuildingDetail city={city} building={bld as BuildingBean} onDone={onClose} />
          ))}
      </DialogContent>
    </Dialog>
  );
}
