import { duration, fmt } from '@/lib/format';

interface Cost {
  gold: number;
  food: number;
  wood: number;
  stone: number;
  iron: number;
}

export function CostList({ cost, seconds, have }: { cost: Cost; seconds?: number; have?: Partial<Cost> }) {
  const parts = (['gold', 'food', 'wood', 'stone', 'iron'] as const).filter((k) => cost[k] > 0);
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums">
      {parts.map((k) => (
        <span key={k} className={have && (have[k] ?? 0) < cost[k] ? 'text-destructive' : 'text-muted-foreground'}>
          {k === 'wood' ? 'lumber' : k} {cost[k] % 1 && cost[k] < 1000 ? cost[k].toLocaleString('en', { maximumFractionDigits: 1 }) : fmt(cost[k])}
        </span>
      ))}
      {seconds != null && <span className="text-muted-foreground">⏱ {duration(seconds * 1000)}</span>}
    </div>
  );
}
