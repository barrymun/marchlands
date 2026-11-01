import { ITEM_ART } from '@/components/item-icon/constants';
import { itemArtFile } from '@/lib/game-art';
import { cn } from '@/lib/utils';

/**
 * An item's pixel-art icon (32×32, lib/game-art.ts itemArtFile) beside its name, at 32 pixels or doubled to 64 so its
 * pixels stay square; decorative, so it has no text. Nothing for an item without one.
 */
export function ItemIcon({ id, size = 32, className }: { id: string; size?: 32 | 64; className?: string }) {
  const file = itemArtFile(id);
  const src = file ? ITEM_ART[file] : undefined;
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      className={cn(size === 64 ? 'size-16' : 'size-8', 'shrink-0 [image-rendering:pixelated]', className)}
    />
  );
}
