import { Trans, useTranslation } from 'react-i18next';

import { BALANCE, getGameSpeed, splitTraining } from '@marchlands/core';

import { InstantNote } from '@/components/military-panel/production/train-estimate/instant-note/instant-note';
import type { Queue } from '@/components/military-panel/production/train-estimate/types';
import { useNow } from '@/hooks/use-now';
import { duration, fmtDecimal, fmtExact } from '@/lib/format';

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
  const { t } = useTranslation(['military-panel', 'common']);
  const now = useNow();
  const unitMs = (Math.max(BALANCE.minTrainUnitSeconds, unitSeconds) * 1000) / getGameSpeed();
  const freeAt = (q?: Queue) => {
    const [first, ...rest] = q?.allProduceQueue ?? [];
    if (!first) return now;
    const head = Math.max(now, first.endTime || now + first.costTime * 1000);
    return head + rest.reduce((t, b) => t + b.costTime * 1000, 0);
  };
  const instant = unitMs <= 0;
  const perUnit = t('trainEstimate.perUnit', {
    time: unitMs < 10_000 ? t('common:units.seconds', { value: fmtDecimal(unitMs / 1000, 2) }) : duration(unitMs),
  });
  if (count <= 0 || fort) return instant ? <InstantNote count={count} waitMs={0} /> : <span className="text-xs text-muted-foreground">{perUnit}</span>;
  const single = freeAt(queues.find((q) => q.positionId === pos)) + count * unitMs - now;
  if (!splitting) {
    if (instant) return <InstantNote count={count} waitMs={single} />;
    return <span className="text-xs text-muted-foreground">{t('trainEstimate.readyIn', { perUnit, n: fmtExact(count), time: duration(single) })}</span>;
  }
  const lanes = barracks
    .filter((b) => (queues.find((q) => q.positionId === b.positionId)?.allProduceQueue.length ?? 0) < b.level)
    .map((b) => ({ positionId: b.positionId, freeAt: freeAt(queues.find((q) => q.positionId === b.positionId)) }));
  const plan = splitTraining(lanes, count, unitMs);
  if (!plan.length) return <span className="text-xs text-destructive">{t('trainEstimate.queuesFull')}</span>;
  const finish = Math.max(...plan.map((p) => p.finishAt)) - now;
  if (instant) return <InstantNote count={count} waitMs={finish} />;
  return (
    <span className="text-xs text-muted-foreground">
      <Trans
        t={t}
        i18nKey="trainEstimate.split"
        values={{
          perUnit,
          n: fmtExact(count),
          time: duration(finish),
          lanes: plan.length,
          shares: plan.map((p) => fmtExact(p.count)).join(' / '),
          single: duration(count * unitMs),
        }}
        components={{ b: <span className="font-medium text-foreground" /> }}
      />
    </span>
  );
}
