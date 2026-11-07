import type { CityBean } from '@marchlands/api-client';

import { HeroView } from '@/components/heroes-panel/constants';
import { HeroList } from '@/components/heroes-panel/hero-list/hero-list';
import { HeroSheet } from '@/components/heroes-panel/hero-sheet/hero-sheet';
import { Inn } from '@/components/heroes-panel/inn/inn';

/**
 * The Military page's Heroes tab (docs/features/heroes-page.md), for the city in view: its heroes beside its Inn, the
 * heroes as a Sheet (a roster beside the selected hero's character sheet, with its figure wearing its gear) or a List of cards.
 */
export function HeroesPanel({ city, view, focusInn, onGear }: { city: CityBean; view: HeroView; focusInn: boolean; onGear: () => void }) {
  const inn = <Inn city={city} focus={focusInn} />;
  return view === HeroView.SHEET ? (
    <div className="grid items-start gap-4 2xl:grid-cols-[1fr_minmax(20rem,28rem)]">
      <HeroSheet city={city} onGear={onGear} />
      {inn}
    </div>
  ) : (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <HeroList city={city} />
      {inn}
    </div>
  );
}
