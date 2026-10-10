import { itemConfig, type BattleReport } from '@marchlands/core';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmtExact } from '@/lib/format';
import { ITEM_BONUS_TONE } from '@/lib/tones';
import { cn } from '@/lib/utils';
import { troopLabel } from '@/components/reports-panel/report-dialog/report-content/utils';
import { TroopList } from '@/components/reports-panel/report-dialog/report-content/troop-list/troop-list';

export function SideView({
  title,
  side,
  forts,
  wallLevel,
}: {
  title: string;
  side: BattleReport['attacker'];
  forts?: { before: Record<string, number | undefined>; lost: Record<string, number | undefined>; after: Record<string, number | undefined> };
  wallLevel?: number;
}) {
  const rows = (t: { before: Record<string, number | undefined>; lost: Record<string, number | undefined>; after: Record<string, number | undefined> }) =>
    Object.keys(t.before)
      .filter((k) => (t.before[k] ?? 0) > 0 || (t.lost[k] ?? 0) > 0)
      .map((k) => (
        <TableRow key={k}>
          <TableCell>{troopLabel(k)}</TableCell>
          <TableCell className="text-right tabular-nums">{fmtExact(t.before[k] ?? 0)}</TableCell>
          <TableCell className="text-right tabular-nums text-destructive">{(t.lost[k] ?? 0) > 0 ? `−${fmtExact(t.lost[k] ?? 0)}` : '—'}</TableCell>
          <TableCell className="text-right tabular-nums">{fmtExact(t.after[k] ?? 0)}</TableCell>
        </TableRow>
      ));
  const troopRows = rows(side.troops);
  const fortRows = forts ? rows(forts) : [];
  return (
    <div className="grid content-start gap-1.5 rounded-md border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium">
          {title}: {side.player || '—'}
        </span>
        {side.hero && (
          <span className="text-xs text-muted-foreground">
            {side.hero.name} Lv {side.hero.level}
          </span>
        )}
      </div>
      {side.bonuses && side.bonuses.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {side.bonuses.map((b) => (
            <Badge key={b.desc} className={cn('gap-1 font-normal', ITEM_BONUS_TONE)}>
              {b.itemId && <span className="font-medium">{itemConfig(b.itemId)?.name.trim()}:</span>}
              {b.desc}
            </Badge>
          ))}
        </div>
      )}
      {troopRows.length + fortRows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No troops.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Before</TableHead>
              <TableHead className="text-right">Lost</TableHead>
              <TableHead className="text-right">After</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {troopRows}
            {fortRows}
          </TableBody>
        </Table>
      )}
      {side.injured && Object.values(side.injured).some((n) => (n ?? 0) > 0) && (
        <div className="text-xs">
          <span className="text-muted-foreground">Survived injured (Medicine): </span>
          <TroopList troops={side.injured} /> <span className="text-muted-foreground">· heal them in the Military tab</span>
        </div>
      )}
      <div className="text-xs text-muted-foreground tabular-nums">
        {side.honor > 0 && `+${fmtExact(side.honor)} honor`}
        {side.honor > 0 && side.heroExp > 0 && ' · '}
        {side.heroExp > 0 && `hero +${fmtExact(side.heroExp)} exp`}
        {wallLevel != null && wallLevel > 0 && `${side.honor > 0 || side.heroExp > 0 ? ' · ' : ''}walls Lv ${wallLevel}`}
      </div>
    </div>
  );
}
