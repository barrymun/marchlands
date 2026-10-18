import { Plus } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

import type { BuildingBean } from '@marchlands/api-client';
import { BuildingType } from '@marchlands/core';

import { INSIDE } from '@/components/buildings-panel/constants';
import { Slot } from '@/components/buildings-panel/slot/slot';
import { CORNERS, WALL_ART, WALL_SCALE } from '@/components/buildings-panel/walled-city/constants';
import { Countdown } from '@/components/countdown/countdown';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { artBand, wallArtFile, type WallPiece } from '@/lib/game-art';
import { buildingName } from '@/lib/game-data';
import { cn } from '@/lib/utils';

const TOWN_HALL = -1;
const WALLS = -2;

/**
 * The buildings inside the walls, framed by the walls themselves: pixel-art wall pieces for the Walls' level band
 * repeat round the grid (corner towers, the gate in the front wall), the Town Hall sits centre-top, and the gate opens
 * the Walls. With no walls built the frame is a dashed line and the gate a button to build them.
 */
export function WalledCity({ byPos, onSelect }: { byPos: Map<number, BuildingBean>; onSelect: (pos: number) => void }) {
  const { t } = useTranslation(['buildings-panel', 'common']);
  const walls = byPos.get(WALLS);
  const built = !!walls && walls.typeId !== 0;
  const band = built ? artBand(walls.level) : 1;
  const art = (piece: WallPiece, size: number): CSSProperties => ({
    backgroundImage: `url(${WALL_ART[wallArtFile(band, piece)]})`,
    backgroundSize: `${size * WALL_SCALE}px ${size * WALL_SCALE}px`,
  });
  const wallsName = buildingName(BuildingType.WALLS);
  return (
    <div
      className={cn(
        'relative [--cols:3] sm:[--cols:4] lg:[--cols:6]',
        built ? 'px-10 pt-10 pb-20' : 'rounded-md border-2 border-dashed px-3 pt-3 pb-20 text-muted-foreground',
      )}
    >
      {built && (
        <div aria-hidden className="[image-rendering:pixelated]">
          <div className="absolute inset-x-0 top-0 h-8 bg-repeat-x" style={art('wall', 16)} />
          <div className="absolute inset-x-0 bottom-0 h-8 bg-repeat-x" style={art('wall', 16)} />
          <div className="absolute inset-y-0 left-0 w-8 bg-repeat-y" style={art('side', 16)} />
          <div className="absolute inset-y-0 right-0 w-8 -scale-x-100 bg-repeat-y" style={art('side', 16)} />
          {CORNERS.map((at) => (
            <div key={at} className={cn('absolute size-12', at)} style={art('corner', 24)} />
          ))}
        </div>
      )}
      {/* the Town Hall, centre-top, as wide as one column of the grid */}
      <div className="mb-2 flex justify-center">
        <div style={{ width: 'calc((100% - (var(--cols) - 1) * 0.5rem) / var(--cols))' }}>
          <Slot pos={TOWN_HALL} building={byPos.get(TOWN_HALL)} onClick={() => onSelect(TOWN_HALL)} fixedName={buildingName(BuildingType.TOWN_HALL)} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {INSIDE.map((pos) => (
          <Slot key={pos} pos={pos} building={byPos.get(pos)} onClick={() => onSelect(pos)} />
        ))}
      </div>
      {/* the gate: the Walls themselves */}
      {built ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onSelect(WALLS)}
              aria-label={t('slot.building', { name: wallsName, level: walls.level })}
              className={cn(
                'absolute bottom-0 left-1/2 size-16 -translate-x-1/2 rounded-sm [image-rendering:pixelated] transition hover:brightness-110',
                walls.status !== 0 && 'ring-2 ring-amber-500',
              )}
              style={art('gate', 32)}
            >
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded bg-background/85 px-1 text-[10px] leading-4 font-medium whitespace-nowrap tabular-nums">
                {t('common:level.short', { level: walls.level })}
              </span>
              {walls.status !== 0 && (
                <span className="absolute -top-5 left-1/2 -translate-x-1/2 rounded bg-background/85 px-1 text-[10px] leading-4 whitespace-nowrap text-amber-600 tabular-nums">
                  <Countdown endTime={walls.endTime} />
                </span>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>{wallsName}</TooltipContent>
        </Tooltip>
      ) : (
        <button
          onClick={() => onSelect(WALLS)}
          aria-label={t('slot.build', { pos: WALLS })}
          className="absolute bottom-3 left-1/2 flex h-12 -translate-x-1/2 items-center gap-1 rounded-md border border-dashed px-3 text-xs transition hover:bg-muted"
        >
          <Plus className="size-4" />
          {wallsName}
        </button>
      )}
    </div>
  );
}
