import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { getFactionsOptions } from '@marchlands/api-client';
import { BALANCE, FACTIONS } from '@marchlands/core';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { FACTION_STYLE } from '@/lib/factions';
import { fmt, resourceLabel } from '@/lib/format';
import { factionName, zoneName } from '@/lib/game-data';
import { cn } from '@/lib/utils';

/**
 * The NPC factions (core's factions.ts): the zones each holds, what it is strong in and short of, how it behaves, and
 * its gold against its treasury (what it pays players selling to it with; it refills over about a game day).
 */
export function FactionsPanel() {
  const { t } = useTranslation(['factions-panel', 'common']);
  const golds = useQuery(getFactionsOptions()).data;
  const list = (items: string[]) => items.join(t('common:list.separator'));
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">{t('intro', { level: BALANCE.factions.minLevel })}</p>
      <div className="grid gap-4 md:grid-cols-2">
        {FACTIONS.map((f) => {
          const g = golds?.find((x) => x.id === f.id);
          return (
            <Card key={f.id} size="sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span aria-hidden className={cn('size-3 rounded-sm', FACTION_STYLE[f.id].swatch)} />
                  {factionName(f.id)}
                  <Badge variant="outline">{t(`temperament.${f.temperament}`)}</Badge>
                </CardTitle>
                <CardDescription>{t('zones', { zones: list(f.zones.map(zoneName)) })}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm">
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  <dt className="text-muted-foreground">{t('strong')}</dt>
                  <dd>{list(f.strong.map(resourceLabel))}</dd>
                  <dt className="text-muted-foreground">{t('short')}</dt>
                  <dd>{list(f.short.map(resourceLabel))}</dd>
                  {g && g.treasury > 0 && (
                    <>
                      <dt className="text-muted-foreground">{t('gold')}</dt>
                      <dd className="grid gap-1">
                        <span className="tabular-nums">{t('goldOf', { gold: fmt(g.gold), treasury: fmt(g.treasury) })}</span>
                        <Progress value={Math.min(100, (100 * g.gold) / g.treasury)} aria-label={t('gold')} />
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
