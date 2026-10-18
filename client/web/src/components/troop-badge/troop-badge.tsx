import { TROOP_BADGES } from '@/components/troop-badge/constants';
import { troopBadgeFile } from '@/lib/game-art';
import { cn } from '@/lib/utils';

/** A troop's 24-pixel badge for lists of troops, or nothing for a unit with no badge (a fortification). */
export function TroopBadge({ id, className }: { id: number; className?: string }) {
  const badge = TROOP_BADGES[troopBadgeFile(id)];
  if (!badge) return null;
  return <img src={badge} alt="" width={24} height={24} loading="lazy" decoding="async" className={cn('shrink-0 [image-rendering:pixelated]', className)} />;
}
