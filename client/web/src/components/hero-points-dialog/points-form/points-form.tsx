import { Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getCitiesByCityIdQueryKey, getPlayerQueryKey, type HeroBean, postHeroesPointsMutation, postHeroesResetMutation } from '@marchlands/api-client';
import { heroManagement, HeroStatus, itemGoldPrice, mayorProductionBonus } from '@marchlands/core';

import { HeroLevel } from '@/components/hero-level/hero-level';
import { HOLY_WATER, STATS } from '@/components/hero-points-dialog/points-form/constants';
import type { StatKey } from '@/components/hero-points-dialog/points-form/types';
import { SpendGoldButton } from '@/components/spend-gold-button/spend-gold-button';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useCommand, usePlayer } from '@/hooks/use-game';
import { fmt, percent, signedRate } from '@/lib/format';
import { GAIN_TEXT } from '@/lib/tones';
import { cn } from '@/lib/utils';

export function PointsForm({ hero, cityId, fieldOutput, onDone }: { hero: HeroBean; cityId: number; fieldOutput: number; onDone: () => void }) {
  const { t } = useTranslation(['hero-points-dialog', 'common']);
  const player = usePlayer();
  const [add, setAdd] = useState<Record<StatKey, number>>({ management: 0, power: 0, stratagem: 0 });
  const spent = add.management + add.power + add.stratagem;
  const left = hero.remainPoint - spent;
  const refresh = () => [getCitiesByCityIdQueryKey({ path: { cityId } }), getPlayerQueryKey()];
  const assign = useCommand(postHeroesPointsMutation(), refresh, t('toast.assigned'));
  const reset = useCommand(postHeroesResetMutation(), refresh, t('toast.reset'));

  const holyWater = player.data?.items.find((i) => i.id === HOLY_WATER)?.count ?? 0;
  // without Holy Water, one is bought with the hero's city gold
  const resetGold = itemGoldPrice(HOLY_WATER) ?? 0;
  const payer = player.data?.castles.find((c) => c.id === cityId);
  const cityGold = payer?.resource.gold ?? 0;
  const canReset = holyWater > 0 || cityGold >= resetGold;
  const assigned = hero.level - hero.remainPoint;
  const isMayor = hero.status === HeroStatus.MAYOR;
  // change in the mayor's production bonus from the added politics (soft-capped: BALANCE.heroSoftCap)
  const bonusGain = (added: number) => mayorProductionBonus(heroManagement(hero) + added) - mayorProductionBonus(heroManagement(hero));
  const mayorGain = (added: number) => Math.round(fieldOutput * bonusGain(added));
  const total = (k: StatKey) => {
    const s = STATS.find((x) => x.key === k); // StatKey is one of STATS' keys
    return s ? hero[k] + hero[s.added] + hero[s.buff] : hero[k];
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {hero.name} <HeroLevel level={hero.level} />
        </DialogTitle>
        <DialogDescription>{t('pointsLeft', { left, count: hero.remainPoint })}</DialogDescription>
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
                aria-label={t('remove', { label: s.label })}
              >
                <Minus />
              </Button>
              <span className="w-16 text-center text-sm">
                {total(s.key) + add[s.key]}
                {add[s.key] > 0 && <span className={GAIN_TEXT}> +{add[s.key]}</span>}
              </span>
              <Button
                size="icon-xs"
                variant="outline"
                disabled={left === 0}
                onClick={() => setAdd({ ...add, [s.key]: add[s.key] + 1 })}
                aria-label={t('add', { label: s.label })}
              >
                <Plus />
              </Button>
              <Button size="xs" variant="ghost" disabled={left === 0} onClick={() => setAdd({ ...add, [s.key]: add[s.key] + left })}>
                {t('common:actions.all')}
              </Button>
            </div>
          </div>
        ))}
        {isMayor && add.management > 0 && (
          <p className={cn('text-xs', GAIN_TEXT)}>{t('asMayor', { rate: signedRate(mayorGain(add.management)), pct: percent(bonusGain(add.management)) })}</p>
        )}
        <Separator />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {t('resetInfo', {
              count: assigned,
              cost: holyWater > 0 ? t('usesHolyWater', { owned: holyWater }) : t('holyWaterGold', { gold: fmt(resetGold) }),
            })}
          </span>
          <SpendGoldButton
            size="xs"
            variant="outline"
            cost={holyWater > 0 ? 0 : resetGold}
            city={payer ?? { name: '', resource: { gold: cityGold } }}
            disabled={!canReset || assigned === 0 || reset.isPending}
            onSpend={() => reset.mutate({ path: { heroId: hero.id } })}
          >
            {t('reset')}
          </SpendGoldButton>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          {t('common:actions.cancel')}
        </Button>
        <Button
          disabled={spent === 0 || assign.isPending}
          onClick={() =>
            assign.mutate(
              {
                path: { heroId: hero.id },
                body: { power: hero.power + add.power, management: hero.management + add.management, stratagem: hero.stratagem + add.stratagem },
              },
              { onSuccess: onDone },
            )
          }
        >
          {spent > 0 ? t('assign', { count: spent }) : t('assignNone')}
        </Button>
      </DialogFooter>
    </>
  );
}
