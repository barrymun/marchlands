import { useQuery } from '@tanstack/react-query';
import { ArmyDirection } from '@marchlands/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { qk, useCommand } from '@/hooks/use-game';
import { api, unwrap } from '@/lib/api';
import { ArmyRow } from '@/components/armies-panel/army-row/army-row';

export function ArmiesPanel() {
  const armies = useQuery({ queryKey: qk.armies, queryFn: () => unwrap(api.GET('/api/v1/armies')) });
  const recall = useCommand(
    (armyId: number) => unwrap(api.POST('/api/v1/armies/{armyId}/recall', { params: { path: { armyId } } })),
    () => [qk.armies],
    'Army recalled',
  );
  const sections = [
    { title: 'Hostile armies', list: armies.data?.enemy ?? [], tone: 'destructive' as const },
    { title: 'Your armies', list: armies.data?.self ?? [], own: true },
    { title: 'Allied armies', list: armies.data?.friend ?? [] },
  ];
  return (
    <div className="grid gap-4">
      {sections.map((s) => (
        <Card key={s.title}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {s.title} <span className="font-normal text-muted-foreground">({s.list.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {s.list.length === 0 && <p className="text-sm text-muted-foreground">None.</p>}
            {s.list.map((a) => (
              <ArmyRow
                key={a.armyId}
                army={a}
                tone={s.tone}
                onRecall={s.own && a.direction !== ArmyDirection.BACKWARD ? () => recall.mutate(a.armyId) : undefined}
              />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
