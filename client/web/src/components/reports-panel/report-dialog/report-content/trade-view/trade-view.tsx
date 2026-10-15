import { useTranslation } from 'react-i18next';

import type { ReportBody } from '@marchlands/core';

import { Line } from '@/components/reports-panel/report-dialog/report-content/line/line';
import { ResourceList } from '@/components/reports-panel/report-dialog/report-content/resource-list/resource-list';
import { fmtDecimal, fmtExact } from '@/lib/format';

export function TradeView({ trade }: { trade: Extract<ReportBody, { kind: 'trade' }>['trade'] }) {
  const { t } = useTranslation(['reports-panel', 'common']);
  if ('side' in trade) {
    return (
      <div className="grid gap-1.5 text-sm">
        <Line label={trade.side === 'buy' ? t('labels.bought') : t('labels.sold')}>
          {t('trade.order', {
            amount: fmtExact(trade.amount),
            resource: t(`common:resourcesInline.${trade.resource}`),
            price: fmtDecimal(trade.price, 3),
          })}
        </Line>
        <Line label={t('labels.gold')}>{fmtExact(trade.gold)}</Line>
      </div>
    );
  }
  return (
    <div className="grid gap-1.5 text-sm">
      <Line label={t('labels.from')}>{trade.from}</Line>
      <Line label={t('labels.to')}>{trade.to}</Line>
      <Line label={t('labels.goods')}>
        <ResourceList res={trade.resources} />
      </Line>
    </div>
  );
}
