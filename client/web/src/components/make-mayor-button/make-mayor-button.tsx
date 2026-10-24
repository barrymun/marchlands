import { useTranslation } from 'react-i18next';

import { type CityBean, getCitiesByCityIdQueryKey, getCitiesTavernQueryKey, type HeroBean, postHeroesMayorMutation } from '@marchlands/api-client';

import { MayorNote } from '@/components/mayor-note/mayor-note';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useCommand } from '@/hooks/use-game';
import { cn } from '@/lib/utils';

/** Appoints a hero the city's mayor; on hover, what it would add to production and how that compares with the mayor now. */
export function MakeMayorButton({ hero, city, className }: { hero: HeroBean; city: CityBean; className?: string }) {
  const { t } = useTranslation('make-mayor-button');
  const cityPath = { path: { cityId: city.id } };
  // the Inn's offers compare themselves with the mayor too
  const appoint = useCommand(postHeroesMayorMutation(), () => [getCitiesByCityIdQueryKey(cityPath), getCitiesTavernQueryKey(cityPath)], t('appointed'));
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="xs"
          variant="outline"
          className={cn('h-6', className)}
          disabled={appoint.isPending}
          onClick={() => appoint.mutate({ path: { heroId: hero.id } })}
        >
          {t('label')}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <MayorNote city={city} hero={hero} />
      </TooltipContent>
    </Tooltip>
  );
}
