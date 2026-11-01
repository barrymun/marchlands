import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { getFactionsOptions } from '@marchlands/api-client';
import { BALANCE, FACTIONS, factionSpread } from '@marchlands/core';

import { goldBar } from '@/components/factions-panel/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useStateRulers } from '@/hooks/use-state-rulers';
import { FACTION_STYLE, standingText, standingTierName, standingTone } from '@/lib/factions';
import { fmt, percent, resourceLabel } from '@/lib/format';
import { factionName, stateName, zoneName } from '@/lib/game-data';
import { cn } from '@/lib/utils';

/**
 * The NPC factions (core's factions.ts): the zones each holds, what it is strong in and short of, how it behaves, its
 * gold beside its treasury (what it pays players selling to it with, and the level it drifts back to over about a game
 * day: trade can leave it far above or below), and the
 * player's standing with it (core's reputation.ts) with what that does to the factions' prices for their cities there.
 */
export function FactionsPanel() {
  const { t } = useTranslation(['factions-panel', 'common']);
  const golds = useQuery(getFactionsOptions()).data;
  const rulers = useStateRulers();
  const list = (items: string[]) => items.join(t('common:list.separator'));
  return (
    <div className="grid gap-4">
      <div className="grid gap-1 text-sm text-muted-foreground">
        <p>{t('intro', { level: BALANCE.factions.minLevel })}</p>
        <p>{t('standingIntro')}</p>
        <p>{t('rulersIntro')}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {FACTIONS.map((f) => {
          const g = golds?.find((x) => x.id === f.id);
          const spread = g && factionSpread(g.standing);
          const bar = g && goldBar(g.gold, g.treasury);
          return (
            <Card key={f.id} size="sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span aria-hidden className={cn('size-3 rounded-sm', FACTION_STYLE[f.id].swatch)} />
                  {factionName(f.id)}
                  <Badge variant="outline">{t(`temperament.${f.temperament}`)}</Badge>
                </CardTitle>
                <CardDescription>{t('zones', { zones: list(f.zones.map(zoneName)) })}</CardDescription>
                {f.zones.flatMap((z) => {
                  const r = rulers.get(z);
                  return r ? [<CardDescription key={z}>{t('ruled', { state: stateName(z), player: r.player, tribute: fmt(r.tribute) })}</CardDescription>] : [];
                })}
              </CardHeader>
              <CardContent className="grid gap-2 text-sm">
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  <dt className="text-muted-foreground">{t('strong')}</dt>
                  <dd>{list(f.strong.map(resourceLabel))}</dd>
                  <dt className="text-muted-foreground">{t('short')}</dt>
                  <dd>{list(f.short.map(resourceLabel))}</dd>
                  {g && (
                    <>
                      <dt className="text-muted-foreground">{t('standing')}</dt>
                      <dd className="grid gap-0.5">
                        <span className={cn('tabular-nums', standingTone(g.standing))}>
                          {t('standingValue', { tier: standingTierName(g.standing), standing: standingText(g.standing) })}
                        </span>
                        <span className="text-xs text-muted-foreground">{spread == null ? t('refuses') : t('terms', { spread: percent(spread, 1) })}</span>
                      </dd>
                    </>
                  )}
                  {g && bar && g.treasury > 0 && (
                    <>
                      <dt className="text-muted-foreground">{t('gold')}</dt>
                      <dd className="grid gap-1">
                        <span className="tabular-nums">{t('goldUsual', { gold: fmt(g.gold), treasury: fmt(g.treasury) })}</span>
                        {/* the gold, with a mark at its usual level; the text above says the same for screen readers */}
                        <div aria-hidden className="relative h-1 w-full rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${bar.fill * 100}%` }} />
                          <div className="absolute -inset-y-0.5 w-0.5 -translate-x-1/2 rounded-full bg-foreground" style={{ left: `${bar.mark * 100}%` }} />
                        </div>
                      </dd>
                    </>
                  )}
                </dl>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
