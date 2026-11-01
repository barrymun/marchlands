import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { getPlansOptions } from '@marchlands/api-client';

import { PlanCard } from '@/components/plans-panel/plan-card/plan-card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePlayer } from '@/hooks/use-game';

/**
 * Wave plans (camp times, docs/features/camp-times.md): the player's own and their alliance's shared plans, each a
 * target and a landing second with its waves in order. Waves are added from the send-army dialog.
 */
export function PlansPanel() {
  const { t } = useTranslation('plans-panel');
  const plans = useQuery(getPlansOptions());
  const playerId = usePlayer().data?.playerInfo.id;
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">{t('intro')}</p>
      {plans.isPending || playerId == null ? (
        <Skeleton className="h-40" />
      ) : plans.data?.length ? (
        plans.data.map((p) => <PlanCard key={p.id} plan={p} playerId={playerId} />)
      ) : (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      )}
    </div>
  );
}
