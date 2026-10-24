import { type ReactNode, useRef } from 'react';

import type { FigureBody } from '@/components/heroes-panel/hero-sheet/character-sheet/paper-doll/hero-figure/types';
import { RENDER_SIZE } from '@/components/heroes-panel/hero-sheet/character-sheet/paper-doll/hero-figure-3d/constants';
import { useHeroFigure3d } from '@/components/heroes-panel/hero-sheet/character-sheet/paper-doll/hero-figure-3d/hooks';
import { useMotion } from '@/hooks/use-motion';
import { cn } from '@/lib/utils';

/**
 * The hero (`hero`, its `body`) in 3D wearing its gear at `level` (docs/features/hero-3d.md): a 128×128 render scaled
 * up crisp by `className` (a whole multiple), turned with a drag or the arrow keys. It breathes and its cape stirs,
 * and a tap (or Enter) plays an action, a swing, a salute or the shield raised, in turn; still with reduced motion. `fallback` (the 2D figure) shows where
 * WebGL doesn't work or its context is lost.
 */
export function HeroFigure3d({
  hero,
  body,
  level,
  label,
  fallback,
  className,
}: {
  hero: number;
  body: FigureBody;
  level: number;
  label: string;
  fallback: ReactNode;
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const motion = useMotion();
  const works = useHeroFigure3d(canvas, frame, body, level, !motion, hero);
  if (!works) return fallback;
  return (
    <div
      ref={frame}
      // eslint-disable-next-line jsx-a11y-x/no-noninteractive-tabindex -- the figure is an application, as the map is: focused, the keys turn it
      tabIndex={0}
      role="application"
      aria-label={label}
      className={cn(
        'cursor-grab touch-pan-y rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:cursor-grabbing',
        className,
      )}
    >
      <canvas ref={canvas} width={RENDER_SIZE} height={RENDER_SIZE} className="size-full [image-rendering:pixelated]" />
    </div>
  );
}
