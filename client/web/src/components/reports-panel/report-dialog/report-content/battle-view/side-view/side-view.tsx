import { useTranslation } from 'react-i18next';
import { type BattleReport } from '@marchlands/core';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmtExact } from '@/lib/format';
import { translateMessage } from '@/lib/messages';
import { ITEM_BONUS_TONE } from '@/lib/tones';
import { cn } from '@/lib/utils';
import { troopLabel } from '@/components/reports-panel/report-dialog/report-content/utils';
import { TroopList } from '@/components/reports-panel/report-dialog/report-content/troop-list/troop-list';
import { itemName } from '@/lib/game-data';

export function SideView({
  title,
  side,
  player,
  forts,
  wallLevel,
}: {
  title: string;
  side: BattleReport['attacker'];
  /** who fought on this side, when the report names no player (a barbarian city, a valley's own defenders) */
  player?: string;
  forts?: { before: Record<string, number | undefined>; lost: Record<string, number | undefined>; after: Record<string, number | undefined> };
  wallLevel?: number;
}) {
  const { t } = useTranslation(['reports-panel', 'common']);
  const rows = (list: { before: Record<string, number | undefined>; lost: Record<string, number | undefined>; after: Record<string, number | undefined> }) =>
    Object.keys(list.before)
      .filter((k) => (list.before[k] ?? 0) > 0 || (list.lost[k] ?? 0) > 0)
      .map((k) => (
        <TableRow key={k}>
          <TableCell>{troopLabel(k)}</TableCell>
          <TableCell className="text-right tabular-nums">{fmtExact(list.before[k] ?? 0)}</TableCell>
          <TableCell className="text-right tabular-nums text-destructive">{(list.lost[k] ?? 0) > 0 ? `−${fmtExact(list.lost[k] ?? 0)}` : '—'}</TableCell>
          <TableCell className="text-right tabular-nums">{fmtExact(list.after[k] ?? 0)}</TableCell>
        </TableRow>
      ));
  const troopRows = rows(side.troops);
  const fortRows = forts ? rows(forts) : [];
  return (
    <div className="grid content-start gap-1.5 rounded-md border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium">{t('side.title', { side: title, player: player || side.player || '—' })}</span>
        {side.hero && <span className="text-xs text-muted-foreground">{t('common:level.named', { name: side.hero.name, level: side.hero.level })}</span>}
      </div>
      {side.bonuses && side.bonuses.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {side.bonuses.map((b) => (
            <Badge key={`${b.desc.code}:${b.itemId ?? ''}`} className={cn('gap-1 font-normal', ITEM_BONUS_TONE)}>
              {b.itemId && <span className="font-medium">{itemName(b.itemId)}:</span>}
              {translateMessage(b.desc)}
            </Badge>
          ))}
        </div>
      )}
      {troopRows.length + fortRows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('side.noTroops')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('common:table.unit')}</TableHead>
              <TableHead className="text-right">{t('side.before')}</TableHead>
              <TableHead className="text-right">{t('side.lost')}</TableHead>
              <TableHead className="text-right">{t('side.after')}</TableHead>
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
          <span className="text-muted-foreground">{t('side.injured')}</span>
          <TroopList troops={side.injured} /> <span className="text-muted-foreground">{t('side.healHint')}</span>
        </div>
      )}
      <div className="text-xs text-muted-foreground tabular-nums">
        {side.honor > 0 && t('side.honor', { value: fmtExact(side.honor) })}
        {side.honor > 0 && side.heroExp > 0 && ' · '}
        {side.heroExp > 0 && t('side.heroExp', { value: fmtExact(side.heroExp) })}
        {wallLevel != null && wallLevel > 0 && `${side.honor > 0 || side.heroExp > 0 ? ' · ' : ''}${t('side.walls', { level: wallLevel })}`}
      </div>
    </div>
  );
}
