import { useEffect, useRef } from 'react';

import { FIGURE_ART, FIGURE_SIZE } from '@/components/heroes-panel/hero-sheet/character-sheet/paper-doll/hero-figure/constants';
import type { FigureBody } from '@/components/heroes-panel/hero-sheet/character-sheet/paper-doll/hero-figure/types';
import { drawFigure, figureLayers } from '@/components/heroes-panel/hero-sheet/character-sheet/paper-doll/hero-figure/utils';
import { ANIMATION_FPS } from '@/components/iso-viewport/constants';
import { useImages } from '@/hooks/use-images';
import { useMotion } from '@/hooks/use-motion';
import { cn } from '@/lib/utils';

/**
 * The hero drawn wearing its gear at `level` (docs/features/hero-figure-art.md): its layers stacked on a 96×96 canvas,
 * scaled up crisp by `className` (a whole multiple). It breathes, its cape stirs and level 10's stones glow, redrawn
 * about 12 times a second on the browser's animation frames (which stop in a hidden tab); still with reduced motion.
 */
export function HeroFigure({ body, level, label, className }: { body: FigureBody; level: number; label: string; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const motion = useMotion();
  const layers = figureLayers(body, level);
  const srcs = layers.map((l) => FIGURE_ART[l.file] ?? '');
  const images = useImages(srcs);
  // the loaded layers, in order: a layer still loading is left out until it arrives
  const ready = srcs.filter((s) => images.has(s)).length;
  const key = srcs.join('|');
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    const loaded = key.split('|').flatMap((src, i) => {
      const img = images.get(src);
      const layer = figureLayers(body, level)[i];
      return img && layer ? [{ layer, img }] : [];
    });
    if (!motion) {
      drawFigure(ctx, loaded, null);
      return;
    }
    let id = 0;
    let last = -Infinity;
    const tick = (now: number) => {
      if (now - last >= 1000 / ANIMATION_FPS) {
        last = now;
        drawFigure(ctx, loaded, now);
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [key, ready, motion, images, body, level]);
  return (
    <canvas ref={canvas} width={FIGURE_SIZE} height={FIGURE_SIZE} role="img" aria-label={label} className={cn('[image-rendering:pixelated]', className)} />
  );
}
