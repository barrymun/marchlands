import { RESOURCE_ART } from '@/components/resource-icon/constants';
import { resourceArtFile, type ResourceKey } from '@/lib/game-art';
import { cn } from '@/lib/utils';

/** A resource's 16-pixel icon (gold, food, lumber, stone, iron), beside its name or amount; decorative, so it has no text. */
export function ResourceIcon({ resource, className }: { resource: ResourceKey; className?: string }) {
  return (
    <img src={RESOURCE_ART[resourceArtFile(resource)]} alt="" width={16} height={16} className={cn('size-4 shrink-0 [image-rendering:pixelated]', className)} />
  );
}
