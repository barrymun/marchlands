import { UNIT_ART } from '@/components/military-panel/unit-icon/constants';
import { unitArtFile } from '@/lib/game-art';
import { cn } from '@/lib/utils';

/** A troop's or fortification's pixel-art sprite at `size` pixels (a multiple of its 32, so it scales crisp), or nothing for a unit with no art yet. */
export function UnitIcon({ id, size = 32, className }: { id: number; size?: 32 | 64; className?: string }) {
  const art = UNIT_ART[unitArtFile(id)];
  if (!art) return null;
  return <img src={art} alt="" width={size} height={size} loading="lazy" decoding="async" className={cn('shrink-0 [image-rendering:pixelated]', className)} />;
}
