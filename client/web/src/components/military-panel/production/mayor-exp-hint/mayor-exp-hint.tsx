import { Trans, useTranslation } from 'react-i18next';
import type { CityBean } from '@marchlands/api-client';
import { BALANCE, buildingLevel, BuildingType, HeroStatus, prestigeOf, PrestigeAction, unitExp } from '@marchlands/core';
import { fmtExact, fmtDecimal } from '@/lib/format';

/** Experience the mayor earns when the units finish: their experience weight plus the training prestige. */
export function MayorExpHint({ city, typeId, count }: { city: CityBean; typeId: number; count: number }) {
  const { t } = useTranslation('military-panel');
  const mayor = city.heros.find((h) => h.status === HeroStatus.MAYOR);
  if (!mayor) return null;
  const th = buildingLevel(city.buildings, BuildingType.TOWN_HALL);
  const each = unitExp(typeId) * BALANCE.heroExpPerTrain + prestigeOf(PrestigeAction.TRAIN, typeId, 1, th);
  const n = (x: number) => fmtDecimal(x, 2);
  return (
    <span className="text-xs text-muted-foreground">
      {t('mayorExp.perUnit', { name: mayor.name, exp: n(each) })}
      {count > 0 && (
        <>
          {' '}
          ·{' '}
          <Trans
            t={t}
            i18nKey="mayorExp.total"
            values={{ exp: n(Math.floor(each * count)), n: fmtExact(count) }}
            components={{ b: <span className="font-medium text-foreground" /> }}
          />
        </>
      )}
    </span>
  );
}
