import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { BuildingBean } from '@marchlands/api-client';

import { BUILDING_ART } from '@/components/buildings-panel/constants';
import { Countdown } from '@/components/countdown/countdown';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { artBand, buildingArtFile } from '@/lib/game-art';
import { buildingName } from '@/lib/game-data';
import { cn } from '@/lib/utils';

/**
 * One building slot: a square card filled by the building's sprite for its level band, with the level in the corner
 * (and the time left while it is being built). The name shows on hover and opens with the building on a tap.
 */
export function Slot({
  pos,
  building,
  locked,
  fixedName,
  onClick,
}: {
  pos: number;
  building?: BuildingBean;
  locked?: boolean;
  fixedName?: string;
  onClick: () => void;
}) {
  const { t } = useTranslation(['buildings-panel', 'common']);
  if (locked) return <div className="aspect-square rounded-md border border-dashed opacity-40" />;
  if (!building || building.typeId === 0) {
    return (
      <button
        onClick={onClick}
        className="flex aspect-square w-full items-center justify-center rounded-md border border-dashed p-1 text-center text-xs text-muted-foreground transition hover:bg-muted"
        aria-label={t('slot.build', { pos })}
      >
        {fixedName ?? <Plus className="size-4" />}
      </button>
    );
  }
  const name = buildingName(building.typeId);
  const art = BUILDING_ART[buildingArtFile(building.typeId, artBand(building.level))];
  const busy = building.status !== 0;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          aria-label={t('slot.building', { name, level: building.level })}
          className={cn(
            'relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-md border bg-muted/30 transition hover:bg-muted',
            busy && 'border-amber-500',
          )}
        >
          {art ? (
            <img src={art} alt="" width={32} height={32} loading="lazy" decoding="async" className="size-full object-contain p-1 [image-rendering:pixelated]" />
          ) : (
            <span className="line-clamp-2 px-1 text-xs font-medium">{name}</span>
          )}
          <span className="absolute bottom-1 start-1 rounded bg-background/85 px-1 text-[11px] leading-4 font-medium tabular-nums">
            {t('common:level.short', { level: building.level })}
          </span>
          {busy && (
            <span className="absolute top-1 end-1 rounded bg-background/85 px-1 text-[11px] leading-4 text-amber-600 tabular-nums">
              <Countdown endTime={building.endTime} />
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent>{name}</TooltipContent>
    </Tooltip>
  );
}
