import { getGameSpeed, type ReportBody } from '@marchlands/core';
import { signedRate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { TroopList } from '@/components/reports-panel/report-dialog/report-content/troop-list/troop-list';
import { Line } from '@/components/reports-panel/report-dialog/report-content/line/line';

export function DesertionView({ desertion: d }: { desertion: Extract<ReportBody, { kind: 'desertion' }>['desertion'] }) {
  const perHour = (n: number) => signedRate(n);
  return (
    <div className="grid gap-1.5 text-sm">
      <p>
        {d.city} ran out of food, so troops deserted: 10% of every troop type for each game hour the upkeep went unpaid (a game hour is
        {getGameSpeed() === 1 ? ' an hour' : ` 1/${getGameSpeed()} of a real hour`}).
      </p>
      <Line label="Deserted">
        <TroopList troops={d.troops} />
      </Line>
      <Line label="Between">
        {new Date(d.from).toLocaleString()} and {new Date(d.to).toLocaleString()}
      </Line>
      <Line label="Food">
        produced {perHour(d.food.production)}, troop upkeep {signedRate(-d.food.upkeep)},{' '}
        <span className={cn('font-medium', d.food.net < 0 && 'text-destructive')}>net {perHour(d.food.net)}</span>
      </Line>
      {d.food.net < 0 && (
        <p className="text-xs text-muted-foreground">
          Food is still running out: buy food at the Market, build or upgrade Farms, hold grassland or lake valleys, or keep fewer troops.
        </p>
      )}
    </div>
  );
}
