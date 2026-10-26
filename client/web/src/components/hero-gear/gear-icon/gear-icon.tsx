import { useRef } from 'react';

import { GEAR_ART } from '@/components/hero-gear/constants';
import { GEAR_SIZE } from '@/components/hero-gear/gear-icon/constants';
import { useGearMotion } from '@/components/hero-gear/gear-icon/hooks';
import { gearArtFile, gearBackdropFile } from '@/lib/game-art';
import { cn } from '@/lib/utils';

/**
 * A gear piece at a gear level: the piece's pixel-art sprite on that level's backdrop, at `size` pixels (a multiple of
 * their 32, so they scale crisp). It moves over them as its level has it (docs/features/gear-animations.md): from level
 * 3 stones flaring, then glowing, a glint across the metal, level 10's stars; and at every level the cape, the plume,
 * the mount and the pendants now and then. Still with reduced motion.
 */
export function GearIcon({ piece, level, size = 64, className }: { piece: string; level: number; size?: 32 | 64; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const still = useRef<HTMLImageElement>(null);
  const backdrop = GEAR_ART[gearBackdropFile(level)];
  const art = GEAR_ART[gearArtFile(piece, level)];
  useGearMotion(canvas, still, piece, level, art);
  const img = 'absolute inset-0 [image-rendering:pixelated]';
  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      {backdrop && <img src={backdrop} alt="" width={size} height={size} loading="lazy" decoding="async" className={img} />}
      {art && <img ref={still} src={art} alt="" width={size} height={size} loading="lazy" decoding="async" className={img} />}
      <canvas ref={canvas} width={GEAR_SIZE} height={GEAR_SIZE} aria-hidden className={cn(img, 'size-full')} />
    </div>
  );
}
