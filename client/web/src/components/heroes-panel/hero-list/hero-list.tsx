import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { type CityBean, getCitiesByCityIdQueryKey, getCitiesTavernQueryKey, patchHeroesByHeroIdMutation } from '@marchlands/api-client';

import { HeroGearLine } from '@/components/hero-gear/hero-gear-line/hero-gear-line';
import { HeroActions } from '@/components/heroes-panel/hero-actions/hero-actions';
import { HeroRow } from '@/components/heroes-panel/hero-row/hero-row';
import { useHeroOrder } from '@/components/heroes-panel/hooks';
import { MayorNote } from '@/components/mayor-note/mayor-note';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCommand } from '@/hooks/use-game';
import { cn } from '@/lib/utils';

/**
 * The Heroes tab as a list (List, and always on a narrow screen): the city's heroes in the player's order (drag a row
 * by its handle, or the arrows), in two columns from xl, read across then down, each with what it would add as mayor
 * and its actions (HeroActions), and rename.
 */
export function HeroList({ city }: { city: CityBean }) {
  const { t } = useTranslation(['heroes-panel', 'common']);
  const cityPath = { path: { cityId: city.id } };
  const refresh = () => [getCitiesByCityIdQueryKey(cityPath), getCitiesTavernQueryKey(cityPath)];
  const rename = useCommand(patchHeroesByHeroIdMutation(), refresh, t('toast.renamed'));

  const order = useHeroOrder(city);

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t('heroes.title')}</CardTitle>
          <CardDescription>{t('heroes.description')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 xl:grid-cols-2">
          {city.heros.length === 0 && <p className="text-sm text-muted-foreground">{t('heroes.empty')}</p>}
          {city.heros.map((h, i) => (
            <div
              key={h.id}
              {...order.row(h.id, i)}
              // a grid, so the card fills the height of the row it shares with its neighbour
              className={cn('grid rounded-md transition-opacity', order.dragged(i) && 'opacity-50', order.target(i) && 'ring-2 ring-primary')}
            >
              <HeroRow
                hero={h}
                leading={
                  city.heros.length > 1 && <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden {...order.handle(h.id)} />
                }
                trailing={
                  city.heros.length > 1 && (
                    <>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        aria-label={t('heroes.moveUp', { name: h.name })}
                        disabled={i === 0}
                        onClick={() => order.move(i, i - 1)}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        aria-label={t('heroes.moveDown', { name: h.name })}
                        disabled={i === city.heros.length - 1}
                        onClick={() => order.move(i, i + 1)}
                      >
                        <ArrowDown />
                      </Button>
                    </>
                  )
                }
                note={<MayorNote city={city} hero={h} />}
                showExp
                gear={<HeroGearLine hero={h} cityId={city.id} />}
                onRename={(name) => rename.mutateAsync({ path: { heroId: h.id }, body: { name } }).then(() => undefined)}
              >
                <HeroActions hero={h} city={city} />
              </HeroRow>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
