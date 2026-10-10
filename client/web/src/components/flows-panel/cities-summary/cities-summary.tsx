import { usePlayer } from '@/hooks/use-game';
import type { Targets } from '@/components/flows-panel/types';

/** "All cities", or the chosen cities' names. */
export function CitiesSummary({ targets }: { targets: Targets }) {
  const cities = usePlayer().data?.castles ?? [];
  if (targets === 'all') return <span className="text-foreground">all cities</span>;
  const names = cities.filter((c) => targets.includes(c.id)).map((c) => c.name);
  return <span className="text-foreground">{names.length ? names.join(', ') : 'none of your current cities'}</span>;
}
