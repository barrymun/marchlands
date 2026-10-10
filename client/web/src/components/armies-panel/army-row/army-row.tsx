import type { ArmyBean } from '@marchlands/api-client';
import { ArmyDirection } from '@marchlands/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Countdown } from '@/components/countdown/countdown';
import { fmt } from '@/lib/format';
import { MISSION_NAMES } from '@/components/armies-panel/constants';

export function ArmyRow({ army: a, tone, onRecall }: { army: ArmyBean; tone?: 'destructive'; onRecall?: () => void }) {
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
