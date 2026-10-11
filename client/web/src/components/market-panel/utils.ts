import { RESOURCES } from '@/components/market-panel/constants';
import { i18n } from '@/lib/i18n';
import { resourceLabel, fmtDecimal } from '@/lib/format';

/** A market resource type as a label ("Lumber"); type 4 is gold. */
export const resLabel = (t: number) => (t === 4 ? resourceLabel('gold') : (RESOURCES[t]?.label ?? `#${t}`));

/** A market resource type as it reads inside a sentence ("lumber"); type 4 is gold. */
export const resInline = (t: number) =>
  t === 4 ? i18n.t('common:resourcesInline.gold') : RESOURCES[t] ? i18n.t(`common:resourcesInline.${RESOURCES[t].key}`) : `#${t}`;

/** A price in gold per unit, always with three decimals. */
export const fmtPrice = (p: number) => fmtDecimal(p, 3, 3);
