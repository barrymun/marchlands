import type { CityBean } from '@marchlands/api-client';
import { heroManagement, heroPower, HeroStatus } from '@marchlands/core';

/** The mayor's Attack (troops) or Politics (fortifications) shortens training: ×0.995 per point. */
export function MayorTrainingHint({ city, fort }: { city: CityBean; fort: boolean }) {
  const stat = fort ? 'Politics' : 'Attack';
  const mayor = city.heros.find((h) => h.status === HeroStatus.MAYOR);
  if (!mayor)
    return (
      <p className="text-xs text-muted-foreground">
        No mayor: appoint one with high {stat} in the Heroes tab to {fort ? 'build fortifications' : 'train'} faster.
      </p>
    );
  const value = fort ? heroManagement(mayor) : heroPower(mayor);
  const cut = Math.round((1 - Math.pow(0.995, value)) * 1000) / 10;
  return (
    <p className="text-xs text-muted-foreground">
      Times include mayor {mayor.name}'s {stat} {value}: −{cut}% (new batches). A mayor with higher {stat} {fort ? 'builds them' : 'trains'} faster.
    </p>
  );
}
