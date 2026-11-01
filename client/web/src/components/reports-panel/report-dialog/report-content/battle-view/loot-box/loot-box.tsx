import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';

import { type BattleReport } from '@marchlands/core';

import { ItemIcon } from '@/components/item-icon/item-icon';
import { Badge } from '@/components/ui/badge';
import { standingText } from '@/lib/factions';
import { fmtExact, resourceLabel } from '@/lib/format';
import { factionName, itemName } from '@/lib/game-data';

/**
 * What the attacker took: per resource and in total (valleys hold nothing); against a barbarian city or a held historic
 * city, its loyalty; and the attacker's standing with a faction.
 */
export function LootBox({ battle: b, me }: { battle: BattleReport; me?: string }) {
  const { t } = useTranslation(['reports-panel', 'common']);
  const mine = b.attacker.player === me;
  if (!('plunder' in b)) {
    return (
      <div className="grid gap-1 rounded-md bg-muted/50 p-3">
        <div className="font-medium">{t('loot.title')}</div>
        <span className="text-muted-foreground">{'occupied' in b && b.occupied ? t('loot.valleyNothingOccupied') : t('loot.valleyNothing')}</span>
      </div>
    );
  }
  const entries = (['gold', 'food', 'wood', 'stone', 'iron'] as const).map((k) => [k, Math.floor(b.plunder[k])] as const);
  const total = entries.reduce((s, [, n]) => s + n, 0);
  return (
    <div className="grid gap-1.5 rounded-md bg-muted/50 p-3">
      <div className="font-medium">{mine ? t('loot.taken') : t('loot.lost')}</div>
      {total === 0 ? (
        <span className="text-muted-foreground">{b.result === 'attackerWon' ? t('loot.nothingWon') : t('loot.nothingFailed')}</span>
      ) : (
        <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-0.5 tabular-nums sm:grid-cols-[repeat(3,auto_1fr)]">
          {entries
            .filter(([, n]) => n > 0)
            .map(([k, n]) => (
              <Fragment key={k}>
                <span className="text-muted-foreground">{resourceLabel(k)}</span>
                <span className={mine ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}>
                  {mine ? '+' : '−'}
                  {fmtExact(n)}
                </span>
              </Fragment>
            ))}
          <span className="font-medium">{t('common:table.total')}</span>
          <span className="font-medium">{fmtExact(total)}</span>
        </div>
      )}
      {b.medals && Object.keys(b.medals).length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground">{mine ? t('loot.medalsFound') : t('loot.medalsAttackerFound')}</span>
          {Object.entries(b.medals)
            .sort(([a], [z]) => z.localeCompare(a))
            .map(([id, n]) => (
              <Badge key={id} variant="secondary" className="gap-1 py-0 pl-0.5 font-normal">
                <ItemIcon id={id} />
                {itemName(id)}
                {n > 1 && ` ×${n}`}
              </Badge>
            ))}
        </div>
      )}
      {'loyaltyDamage' in b && (
        <div className="text-xs text-muted-foreground">
          {t('loot.loyalty', { damage: fmtExact(b.loyaltyDamage), left: fmtExact(b.loyaltyLeft) })}
          {b.captured && t('loot.captured')}
        </div>
      )}
      {'seat' in b && b.seat && (
        <div className="text-xs text-muted-foreground">
          {t('loot.loyalty', { damage: fmtExact(b.seat.loyaltyDamage), left: fmtExact(b.seat.loyaltyLeft) })}
          {b.seat.captured && t('loot.captured')}
        </div>
      )}
      {'standing' in b && b.standing && mine && (
        <div className="text-xs text-muted-foreground">
          {t('loot.standing', { faction: factionName(b.standing.faction), change: standingText(b.standing.change), standing: standingText(b.standing.now) })}
        </div>
      )}
      {'rivals' in b &&
        mine &&
        b.rivals?.map((s) => (
          <div key={s.faction} className="text-xs text-muted-foreground">
            {t('loot.standing', { faction: factionName(s.faction), change: standingText(s.change), standing: standingText(s.now) })}
          </div>
        ))}
    </div>
  );
}
