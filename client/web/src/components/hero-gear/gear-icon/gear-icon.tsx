import { GEAR_ART } from '@/components/hero-gear/constants';
import { gearArtFile, gearBackdropFile } from '@/lib/game-art';
import { cn } from '@/lib/utils';

/**
 * A gear piece at a gear level: the piece's pixel-art sprite on that level's backdrop, at `size` pixels (a multiple of
 * their 32, so they scale crisp).
 */
export function GearIcon({ piece, level, size = 64, className }: { piece: string; level: number; size?: 32 | 64; className?: string }) {
  const backdrop = GEAR_ART[gearBackdropFile(level)];
  const art = GEAR_ART[gearArtFile(piece, level)];
  const img = 'absolute inset-0 [image-rendering:pixelated]';
  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      {backdrop && <img src={backdrop} alt="" width={size} height={size} loading="lazy" decoding="async" className={img} />}
      {art && <img src={art} alt="" width={size} height={size} loading="lazy" decoding="async" className={img} />}
    </div>
  );
}
