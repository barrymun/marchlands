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
import { NumberField } from '@/components/number-field/number-field';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useCommand, usePlayer } from '@/hooks/use-game';
import { useSticky } from '@/hooks/use-sticky';
import { fmtExact, percent } from '@/lib/format';
import { troopName } from '@/lib/game-data';
import { LOSS_TEXT } from '@/lib/tones';
import { cn } from '@/lib/utils';

/**
 * Dismisses troops or destroys fortifications (`unitId`, null when closed) of this city, showing what they give back:
 * BALANCE.disbandRefund of their training cost, up to the player's refund credit (disbandRefund in core). The player
 * types how many (there is no "all"), then confirms that exact number in a second dialog before anything happens.
 */
export function DismissDialog({ city, unitId, onClose }: { city: CityBean; unitId: number | null; onClose: () => void }) {
  const { t } = useTranslation(['military-panel', 'common']);
  const player = usePlayer();
  const [amount, setAmount] = useState('');
  // the amount is chosen and the player is asked to confirm it
  const [sure, setSure] = useState(false);
  const id = useSticky(unitId) ?? 0;
  const fortKey = fortKeyOf(id);
  const troopKey = troopKeyOf(id);
  const key = fortKey ?? troopKey;
  const have = (fortKey ? city.fortification[fortKey] : troopKey ? city.troop[troopKey] : 0) ?? 0;
  const count = dismissCount(amount, have);
  const tooMany = Number(amount) > have;
  const refund = key && count > 0 ? disbandRefund(id, count, player.data?.refundCredit[key] ?? 0).refund : null;
  const hasRefund = refund != null && Object.values(refund).some((v) => v > 0);
  const path = { cityId: city.id };
  const refresh = () => [getCitiesByCityIdQueryKey({ path }), getPlayerQueryKey()];
  const disband = useCommand(postCitiesTroopsDisbandMutation(), refresh, t('dismiss.dismissed', { count, n: fmtExact(count) }));
  const destroy = useCommand(postCitiesFortificationsDestroyMutation(), refresh, t('dismiss.destroyed', { count, n: fmtExact(count) }));
  const close = () => {
    setAmount('');
    setSure(false);
    onClose();
  };
  const refundInfo = hasRefund ? (
    <div className="grid gap-1 text-sm">
      <span>{t('dismiss.refund')}</span>
      <CostList cost={refund} />
    </div>
  ) : (
    <span className="text-sm text-muted-foreground">{t('dismiss.noRefund')}</span>
  );
  return (
    <>
      <Dialog open={unitId != null && !sure} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-md">
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (count > 0) setSure(true);
            }}
          >
            <DialogHeader>
              <DialogTitle>{t(fortKey ? 'dismiss.titleForts' : 'dismiss.titleTroops', { unit: troopName(id) })}</DialogTitle>
              <DialogDescription>
                {`${t(fortKey ? 'dismiss.fortsInfo' : 'dismiss.troopsInfo')} ${t('dismiss.refundInfo', { percent: percent(BALANCE.disbandRefund) })}`}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="dismiss-amount">{t('dismiss.amount')}</Label>
                <span className={cn('text-xs tabular-nums', tooMany ? LOSS_TEXT : 'text-muted-foreground')}>{t('dismiss.have', { n: fmtExact(have) })}</span>
              </div>
              <NumberField id="dismiss-amount" autoComplete="off" range={{ min: 1, max: have }} blank value={amount} onChange={setAmount} />
            </div>
            {count > 0 && refundInfo}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>
                {t('common:actions.cancel')}
              </Button>
              <Button type="submit" disabled={count <= 0}>
                {t('dismiss.next')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={unitId != null && sure}
        onOpenChange={(o) => !o && setSure(false)}
        title={t(fortKey ? 'dismiss.sureForts' : 'dismiss.sureTroops', { n: fmtExact(count), unit: troopName(id) })}
        description={t('dismiss.sureInfo')}
        confirmLabel={t(fortKey ? 'dismiss.destroy' : 'dismiss.dismiss', { n: fmtExact(count) })}
        cancelLabel={t('common:actions.back')}
        disabled={count <= 0}
        onConfirm={() => (fortKey ? destroy : disband).mutateAsync({ path, body: { troopId: id, count } }).then(close)}
      >
        {refundInfo}
      </ConfirmDialog>
    </>
  );
}
