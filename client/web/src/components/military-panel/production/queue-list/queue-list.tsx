import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type CityBean,
  deleteCitiesFortificationsQueuesByQueueIdMutation,
  deleteCitiesTroopsQueuesByQueueIdMutation,
  getCitiesByCityIdQueryKey,
  getCitiesFortificationsQueuesQueryKey,
  getCitiesTroopsQueuesQueryKey,
  getPlayerQueryKey,
  postCitiesFortificationsQueuesSpeedupMutation,
  postCitiesTroopsQueuesSpeedupMutation,
} from '@marchlands/api-client';
import { itemGoldPrice, ItemId } from '@marchlands/core';

import { QUEUE_OPEN_MAX } from '@/components/military-panel/production/constants';
import type { QueueBatch } from '@/components/military-panel/production/types';
import { TimerBar } from '@/components/timer-bar/timer-bar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCommand } from '@/hooks/use-game';
import { useInventory } from '@/hooks/use-inventory';
import { fmt, fmtExact } from '@/lib/format';
import { itemName, troopName } from '@/lib/game-data';

/**
 * The batches in progress, above the order form: open while they are few, collapsed with their count once there are more
 * than QUEUE_OPEN_MAX (until the player opens them), so the form stays near the top. Nothing when none are in progress.
 */
export function QueueList({ city, fort, batches, splitting }: { city: CityBean; fort: boolean; batches: QueueBatch[]; splitting: boolean }) {
  const { t } = useTranslation(['military-panel', 'common']);
  // what the player chose; until then it follows the number of batches
  const [chosen, setChosen] = useState<boolean | null>(null);
  const path = { cityId: city.id };
  const cityKey = getCitiesByCityIdQueryKey({ path });
  const queuesKey = fort ? getCitiesFortificationsQueuesQueryKey({ path }) : getCitiesTroopsQueuesQueryKey({ path });
  const inv = useInventory();
  const boostItem = fort ? ItemId.ARCHIMEDES_NOTE : ItemId.NAPOLEONS_DIARY;
  const boostGold = itemGoldPrice(boostItem) ?? 0;
  const boost = useCommand(
    fort ? postCitiesFortificationsQueuesSpeedupMutation() : postCitiesTroopsQueuesSpeedupMutation(),
    () => [cityKey, queuesKey, getPlayerQueryKey()],
    t('production.boosted', { item: itemName(boostItem) }),
  );
  const cancel = useCommand(
    fort ? deleteCitiesFortificationsQueuesByQueueIdMutation() : deleteCitiesTroopsQueuesByQueueIdMutation(),
    () => [cityKey, queuesKey],
    t('production.batchCancelled'),
  );
  if (batches.length === 0) return null;
  const open = chosen ?? batches.length <= QUEUE_OPEN_MAX;
  return (
    <section className="grid gap-2">
      <Button variant="ghost" size="sm" className="justify-start gap-1.5 px-1" aria-expanded={open} onClick={() => setChosen(!open)}>
        {open ? <ChevronUp /> : <ChevronDown />}
        {t('production.inProgress')}
        <Badge variant="secondary" className="h-4 min-w-4 px-1 tabular-nums">
          {batches.length}
        </Badge>
      </Button>
      {open &&
        batches.map((b) => (
          <div key={`${b.positionId}-${b.queueId}`} className="grid gap-1 rounded-md border p-2 text-sm">
            <div className="flex items-center justify-between">
              <span>
                {fmtExact(b.num)} × {troopName(b.type)}
                {splitting && <span className="text-xs text-muted-foreground"> · {t('production.queueBarracks', { slot: b.positionId })}</span>}
              </span>
              <div className="flex gap-1">
                {b.endTime > 0 && (
                  <Button
                    size="xs"
                    variant="secondary"
                    disabled={boost.isPending || (inv.count(boostItem) === 0 && city.resource.gold < boostGold)}
                    onClick={() => boost.mutate({ path: { ...path, positionId: b.positionId, queueId: b.queueId } })}
                  >
                    {t('production.boost', {
                      item: itemName(boostItem),
                      price: inv.count(boostItem) > 0 ? `×${inv.count(boostItem)}` : t('common:gold', { gold: fmt(boostGold) }),
                    })}
                  </Button>
                )}
                <Button size="xs" variant="ghost" onClick={() => cancel.mutate({ path: { ...path, positionId: b.positionId, queueId: b.queueId } })}>
                  {t('common:actions.cancel')}
                </Button>
              </div>
            </div>
            {b.endTime > 0 ? (
              <TimerBar startTime={b.startTime} endTime={b.endTime} />
            ) : (
              <span className="text-xs text-muted-foreground">{t('production.waiting')}</span>
            )}
          </div>
        ))}
    </section>
  );
}
