import { useTranslation } from 'react-i18next';

import type { CityBean } from '@marchlands/api-client';
import { BALANCE, heroManagement, HeroStatus, heroTimeMultiplier } from '@marchlands/core';

import { percent } from '@/lib/format';

/** How the mayor's Politics shortens build times (×BALANCE.heroTimeFactor per point, at most to BALANCE.heroTimeFloor.building); refreshed live with the hero. */
export function MayorBuildHint({ city }: { city: CityBean }) {
  const { t } = useTranslation('buildings-panel');
  const mayor = city.heros.find((h) => h.status === HeroStatus.MAYOR);
  if (!mayor) return <p className="text-xs text-muted-foreground">{t('mayor.none')}</p>;
  const politics = heroManagement(mayor);
  const cut = percent(1 - heroTimeMultiplier(politics, BALANCE.heroTimeFloor.building), 1);
  return <p className="text-xs text-muted-foreground">{t('mayor.hint', { name: mayor.name, politics, cut })}</p>;
}
