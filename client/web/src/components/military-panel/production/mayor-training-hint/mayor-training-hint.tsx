import { useTranslation } from 'react-i18next';
import type { CityBean } from '@marchlands/api-client';
import { heroManagement, heroPower, HeroStatus, heroTimeMultiplier } from '@marchlands/core';
import { percent } from '@/lib/format';

/** The mayor's Attack (troops) or Politics (fortifications) shortens training: ×BALANCE.heroTimeFactor per point. */
export function MayorTrainingHint({ city, fort }: { city: CityBean; fort: boolean }) {
  const { t } = useTranslation(['military-panel', 'common']);
  const stat = fort ? t('common:heroAttributes.politics') : t('common:heroAttributes.attack');
  const mayor = city.heros.find((h) => h.status === HeroStatus.MAYOR);
  if (!mayor) return <p className="text-xs text-muted-foreground">{t(fort ? 'mayorTraining.noMayorBuild' : 'mayorTraining.noMayorTrain', { stat })}</p>;
  const value = fort ? heroManagement(mayor) : heroPower(mayor);
  const cut = percent(1 - heroTimeMultiplier(value), 1);
  return <p className="text-xs text-muted-foreground">{t(fort ? 'mayorTraining.build' : 'mayorTraining.train', { name: mayor.name, stat, value, cut })}</p>;
}
