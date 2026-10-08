import { useMemo } from 'react';
import { usePlayer } from '@/hooks/use-game';

/** Owned item counts of the logged-in lord. */
export function useInventory() {
  const player = usePlayer();
  return useMemo(() => {
    const counts = new Map((player.data?.items ?? []).map((i) => [i.id, i.count]));
    return { count: (id: string) => counts.get(id) ?? 0 };
  }, [player.data]);
}
