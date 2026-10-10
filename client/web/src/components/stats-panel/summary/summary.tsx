import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Counters } from '@/components/stats-panel/types';
import { sumPrefix } from '@/components/stats-panel/utils';
import { Tile } from '@/components/stats-panel/tile/tile';

export function Summary({ c, lordWide }: { c: Counters; lordWide: boolean }) {
  const won = sumPrefix(c, 'attacks.won.');
  const lost = sumPrefix(c, 'attacks.lost.');
  const tiles: [string, number][] = [
    ['Attacks won', won],
    ['Attacks lost', lost],
    ['Defenses won', sumPrefix(c, 'defenses.won.')],
    ['Defenses lost', sumPrefix(c, 'defenses.lost.')],
    ['Barbarian cities beaten', c['attacks.won.npc'] ?? 0],
    ['Cities captured', (c['captured.city'] ?? 0) + (c['captured.npc'] ?? 0)],
    ['Valleys occupied', c['captured.valley'] ?? 0],
    ['Honor gained', c.honor ?? 0],
    ['Building levels', c['levels.building'] ?? 0],
    ['Research levels', c['levels.research'] ?? 0],
    ['Hero levels', c['levels.hero'] ?? 0],
    ['Heroes hired', c['heroes.hired'] ?? 0],
  ];
  if (lordWide) tiles.push(['Items used', sumPrefix(c, 'items.used.')]);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Overview</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {tiles.map(([label, v]) => (
          <Tile key={label} label={label} value={v} />
        ))}
      </CardContent>
    </Card>
  );
}
