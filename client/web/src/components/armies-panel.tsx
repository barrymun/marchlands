import { useQuery } from '@tanstack/react-query';
import type { ArmyBean } from '@evony/api-client';
import { ArmyDirection, Mission } from '@evony/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Countdown } from '@/components/countdown';
import { qk, useCommand } from '@/hooks/use-game';
import { api, unwrap } from '@/lib/api';
import { fmt } from '@/lib/format';

export const MISSION_NAMES: Record<number, string> = {
  [Mission.TRANSPORT]: 'Transport',
  [Mission.REINFORCE]: 'Reinforce',
  [Mission.SCOUT]: 'Scout',
  [Mission.BUILD_CITY]: 'Build city',
  [Mission.ATTACK]: 'Attack',
};

export function ArmiesPanel() {
  const armies = useQuery({ queryKey: qk.armies, queryFn: () => unwrap(api.GET('/api/v1/armies')) });
  const recall = useCommand((armyId: number) => unwrap(api.POST('/api/v1/armies/{armyId}/recall', { params: { path: { armyId } } })), () => [qk.armies], 'Army recalled');
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
              <ArmyRow key={a.armyId} army={a} tone={s.tone} onRecall={s.own && a.direction !== ArmyDirection.BACKWARD ? () => recall.mutate(a.armyId) : undefined} />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ArmyRow({ army: a, tone, onRecall }: { army: ArmyBean; tone?: 'destructive'; onRecall?: () => void }) {
  const total = a.troop ? Object.values(a.troop).reduce((s, n) => s + n, 0) : null;
  const status = a.direction === ArmyDirection.BACKWARD ? 'Returning' : a.direction === ArmyDirection.STAY ? 'Stationed' : 'Marching';
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
      <div className="grid gap-0.5">
        <div className="flex items-center gap-2">
          <Badge variant={tone ?? 'secondary'}>{MISSION_NAMES[a.missionType] ?? a.missionType}</Badge>
          <span>
            {a.startPosName} → {a.targetPosName}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {a.king && `${a.king} · `}
          {a.hero ? `${a.hero} (Lv ${a.heroLevel})` : 'no hero'}
          {total != null && ` · ${fmt(total)} troops`}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {status}
          {a.direction !== ArmyDirection.STAY && (
            <>
              {' '}
              · <Countdown endTime={a.reachTime} />
            </>
          )}
        </span>
        {onRecall && (
          <Button size="xs" variant="outline" onClick={onRecall}>
            Recall
          </Button>
        )}
      </div>
    </div>
  );
}
