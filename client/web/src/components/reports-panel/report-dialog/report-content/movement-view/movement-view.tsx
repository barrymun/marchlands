import type { ReportBody } from '@marchlands/core';
import { TroopList } from '@/components/reports-panel/report-dialog/report-content/troop-list/troop-list';
import { ResourceList } from '@/components/reports-panel/report-dialog/report-content/resource-list/resource-list';
import { Line } from '@/components/reports-panel/report-dialog/report-content/line/line';

export function MovementView({ movement: m }: { movement: Extract<ReportBody, { kind: 'movement' }>['movement'] }) {
  return (
    <div className="grid gap-1.5 text-sm">
      {'from' in m && <Line label="From">{m.from}</Line>}
      <Line label="Hero">{m.hero ? `${m.hero.name} Lv ${m.hero.level}` : 'none'}</Line>
      <Line label="Troops">
        <TroopList troops={m.troops} />
      </Line>
      {'resources' in m && (
        <Line label={'heroReturned' in m ? 'Resources' : 'Brought home'}>
          <ResourceList res={m.resources} empty="nothing" />
        </Line>
      )}
      {'heroReturned' in m && m.heroReturned && <p className="text-xs text-muted-foreground">No free Feasting Hall slot: the hero returned home.</p>}
    </div>
  );
}
