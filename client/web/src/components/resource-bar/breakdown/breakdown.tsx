import type { HeroBean, ResourceLine } from '@marchlands/api-client';
import { ITEM_BONUS_TEXT_INVERTED } from '@/lib/tones';
import { Rows } from '@/components/resource-bar/rows/rows';
import type { Row } from '@/components/resource-bar/types';

export function Breakdown({ line, mayor }: { line: ResourceLine; mayor?: HeroBean }) {
  const b = line.breakdown;
  const rows: Row[] = [
    ['Base', b.base],
    [`Fields${line.workRate !== 100 ? ` (${line.workRate}% work rate)` : ''}`, b.fields],
  ];
  // a bonus row shows whenever the bonus is active, even on a resource with no fields (+0/h), like the mayor's
  if (b.techPercent) rows.push([`Technology +${b.techPercent}%`, b.tech]);
  rows.push([mayor ? `Mayor ${mayor.name} +${b.mayorPercent}%` : 'No mayor', b.mayor]);
  if (b.valleyPercent) rows.push([`Valleys +${b.valleyPercent}%`, b.valley]);
  if (b.buffPercent) rows.push([`Items +${b.buffPercent}%`, b.buff, ITEM_BONUS_TEXT_INVERTED]);
  if (b.upkeep) rows.push(['Troop upkeep', b.upkeep]);
  if (b.tax) rows.push(['Tax (sold for gold)', b.tax]);
  return <Rows rows={rows} total={line.increaseRate} />;
}
