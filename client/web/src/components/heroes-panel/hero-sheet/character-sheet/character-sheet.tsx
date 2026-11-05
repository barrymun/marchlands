import { useTranslation } from 'react-i18next';

import { type CityBean, getCitiesByCityIdQueryKey, type HeroBean, patchHeroesByHeroIdMutation } from '@marchlands/api-client';

import { HeroGearLine } from '@/components/hero-gear/hero-gear-line/hero-gear-line';
import { ExpBar } from '@/components/heroes-panel/exp-bar/exp-bar';
import { HeroActions } from '@/components/heroes-panel/hero-actions/hero-actions';
import { HeroAttributes } from '@/components/heroes-panel/hero-attributes/hero-attributes';
import { HeroBuffs } from '@/components/heroes-panel/hero-buffs/hero-buffs';
import { HeroName } from '@/components/heroes-panel/hero-name/hero-name';
import { PaperDoll } from '@/components/heroes-panel/hero-sheet/character-sheet/paper-doll/paper-doll';
import { MayorNote } from '@/components/mayor-note/mayor-note';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useCommand, usePlayer } from '@/hooks/use-game';

/**
 * The selected hero's sheet: its name (renamed in place), level and experience; the figure wearing its gear with the
 * pieces round it; its attributes, gear bonus, what it would add as mayor, its boosts and its actions.
 */
export function CharacterSheet({ hero, city, onGear }: { hero: HeroBean; city: CityBean; onGear: () => void }) {
  const { t } = useTranslation('heroes-panel');
  const gear = usePlayer().data?.gear;
  const cityPath = { path: { cityId: city.id } };
  const rename = useCommand(patchHeroesByHeroIdMutation(), () => [getCitiesByCityIdQueryKey(cityPath)], t('toast.renamed'));
  return (
    <Card className="@container">
      <CardHeader className="gap-1 pb-2">
        <HeroName
          key={hero.id}
          hero={hero}
          className="text-base"
          onRename={(name) => rename.mutateAsync({ path: { heroId: hero.id }, body: { name } }).then(() => undefined)}
        />
        <ExpBar hero={hero} />
      </CardHeader>
      <CardContent className="grid items-start gap-4 @3xl:grid-cols-[auto_1fr]">
        {gear && <PaperDoll hero={hero} gear={gear} onPiece={onGear} />}
        <div className="grid content-start gap-2">
          <HeroAttributes hero={hero} />
          <HeroGearLine hero={hero} cityId={city.id} />
          <div className="text-xs tabular-nums">
            <MayorNote city={city} hero={hero} />
          </div>
          <HeroBuffs hero={hero} />
          <div className="flex flex-wrap items-center gap-2">
            <HeroActions hero={hero} city={city} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
