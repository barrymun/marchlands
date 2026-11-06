import { Loader2Icon } from 'lucide-react';
import { Suspense, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { HeroBean, LordGear } from '@marchlands/api-client';
import { type GearPieceId, gearStarLimit, gearTier } from '@marchlands/core';

import { GearIcon } from '@/components/hero-gear/gear-icon/gear-icon';
import { Stars } from '@/components/hero-gear/stars/stars';
import {
  DOLL_LEFT,
  DOLL_RIGHT,
  DollSide,
  FIGURE_MODES,
  FigureMode,
  HeroFigure3d,
} from '@/components/heroes-panel/hero-sheet/character-sheet/paper-doll/constants';
import { HeroFigure } from '@/components/heroes-panel/hero-sheet/character-sheet/paper-doll/hero-figure/hero-figure';
import { figureBody, wornLevel } from '@/components/heroes-panel/hero-sheet/character-sheet/paper-doll/hero-figure/utils';
import { figureMode, saveFigureMode, webglWorks } from '@/components/heroes-panel/hero-sheet/character-sheet/paper-doll/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { gearName } from '@/lib/game-data';
import { cn } from '@/lib/utils';

/**
 * The hero wearing its gear at the level it can use (its gear tier, no higher than researched), the 14 pieces round it
 * with their stars in use for this hero; a piece opens the Gear tab, where stars are bought. The figure is drawn in 3D
 * or as the 2D pixel art, as the player last chose (2D · 3D under it, docs/features/hero-3d.md); 2D only without WebGL
 * or if it fails. While the 3D code loads, a spinner stands in its place rather than the 2D figure, which would flicker.
 */
export function PaperDoll({ hero, gear, onPiece }: { hero: HeroBean; gear: LordGear; onPiece: () => void }) {
  const { t } = useTranslation('heroes-panel');
  const level = wornLevel(hero.level, gear.level);
  // stars count up to the research level and the hero's tier
  const used = Math.min(gearStarLimit(gear), gearTier(hero.level));
  const body = useMemo(() => figureBody(hero.id, hero.sex), [hero.id, hero.sex]);
  const [webgl] = useState(webglWorks);
  const [mode, setMode] = useState(figureMode);
  const choose = (m: FigureMode) => {
    setMode(m);
    saveFigureMode(m);
  };
  const flat = <HeroFigure body={body} level={level} label={t('sheet.figure', { name: hero.name, level })} className="size-48 @3xl:size-72" />;
  const column = (pieces: readonly GearPieceId[], side: DollSide) => (
    <ul className="grid gap-1.5">
      {pieces.map((piece) => (
        <li key={piece}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onPiece}
                aria-label={t('sheet.piece', { piece: gearName(piece), level })}
                className={cn('flex items-center gap-1.5 rounded-md p-0.5 hover:bg-muted', side === DollSide.LEFT && 'flex-row-reverse')}
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
      {column(DOLL_LEFT, DollSide.LEFT)}
      <div className="flex flex-col items-center gap-1">
        {/* one size for both, so switching doesn't move the sheet */}
        <div className="grid size-64 place-items-center @3xl:size-72">
          {webgl && mode === FigureMode.THREE_D ? (
            <Suspense
              fallback={
                <div role="status" className="grid place-items-center">
                  <Loader2Icon aria-hidden className="size-8 animate-spin text-muted-foreground motion-reduce:animate-none" />
                  <span className="sr-only">{t('sheet.figureLoading')}</span>
                </div>
              }
            >
              <HeroFigure3d
                hero={hero.id}
                body={body}
                level={level}
                label={t('sheet.figure3d', { name: hero.name, level })}
                fallback={flat}
                className="size-64"
              />
            </Suspense>
          ) : (
            flat
          )}
        </div>
        {webgl && (
          <div className="flex gap-1" role="group" aria-label={t('sheet.figureMode.label')}>
            {FIGURE_MODES.map((m) => (
              <Button key={m} size="xs" variant={mode === m ? 'default' : 'outline'} aria-pressed={mode === m} onClick={() => choose(m)}>
                {t(`sheet.figureMode.${m}`)}
              </Button>
            ))}
          </div>
        )}
      </div>
      {column(DOLL_RIGHT, DollSide.RIGHT)}
    </div>
  );
}
