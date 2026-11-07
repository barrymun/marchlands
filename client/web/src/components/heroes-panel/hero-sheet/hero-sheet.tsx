import type { CityBean } from '@marchlands/api-client';

import { CharacterSheet } from '@/components/heroes-panel/hero-sheet/character-sheet/character-sheet';
import { Roster } from '@/components/heroes-panel/hero-sheet/roster/roster';
import { sheetHero } from '@/components/heroes-panel/utils';
import { useSearchState } from '@/hooks/use-search-state';
import { MILITARY_SEARCH } from '@/lib/screen-search';

/**
 * The Heroes tab as a sheet (Sheet, from md up): the roster beside the selected hero's character sheet. The hero is in
 * the address (`?hero=123`), so it can be linked to; with none, the mayor's sheet shows.
 */
export function HeroSheet({ city, onGear }: { city: CityBean; onGear: () => void }) {
  const [search, set] = useSearchState(MILITARY_SEARCH);
  const hero = sheetHero(city.heros, search.hero);
  return (
    <div className="grid items-start gap-4 md:grid-cols-[15rem_1fr] xl:grid-cols-[17rem_1fr]">
      <Roster city={city} selected={hero?.id ?? null} onSelect={(id) => set({ hero: id })} />
      {hero && <CharacterSheet hero={hero} city={city} onGear={onGear} />}
    </div>
  );
}
