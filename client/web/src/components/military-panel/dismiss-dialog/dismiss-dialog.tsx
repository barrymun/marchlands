import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type CityBean,
  getCitiesByCityIdQueryKey,
  getPlayerQueryKey,
  postCitiesFortificationsDestroyMutation,
  postCitiesTroopsDisbandMutation,
} from '@marchlands/api-client';
import { BALANCE, disbandRefund, fortKeyOf, troopKey as troopKeyOf } from '@marchlands/core';

import { ConfirmDialog } from '@/components/confirm-dialog/confirm-dialog';
import { CostList } from '@/components/cost-list/cost-list';
import { dismissCount } from '@/components/military-panel/dismiss-dialog/utils';
import { Input } from '@/components/ui/input';
import { useCommand, usePlayer } from '@/hooks/use-game';
import { useSticky } from '@/hooks/use-sticky';
import { fmtExact, percent } from '@/lib/format';
import { troopName } from '@/lib/game-data';

/**
 * Dismisses troops or destroys fortifications (`unitId`, null when closed) of this city, showing what they give back:
 * BALANCE.disbandRefund of their training cost, up to the player's refund credit (disbandRefund in core).
 */
export function DismissDialog({ city, unitId, onClose }: { city: CityBean; unitId: number | null; onClose: () => void }) {
  const { t } = useTranslation('military-panel');
  const player = usePlayer();
  const [amount, setAmount] = useState('');
  const id = useSticky(unitId) ?? 0;
  const fortKey = fortKeyOf(id);
  const troopKey = troopKeyOf(id);
  const key = fortKey ?? troopKey;
  const have = (fortKey ? city.fortification[fortKey] : troopKey ? city.troop[troopKey] : 0) ?? 0;
  const count = dismissCount(amount, have);
  const refund = key && count > 0 ? disbandRefund(id, count, player.data?.refundCredit[key] ?? 0).refund : null;
  const hasRefund = refund != null && Object.values(refund).some((v) => v > 0);
  const path = { cityId: city.id };
  const refresh = () => [getCitiesByCityIdQueryKey({ path }), getPlayerQueryKey()];
  const disband = useCommand(postCitiesTroopsDisbandMutation(), refresh, t('dismiss.dismissed', { count, n: fmtExact(count) }));
  const destroy = useCommand(postCitiesFortificationsDestroyMutation(), refresh, t('dismiss.destroyed', { count, n: fmtExact(count) }));
  const close = () => {
    setAmount('');
    onClose();
  };
  return (
    <ConfirmDialog
      open={unitId != null}
      onOpenChange={(o) => !o && close()}
      title={t(fortKey ? 'dismiss.titleForts' : 'dismiss.titleTroops', { unit: troopName(id) })}
      description={`${t(fortKey ? 'dismiss.fortsInfo' : 'dismiss.troopsInfo')} ${t('dismiss.refundInfo', { percent: percent(BALANCE.disbandRefund) })}`}
      confirmLabel={t(fortKey ? 'dismiss.destroy' : 'dismiss.dismiss', { n: fmtExact(count) })}
      disabled={count <= 0}
      onConfirm={() => (fortKey ? destroy : disband).mutateAsync({ path, body: { troopId: id, count } }).then(close)}
    >
      <div className="grid gap-3 text-sm">
        <Input
          inputMode="numeric"
          aria-label={t('dismiss.amount')}
          placeholder={t('dismiss.allPlaceholder', { n: fmtExact(have) })}
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
        />
        {hasRefund ? (
          <div className="grid gap-1">
            <span>{t('dismiss.refund')}</span>
            <CostList cost={refund} />
          </div>
        ) : (
          <span className="text-muted-foreground">{t('dismiss.noRefund')}</span>
        )}
      </div>
    </ConfirmDialog>
  );
}
