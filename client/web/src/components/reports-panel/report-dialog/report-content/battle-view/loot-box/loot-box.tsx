import { Fragment } from 'react';
import { Medal } from 'lucide-react';
import { itemConfig, type BattleReport } from '@marchlands/core';
import { Badge } from '@/components/ui/badge';
import { fmtExact } from '@/lib/format';
import { RES_LABEL } from '@/components/reports-panel/report-dialog/report-content/constants';

/** What the attacker took: per resource and in total (valleys hold nothing). */
export function LootBox({ battle: b, me }: { battle: BattleReport; me?: string }) {
  const mine = b.attacker.player === me;
  if (!('plunder' in b)) {
    return (
      <div className="grid gap-1 rounded-md bg-muted/50 p-3">
        <div className="font-medium">Loot</div>
        <span className="text-muted-foreground">
          Nothing: valleys hold no resources to take{'occupied' in b && b.occupied ? ' (holding it raises your production instead)' : ''}.
        </span>
      </div>
    );
  }
  const entries = (['gold', 'food', 'wood', 'stone', 'iron'] as const).map((k) => [k, Math.floor(b.plunder[k] ?? 0)] as const);
  const total = entries.reduce((s, [, n]) => s + n, 0);
  return (
    <div className="grid gap-1.5 rounded-md bg-muted/50 p-3">
      <div className="font-medium">{mine ? 'Loot taken' : 'Resources lost to the attacker'}</div>
      {total === 0 ? (
        <span className="text-muted-foreground">
          Nothing{b.result === 'attackerWon' ? ' (nothing left unprotected, or no room to carry it)' : ': the attack failed'}.
        </span>
      ) : (
        <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-0.5 tabular-nums sm:grid-cols-[repeat(3,auto_1fr)]">
          {entries
            .filter(([, n]) => n > 0)
            .map(([k, n]) => (
              <Fragment key={k}>
                <span className="text-muted-foreground">{RES_LABEL[k]}</span>
                <span className={mine ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}>
                  {mine ? '+' : '−'}
                  {fmtExact(n)}
                </span>
              </Fragment>
            ))}
          <span className="font-medium">Total</span>
          <span className="font-medium">{fmtExact(total)}</span>
        </div>
      )}
      {b.medals && Object.keys(b.medals).length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground">{mine ? 'Medals found:' : 'Medals the attacker found:'}</span>
          {Object.entries(b.medals)
            .sort(([a], [z]) => z.localeCompare(a))
            .map(([id, n]) => (
              <Badge key={id} variant="secondary" className="gap-1 font-normal">
                <Medal className="size-3 text-amber-500" />
                {itemConfig(id)?.name ?? id}
                {n > 1 && ` ×${n}`}
              </Badge>
            ))}
        </div>
      )}
      {'loyaltyDamage' in b && (
        <div className="text-xs text-muted-foreground">
          Loyalty −{fmtExact(b.loyaltyDamage)} (now {fmtExact(b.loyaltyLeft)}){b.captured && ' · city captured'}
        </div>
      )}
    </div>
  );
}
