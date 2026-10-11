import { useTranslation } from 'react-i18next';
import { duration, fmt, fmtDecimal } from '@/lib/format';

interface Cost {
  gold: number;
  food: number;
  wood: number;
  stone: number;
  iron: number;
}

export function CostList({ cost, seconds, have }: { cost: Cost; seconds?: number; have?: Partial<Cost> }) {
  const { t } = useTranslation(['cost-list', 'common']);
  const parts = (['gold', 'food', 'wood', 'stone', 'iron'] as const).filter((k) => cost[k] > 0);
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums">
      {parts.map((k) => (
        <span key={k} className={have && (have[k] ?? 0) < cost[k] ? 'text-destructive' : 'text-muted-foreground'}>
          {t('item', {
            resource: t(`common:resourcesInline.${k}`),
            amount: cost[k] % 1 && cost[k] < 1000 ? fmtDecimal(cost[k], 1) : fmt(cost[k]),
          })}
        </span>
      ))}
      {seconds != null && <span className="text-muted-foreground">⏱ {duration(seconds * 1000)}</span>}
    </div>
  );
}
