import { useMemo } from 'react';
import { usePlayer } from '@/hooks/use-game';

/** Owned item counts and cents of the logged-in lord. */
export function useInventory() {
  const player = usePlayer();
  return useMemo(() => {
    const counts = new Map((player.data?.items ?? []).map((i) => [i.id, i.count]));
    return { count: (id: string) => counts.get(id) ?? 0, cents: player.data?.playerInfo.cents ?? 0 };
  }, [player.data]);
}
