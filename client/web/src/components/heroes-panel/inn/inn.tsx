import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type CityBean,
  getCitiesByCityIdQueryKey,
  getCitiesTavernOptions,
  getCitiesTavernQueryKey,
  postCitiesTavernHireMutation,
  postCitiesTavernRefreshMutation,
} from '@marchlands/api-client';
import { BuildingType, heroHireCost } from '@marchlands/core';

import { HeroRow } from '@/components/heroes-panel/hero-row/hero-row';
import { MayorNote } from '@/components/mayor-note/mayor-note';
import { SpendGoldButton } from '@/components/spend-gold-button/spend-gold-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCommand } from '@/hooks/use-game';
import { fmt } from '@/lib/format';

/**
 * The Inn, beside the city's heroes: the heroes it offers, each with its price and what it would add as mayor, to hire,
 * and new offers for gold. `focus` scrolls it into view (it sits below the heroes on a narrow screen).
 */
export function Inn({ city, focus = false }: { city: CityBean; focus?: boolean }) {
  const { t } = useTranslation(['heroes-panel', 'common']);
  const hasInn = city.buildings.some((b) => b.typeId === BuildingType.INN && b.level > 0);
  const cityPath = { path: { cityId: city.id } };
  const tavern = useQuery({ ...getCitiesTavernOptions(cityPath), enabled: hasInn });
  const refresh = () => [getCitiesByCityIdQueryKey(cityPath), getCitiesTavernQueryKey(cityPath)];
  const hire = useCommand(postCitiesTavernHireMutation(), refresh, t('toast.hired'));
  const reroll = useCommand(postCitiesTavernRefreshMutation(), refresh, t('toast.rerolled'));
  const card = useRef<HTMLDivElement>(null);
  // once the offers are in, so the page is as long as it will be
  const loaded = !hasInn || tavern.data != null;
  useEffect(() => {
    if (focus && loaded) card.current?.scrollIntoView({ block: 'start' });
  }, [focus, loaded]);
  return (
    <Card ref={card}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{t('inn.title')}</CardTitle>
        <CardDescription>{hasInn ? (tavern.data ? t('inn.freeSlots', { count: tavern.data.posCount }) : '…') : t('inn.noInn')}</CardDescription>
      </CardHeader>
      {hasInn && (
        <CardContent className="grid gap-2">
          {tavern.data && (
            <div className="flex flex-wrap items-center gap-2">
              <SpendGoldButton
                size="sm"
                variant="outline"
                cost={tavern.data.refreshCost}
                city={city}
                disabled={reroll.isPending || city.resource.gold < tavern.data.refreshCost}
                onSpend={() => reroll.mutate(cityPath)}
              >
                <RefreshCw /> {t('inn.newOffers', { gold: fmt(tavern.data.refreshCost) })}
              </SpendGoldButton>
            </div>
          )}
          {tavern.data?.heros.map((h) => (
            <HeroRow key={h.id} hero={h} note={<MayorNote city={city} hero={h} />}>
              <span className="text-xs text-muted-foreground tabular-nums">{t('common:gold', { gold: fmt(heroHireCost(h.level)) })}</span>
              <SpendGoldButton
                size="xs"
                cost={heroHireCost(h.level)}
                city={city}
                disabled={hire.isPending}
                onSpend={() => hire.mutate({ path: { cityId: city.id, heroId: h.id } })}
              >
                {t('inn.hire')}
              </SpendGoldButton>
            </HeroRow>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
