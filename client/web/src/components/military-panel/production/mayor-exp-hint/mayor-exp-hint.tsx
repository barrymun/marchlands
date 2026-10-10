import type { CityBean } from '@marchlands/api-client';
import { BALANCE, buildingLevel, BuildingType, HeroStatus, prestigeOf, PrestigeAction, unitExp } from '@marchlands/core';
import { fmtExact } from '@/lib/format';

/** Experience the mayor earns when the units finish: their experience weight plus the training prestige. */
export function MayorExpHint({ city, typeId, count }: { city: CityBean; typeId: number; count: number }) {
  const mayor = city.heros.find((h) => h.status === HeroStatus.MAYOR);
  if (!mayor) return null;
  const th = buildingLevel(city.buildings, BuildingType.TOWN_HALL);
  const each = unitExp(typeId) * BALANCE.heroExpPerTrain + prestigeOf(PrestigeAction.TRAIN, typeId, 1, th);
  const n = (x: number) => x.toLocaleString('en', { maximumFractionDigits: 2 });
  return (
    <span className="text-xs text-muted-foreground">
      Mayor {mayor.name} gains {n(each)} exp per unit
      {count > 0 && (
        <>
          {' '}
          · <span className="font-medium text-foreground">+{n(Math.floor(each * count))} exp</span> for {fmtExact(count)}
        </>
      )}
    </span>
  );
}
