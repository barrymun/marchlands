import { useTranslation } from 'react-i18next';

import type { CityBean, HeroBean } from '@marchlands/api-client';
import { HeroStatus } from '@marchlands/core';

import { percent, signedRate } from '@/lib/format';
import { mayorGain, mayorShare } from '@/lib/mayor';
import { GAIN_TEXT, LOSS_TEXT } from '@/lib/tones';

/**
 * What a hero adds to the city's production as mayor: the mayor's bonus, or for an idle hero what it would add and how
 * that compares with the mayor now. Nothing for a hero away.
 */
export function MayorNote({ city, hero }: { city: CityBean; hero: HeroBean }) {
  const { t } = useTranslation('mayor-note');
  const pct = percent(mayorShare(hero));
  const rate = signedRate(mayorGain(city, hero));
  if (hero.status === HeroStatus.MAYOR) return <span className={GAIN_TEXT}>{t('bonus', { pct, rate })}</span>;
  if (hero.status !== HeroStatus.IDLE) return null;
  const mayor = city.heros.find((h) => h.status === HeroStatus.MAYOR);
  const diff = mayorGain(city, hero) - (mayor ? mayorGain(city, mayor) : 0);
  return (
    <span>
      {t('asMayor', { pct, rate })}
      {mayor && <span className={diff > 0 ? GAIN_TEXT : diff < 0 ? LOSS_TEXT : ''}> {t('versus', { diff: signedRate(diff), name: mayor.name })}</span>}
    </span>
  );
}
