import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import type { HeroBean } from '@marchlands/api-client';
import { HeroStatus, heroManagement, itemGoldPrice, mayorProductionBonus } from '@marchlands/core';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { qk, useCommand, usePlayer } from '@/hooks/use-game';
import { api, unwrap } from '@/lib/api';
import { fmt, signedRate } from '@/lib/format';
import { HOLY_WATER, STATS } from '@/components/hero-points-dialog/points-form/constants';
import type { StatKey } from '@/components/hero-points-dialog/points-form/types';

export function PointsForm({ hero, cityId, fieldOutput, onDone }: { hero: HeroBean; cityId: number; fieldOutput: number; onDone: () => void }) {
  const player = usePlayer();
  const [add, setAdd] = useState<Record<StatKey, number>>({ management: 0, power: 0, stratagem: 0 });
  const spent = add.management + add.power + add.stratagem;
  const left = hero.remainPoint - spent;
  const refresh = () => [qk.city(cityId), qk.player];
  const assign = useCommand(
    () =>
      unwrap(
        api.POST('/api/v1/heroes/{heroId}/points', {
          params: { path: { heroId: hero.id } },
          body: { power: hero.power + add.power, management: hero.management + add.management, stratagem: hero.stratagem + add.stratagem },
        }),
      ),
    refresh,
    'Points assigned',
  );
  const reset = useCommand(() => unwrap(api.POST('/api/v1/heroes/{heroId}/reset', { params: { path: { heroId: hero.id } } })), refresh, 'Points reset');

  const holyWater = player.data?.items.find((i) => i.id === HOLY_WATER)?.count ?? 0;
  // without Holy Water, one is bought with the hero's city gold
  const resetGold = itemGoldPrice(HOLY_WATER) ?? 0;
  const cityGold = player.data?.castles.find((c) => c.id === cityId)?.resource.gold ?? 0;
  const canReset = holyWater > 0 || cityGold >= resetGold;
  const assigned = hero.level - hero.remainPoint;
  const isMayor = hero.status === HeroStatus.MAYOR;
  // change in the mayor's production bonus from the added politics (soft-capped: BALANCE.heroSoftCap)
  const bonusGain = (added: number) => mayorProductionBonus(heroManagement(hero) + added) - mayorProductionBonus(heroManagement(hero));
  const mayorGain = (added: number) => Math.round(fieldOutput * bonusGain(added));
  const total = (k: StatKey) => {
    const s = STATS.find((x) => x.key === k)!;
    return hero[k] + hero[s.added] + hero[s.buff];
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {hero.name} <span className="font-normal text-muted-foreground">Lv {hero.level}</span>
        </DialogTitle>
        <DialogDescription>
          {left} of {hero.remainPoint} points left to assign. Heroes gain one point per level.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-3">
        {STATS.map((s) => (
          <div key={s.key} className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">{s.label}</div>
              <div className="text-xs text-muted-foreground">{s.hint}</div>
            </div>
            <div className="flex items-center gap-2 tabular-nums">
              <Button
                size="icon-xs"
                variant="outline"
                disabled={add[s.key] === 0}
                onClick={() => setAdd({ ...add, [s.key]: add[s.key] - 1 })}
                aria-label={`Remove ${s.label}`}
              >
                <Minus />
              </Button>
              <span className="w-16 text-center text-sm">
                {total(s.key) + add[s.key]}
                {add[s.key] > 0 && <span className="text-emerald-600 dark:text-emerald-400"> +{add[s.key]}</span>}
              </span>
              <Button
                size="icon-xs"
                variant="outline"
                disabled={left === 0}
                onClick={() => setAdd({ ...add, [s.key]: add[s.key] + 1 })}
                aria-label={`Add ${s.label}`}
              >
                <Plus />
              </Button>
              <Button size="xs" variant="ghost" disabled={left === 0} onClick={() => setAdd({ ...add, [s.key]: add[s.key] + left })}>
                All
              </Button>
            </div>
          </div>
        ))}
        {isMayor && add.management > 0 && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            As mayor: {signedRate(mayorGain(add.management))} production (+{Math.round(bonusGain(add.management) * 100)}%)
          </p>
        )}
        <Separator />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            Reset all {assigned} assigned points · {holyWater > 0 ? `uses 1 Holy Water (${holyWater} owned)` : `${fmt(resetGold)} gold for a Holy Water`}
          </span>
          <Button size="xs" variant="outline" disabled={!canReset || assigned === 0 || reset.isPending} onClick={() => reset.mutate(undefined)}>
            Reset
          </Button>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button disabled={spent === 0 || assign.isPending} onClick={() => assign.mutate(undefined, { onSuccess: onDone })}>
          Assign {spent > 0 ? spent : ''} point{spent === 1 ? '' : 's'}
        </Button>
      </DialogFooter>
    </>
  );
}
