import { useTranslation } from 'react-i18next';

import type { MarketNpcTrade } from '@marchlands/api-client';
import { factionOfZone } from '@marchlands/core';

import { useShortList } from '@/components/market-panel/hooks';
import { ShowMore } from '@/components/market-panel/show-more/show-more';
import { fmtPrice } from '@/components/market-panel/utils';
import { ResourceIcon } from '@/components/resource-icon/resource-icon';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FACTION_STYLE } from '@/lib/factions';
import { clockTime, fmt } from '@/lib/format';
import { factionName, zoneName } from '@/lib/game-data';
import { cn } from '@/lib/utils';

/** The factions' latest trades with each other in one resource, each named with its icon: single trades made up from each minute's auction. */
export function FactionsTicker({ trades }: { trades: MarketNpcTrade[] }) {
  const { t } = useTranslation(['market-panel', 'common']);
  const list = useShortList(trades);
  // a group: its faction's colour, then its zone and level, the faction named on hover
  const group = (g: MarketNpcTrade['seller']) => {
    const f = factionOfZone(g.zone);
    return (
      <span className="flex items-center gap-1.5" title={f ? factionName(f.id) : undefined}>
        {f && <span aria-hidden className={cn('size-2 shrink-0 rounded-sm', FACTION_STYLE[f.id].swatch)} />}
        {t('ticker.group', { zone: zoneName(g.zone), level: g.level })}
      </span>
    );
  };
  if (trades.length === 0) return <p className="p-3 text-xs text-muted-foreground">{t('ticker.none')}</p>;
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('ticker.seller')}</TableHead>
            <TableHead>{t('ticker.buyer')}</TableHead>
            <TableHead className="text-end">{t('ticker.trade')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="text-xs">
          {list.shown.map((x) => (
            <TableRow key={`${x.at}-${x.seller.zone}-${x.seller.level}-${x.buyer.zone}-${x.buyer.level}`}>
              <TableCell className="whitespace-normal">{group(x.seller)}</TableCell>
              <TableCell className="whitespace-normal">{group(x.buyer)}</TableCell>
              <TableCell className="text-end whitespace-normal tabular-nums">
                <span className="flex items-center justify-end gap-1.5">
                  <ResourceIcon resource={x.resource} />
                  {t('ticker.amountAt', { amount: fmt(x.amount), resource: t(`common:resourcesInline.${x.resource}`), price: fmtPrice(x.price) })}
                </span>
                <div className="text-muted-foreground">{clockTime(x.at, true)}</div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ShowMore hidden={list.hidden} onMore={list.showAll} />
    </>
  );
}
