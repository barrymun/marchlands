import { useTranslation } from 'react-i18next';
import type { HeroBean, ResourceLine } from '@marchlands/api-client';
import { ITEM_BONUS_TEXT_INVERTED } from '@/lib/tones';
import { Rows } from '@/components/resource-bar/rows/rows';
import type { Row } from '@/components/resource-bar/types';

export function Breakdown({ line, mayor }: { line: ResourceLine; mayor?: HeroBean }) {
  const { t } = useTranslation(['resource-bar', 'common']);
  const b = line.breakdown;
  const rows: Row[] = [
    [t('breakdown.base'), b.base],
    [line.workRate !== 100 ? t('breakdown.fieldsWorkRate', { rate: line.workRate }) : t('breakdown.fields'), b.fields],
  ];
  // a bonus row shows whenever the bonus is active, even on a resource with no fields (+0/h), like the mayor's
  if (b.techPercent) rows.push([t('breakdown.technology', { percent: b.techPercent }), b.tech]);
  rows.push([mayor ? t('breakdown.mayor', { name: mayor.name, percent: b.mayorPercent }) : t('common:noMayor'), b.mayor]);
  if (b.valleyPercent) rows.push([t('breakdown.valleys', { percent: b.valleyPercent }), b.valley]);
  if (b.buffPercent) rows.push([t('itemBonus', { percent: b.buffPercent }), b.buff, ITEM_BONUS_TEXT_INVERTED]);
  if (b.upkeep) rows.push([t('breakdown.upkeep'), b.upkeep]);
  if (b.tax) rows.push([t('breakdown.tax'), b.tax]);
  return <Rows rows={rows} total={line.increaseRate} />;
}
