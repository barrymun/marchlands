import type { ReportBody } from '@marchlands/core';
import { fmtExact } from '@/lib/format';
import { RES_LABEL } from '@/components/reports-panel/report-dialog/report-content/constants';
import { ResourceList } from '@/components/reports-panel/report-dialog/report-content/resource-list/resource-list';
import { Line } from '@/components/reports-panel/report-dialog/report-content/line/line';

export function TradeView({ trade: t }: { trade: Extract<ReportBody, { kind: 'trade' }>['trade'] }) {
  if ('side' in t) {
    return (
      <div className="grid gap-1.5 text-sm">
        <Line label={t.side === 'buy' ? 'Bought' : 'Sold'}>
          {fmtExact(t.amount)} {RES_LABEL[t.resource]?.toLowerCase()} at {t.price.toLocaleString('en', { maximumFractionDigits: 3 })}
        </Line>
        <Line label="Gold">{fmtExact(t.gold)}</Line>
      </div>
    );
  }
  return (
    <div className="grid gap-1.5 text-sm">
      <Line label="From">{t.from}</Line>
      <Line label="To">{t.to}</Line>
      <Line label="Goods">
        <ResourceList res={t.resources} />
      </Line>
    </div>
  );
}
