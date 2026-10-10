import { BALANCE, getGameSpeed, splitTraining } from '@marchlands/core';
import { useNow } from '@/hooks/use-now';
import { duration, fmtExact } from '@/lib/format';
import type { Queue } from '@/components/military-panel/production/train-estimate/types';

/** Real time per unit, and (when an amount is entered) when the order would finish: in one barracks, or split. */
export function TrainEstimate({
  unitSeconds,
  count,
  queues,
  barracks,
  pos,
  splitting,
  fort,
}: {
  unitSeconds: number;
  count: number;
  queues: Queue[];
  barracks: { positionId: number; level: number }[];
  pos: number;
  splitting: boolean;
  fort: boolean;
}) {
  const now = useNow();
  const unitMs = (Math.max(BALANCE.minTrainUnitSeconds, unitSeconds) * 1000) / getGameSpeed();
  const freeAt = (q?: Queue) => {
    const list = q?.allProduceQueue ?? [];
    if (!list.length) return now;
    const head = Math.max(now, list[0].endTime || now + list[0].costTime * 1000);
    return head + list.slice(1).reduce((t, b) => t + b.costTime * 1000, 0);
  };
  const perUnit =
    unitMs <= 0
      ? 'instant (mayor and Military Science fast enough)'
      : `${unitMs < 10_000 ? `${(unitMs / 1000).toLocaleString('en', { maximumFractionDigits: 2 })}s` : duration(unitMs)} per unit`;
  const each = <span className="text-xs text-muted-foreground">{perUnit}</span>;
  if (count <= 0 || fort) return each;
  const single = freeAt(queues.find((q) => q.positionId === pos)) + count * unitMs - now;
  if (!splitting) {
    return (
      <span className="text-xs text-muted-foreground">
        {perUnit} · {fmtExact(count)} ready in {duration(single)}
      </span>
    );
  }
  const lanes = barracks
    .filter((b) => (queues.find((q) => q.positionId === b.positionId)?.allProduceQueue.length ?? 0) < b.level)
    .map((b) => ({ positionId: b.positionId, freeAt: freeAt(queues.find((q) => q.positionId === b.positionId)) }));
  const plan = splitTraining(lanes, count, unitMs);
  if (!plan.length) return <span className="text-xs text-destructive">Every barracks queue is full.</span>;
  const finish = Math.max(...plan.map((p) => p.finishAt)) - now;
  return (
    <span className="text-xs text-muted-foreground">
      {perUnit} · {fmtExact(count)} ready in <span className="font-medium text-foreground">{duration(finish)}</span> across {plan.length} barracks (
      {plan.map((p) => fmtExact(p.count)).join(' / ')}) instead of {duration(count * unitMs)} in one
    </span>
  );
}
