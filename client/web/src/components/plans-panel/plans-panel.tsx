import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { getPlansOptions } from '@marchlands/api-client';

import { PlanCard } from '@/components/plans-panel/plan-card/plan-card';
import { PlanForm } from '@/components/plans-panel/plan-form/plan-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePlayer } from '@/hooks/use-game';

/**
 * Wave plans (camp times, docs/features/camp-times.md): the player's own and their alliance's shared plans, each a
 * target and a landing second with its waves in order. Plans are started, changed and filled with waves here.
 */
export function PlansPanel() {
  const { t } = useTranslation('plans-panel');
  const plans = useQuery(getPlansOptions());
  const playerId = usePlayer().data?.playerInfo.id;
  return (
    <div className="grid gap-4">
      <p className="max-w-md text-sm text-muted-foreground">{t('intro')}</p>
      <Card size="sm">
        <CardHeader>
          <CardTitle>{t('newPlan')}</CardTitle>
        </CardHeader>
        <CardContent>
          <PlanForm />
        </CardContent>
      </Card>
      {plans.isPending || playerId == null ? (
        <Skeleton className="h-40" />
      ) : plans.data?.length ? (
        plans.data.map((p) => <PlanCard key={p.id} plan={p} playerId={playerId} />)
      ) : (
        <p className="max-w-md text-sm text-muted-foreground">{t('empty')}</p>
      )}
    </div>
  );
}
