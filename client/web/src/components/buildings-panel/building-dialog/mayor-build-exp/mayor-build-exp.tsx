import type { CityBean } from '@marchlands/api-client';
import { buildingHeroExp, buildingLevel, BuildingType, HeroStatus } from '@marchlands/core';

/** Experience the mayor earns when this building level completes (construction.ts buildingHeroExp). */
export function MayorBuildExp({ city, typeId, level }: { city: CityBean; typeId: number; level: number }) {
  const mayor = city.heros.find((h) => h.status === HeroStatus.MAYOR);
  if (!mayor) return null;
  // a Town Hall upgrade counts its own new level, as on the server
  const th = typeId === BuildingType.TOWN_HALL ? level : buildingLevel(city.buildings, BuildingType.TOWN_HALL);
  return (
    <span className="text-xs text-muted-foreground">
      Mayor {mayor.name} gains {Math.floor(buildingHeroExp(typeId, level, th)).toLocaleString('en')} exp when it completes
    </span>
  );
}
