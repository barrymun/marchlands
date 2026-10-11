import { useTranslation } from 'react-i18next';
import type { CityBean } from '@marchlands/api-client';
import { heroManagement, heroPower, HeroStatus } from '@marchlands/core';

/** The mayor's Attack (troops) or Politics (fortifications) shortens training: ×0.995 per point. */
export function MayorTrainingHint({ city, fort }: { city: CityBean; fort: boolean }) {
  const { t } = useTranslation(['military-panel', 'common']);
  const stat = fort ? t('common:heroAttributes.politics') : t('common:heroAttributes.attack');
  const mayor = city.heros.find((h) => h.status === HeroStatus.MAYOR);
  if (!mayor) return <p className="text-xs text-muted-foreground">{t(fort ? 'mayorTraining.noMayorBuild' : 'mayorTraining.noMayorTrain', { stat })}</p>;
  const value = fort ? heroManagement(mayor) : heroPower(mayor);
  const cut = Math.round((1 - Math.pow(0.995, value)) * 1000) / 10;
  return <p className="text-xs text-muted-foreground">{t(fort ? 'mayorTraining.build' : 'mayorTraining.train', { name: mayor.name, stat, value, cut })}</p>;
}
