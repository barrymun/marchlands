import { useSearchParams } from 'react-router';

import type { CityBean } from '@marchlands/api-client';

import { CharacterSheet } from '@/components/heroes-panel/hero-sheet/character-sheet/character-sheet';
import { Roster } from '@/components/heroes-panel/hero-sheet/roster/roster';
import { sheetHero } from '@/components/heroes-panel/utils';

/**
 * The Heroes tab as a sheet (Sheet, from md up): the roster beside the selected hero's character sheet. The hero is in
 * the address (`?hero=123`), so it can be linked to; with none, the mayor's sheet shows.
 */
export function HeroSheet({ city, onGear }: { city: CityBean; onGear: () => void }) {
  const [search, setSearch] = useSearchParams();
  const hero = sheetHero(city.heros, search.get('hero'));
  return (
    <div className="grid items-start gap-4 md:grid-cols-[15rem_1fr] xl:grid-cols-[17rem_1fr]">
      <Roster
        city={city}
        selected={hero?.id ?? null}
        onSelect={(id) =>
          setSearch(
            (s) => {
              s.set('hero', String(id));
              return s;
            },
            { replace: true },
          )
        }
      />
      {hero && <CharacterSheet hero={hero} city={city} onGear={onGear} />}
    </div>
  );
}
