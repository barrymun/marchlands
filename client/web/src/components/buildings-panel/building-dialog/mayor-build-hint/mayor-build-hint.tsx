import type { CityBean } from '@marchlands/api-client';
import { BALANCE, heroManagement, HeroStatus, heroTimeMultiplier } from '@marchlands/core';

/** How the mayor's Politics shortens build times (×0.995 per point, at most to BALANCE.heroTimeFloor.building); refreshed live with the hero. */
export function MayorBuildHint({ city }: { city: CityBean }) {
  const mayor = city.heros.find((h) => h.status === HeroStatus.MAYOR);
  if (!mayor) return <p className="text-xs text-muted-foreground">No mayor: appoint one with high Politics in the Heroes tab to build faster.</p>;
  const politics = heroManagement(mayor);
  const cut = Math.round((1 - heroTimeMultiplier(politics, BALANCE.heroTimeFloor.building)) * 1000) / 10;
  return (
    <p className="text-xs text-muted-foreground">
      Times include mayor {mayor.name}'s Politics {politics}: −{cut}%. A mayor with higher Politics builds faster.
    </p>
  );
}
