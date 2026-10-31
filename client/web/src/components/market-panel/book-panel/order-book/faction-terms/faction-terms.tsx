import { useTranslation } from 'react-i18next';

import type { MarketFactions } from '@marchlands/api-client';
import { BALANCE } from '@marchlands/core';

import { standingText, standingTierName } from '@/lib/factions';
import { percent } from '@/lib/format';
import { factionName } from '@/lib/game-data';
import { LOSS_TEXT } from '@/lib/tones';
import { cn } from '@/lib/utils';

/**
 * The terms the factions give the city in view (core's reputation.ts): its home faction, the player's standing with it
 * and the spread that sets, or that it won't trade with the city at all.
 */
export function FactionTerms({ factions }: { factions: MarketFactions }) {
  const { t } = useTranslation('market-panel');
  if (factions.faction == null || factions.standing == null) return null;
  const terms = { faction: factionName(factions.faction), tier: standingTierName(factions.standing), standing: standingText(factions.standing) };
  return (
    <p
      className={cn('border-t px-2 py-1.5 text-[11px]', factions.refused ? LOSS_TEXT : 'text-muted-foreground')}
      title={t('orderBook.termsHint', { refuse: standingText(BALANCE.reputation.refuseBelow) })}
    >
      {factions.refused ? t('orderBook.refused', terms) : t('orderBook.terms', { ...terms, spread: percent(factions.spread ?? 0, 1) })}
    </p>
  );
}
