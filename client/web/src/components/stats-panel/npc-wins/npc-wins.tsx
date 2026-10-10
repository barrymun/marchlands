import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Counters } from '@/components/stats-panel/types';
import { Tile } from '@/components/stats-panel/tile/tile';

export function NpcWins({ c }: { c: Counters }) {
  const levels = Array.from({ length: 10 }, (_, i) => i + 1).filter((l) => c[`npcWins.${l}`]);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Barbarian cities beaten, by level</CardTitle>
      </CardHeader>
      <CardContent>
        {levels.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet.</p>
        ) : (
          <div className="grid grid-cols-5 gap-2">
            {levels.map((l) => (
              <Tile key={l} label={`Level ${l}`} value={c[`npcWins.${l}`]} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
