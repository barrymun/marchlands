import type { Rgba } from 'lightweight-charts';

import { ResourceKey } from '@marchlands/core';

import { RESOURCES } from '@/components/market-panel/constants';
import { fmtDecimal, resourceLabel } from '@/lib/format';
import { i18n } from '@/lib/i18n';

/** A market resource type as a label ("Lumber"); type 4 is gold. */
export const resLabel = (t: number) => (t === 4 ? resourceLabel(ResourceKey.GOLD) : (RESOURCES[t]?.label ?? `#${t}`));

/** A market resource type as it reads inside a sentence ("lumber"); type 4 is gold. */
export const resInline = (t: number) =>
  t === 4 ? i18n.t('common:resourcesInline.gold') : RESOURCES[t] ? i18n.t(`common:resourcesInline.${RESOURCES[t].key}`) : `#${t}`;

/** A price in gold per unit, always with three decimals. */
export const fmtPrice = (p: number) => fmtDecimal(p, 3, 3);

/**
 * Any CSS colour (the theme's oklch(), color-mix() …) as the RGBA Lightweight Charts draws with: the browser
 * paints it on a 1×1 canvas and reads it back. Null without a canvas. Given to charts as `layout.colorParsers`.
 */
export function cssColour(colour: string): Rgba | null {
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, 1, 1);
  const [r = 0, g = 0, b = 0, a = 0] = ctx.getImageData(0, 0, 1, 1).data;
  return [r, g, b, a / 255] as Rgba;
}
