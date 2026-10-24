import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { HeroBean, LordGear } from '@marchlands/api-client';
import { type GearPieceId, gearStarLimit, gearTier } from '@marchlands/core';

import { GearIcon } from '@/components/hero-gear/gear-icon/gear-icon';
import { Stars } from '@/components/hero-gear/stars/stars';
import { DOLL_LEFT, DOLL_RIGHT } from '@/components/heroes-panel/hero-sheet/character-sheet/paper-doll/constants';
import { HeroFigure } from '@/components/heroes-panel/hero-sheet/character-sheet/paper-doll/hero-figure/hero-figure';
import { figureBody, wornLevel } from '@/components/heroes-panel/hero-sheet/character-sheet/paper-doll/hero-figure/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { gearName } from '@/lib/game-data';
import { cn } from '@/lib/utils';

/**
 * The hero wearing its gear at the level it can use (its gear tier, no higher than researched), the 14 pieces round it
 * with their stars in use for this hero; a piece opens the Gear tab, where stars are bought.
 */
export function PaperDoll({ hero, gear, onPiece }: { hero: HeroBean; gear: LordGear; onPiece: () => void }) {
  const { t } = useTranslation('heroes-panel');
  const level = wornLevel(hero.level, gear.level);
  // stars count up to the research level and the hero's tier
  const used = Math.min(gearStarLimit(gear), gearTier(hero.level));
  const body = useMemo(() => figureBody(hero.id, hero.sex), [hero.id, hero.sex]);
  const column = (pieces: readonly GearPieceId[], side: 'left' | 'right') => (
    <ul className="grid gap-1.5">
      {pieces.map((piece) => (
        <li key={piece}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onPiece}
                aria-label={t('sheet.piece', { piece: gearName(piece), level })}
                className={cn('flex items-center gap-1.5 rounded-md p-0.5 hover:bg-muted', side === 'left' && 'flex-row-reverse')}
              >
                <GearIcon piece={piece} level={level} size={32} />
                <Stars count={gear.stars[piece] ?? 0} used={used} size={9} />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t('sheet.piece', { piece: gearName(piece), level })}</TooltipContent>
          </Tooltip>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="flex items-center justify-center gap-2">
      {column(DOLL_LEFT, 'left')}
      <HeroFigure body={body} level={level} label={t('sheet.figure', { name: hero.name, level })} className="size-48 @3xl:size-72" />
      {column(DOLL_RIGHT, 'right')}
    </div>
  );
}
