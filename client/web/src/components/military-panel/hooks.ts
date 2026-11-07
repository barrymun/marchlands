import { useState } from 'react';

import { HERO_VIEW_QUERY, HeroView } from '@/components/heroes-panel/constants';
import { readHeroView, saveHeroView } from '@/components/heroes-panel/utils';
import { useMediaQuery } from '@/hooks/use-media-query';

/** How the Heroes tab shows the heroes: the choice remembered, from md up; narrower, always the List. `canChoose` says whether the choice applies. */
export function useHeroView() {
  const [chosen, setChosen] = useState<HeroView>(readHeroView);
  const canChoose = useMediaQuery(HERO_VIEW_QUERY);
  const choose = (v: HeroView) => {
    setChosen(v);
    saveHeroView(v);
  };
  return { view: canChoose ? chosen : HeroView.LIST, canChoose, choose };
}
