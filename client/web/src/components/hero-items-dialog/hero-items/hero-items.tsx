import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { getCitiesByCityIdQueryKey, getPlayerQueryKey, type HeroBean, postHeroesItemsMutation } from '@marchlands/api-client';
import { BALANCE, experienceItemGain, HERO_ATTRIBUTE_ITEMS, heroAtMaxLevel, heroBuffAmount, heroBuffBase, heroItemGoldPrice } from '@marchlands/core';

import { Countdown } from '@/components/countdown/countdown';
import { ATTR_LABEL } from '@/components/hero-items-dialog/hero-items/constants';
import { experienceItems, isLoyaltyFull, loyaltyMedals } from '@/components/hero-items-dialog/hero-items/utils';
import { ItemIcon } from '@/components/item-icon/item-icon';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCity, useCommand } from '@/hooks/use-game';
import { useInventory } from '@/hooks/use-inventory';
import { useNow } from '@/hooks/use-now';
import { fmt, fmtExact, percent, period } from '@/lib/format';
import { itemName } from '@/lib/game-data';
import { ATTRIBUTE_BORDER, dominantAttribute } from '@/lib/hero-attributes';
import { ITEM_BONUS_TEXT } from '@/lib/tones';
import { cn } from '@/lib/utils';

export function HeroItems({ hero, cityId }: { hero: HeroBean; cityId: number }) {
  const { t } = useTranslation(['hero-items-dialog', 'common']);
  const now = useNow();
  const inv = useInventory();
  const city = useCity(cityId);
  const gold = city.data?.resource.gold ?? 0;
  const refresh = () => [getCitiesByCityIdQueryKey({ path: { cityId } }), getPlayerQueryKey()];
  const use = useCommand(postHeroesItemsMutation(), refresh, t('toast.used'));
  const buy = useCommand(postHeroesItemsMutation(), refresh, t('toast.bought'));
  const row = (itemId: string, effect: ReactNode, disabledReason?: string, extra: { className?: string; badge?: ReactNode } = {}) => {
    const owned = inv.count(itemId);
    const price = heroItemGoldPrice(itemId, hero.upgradeExp);
    return (
      <div key={itemId} className={cn('flex items-center gap-2 rounded-md border p-2 text-sm', extra.className)}>
        <ItemIcon id={itemId} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 font-medium">
            {itemName(itemId)} <span className="font-normal text-muted-foreground">×{owned}</span>
            {extra.badge}
          </div>
          <div className="text-xs text-muted-foreground">{disabledReason ?? effect}</div>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          {owned > 0 && (
            <Button size="xs" disabled={!!disabledReason || use.isPending} onClick={() => use.mutate({ path: { heroId: hero.id }, body: { itemId } })}>
              {t('common:actions.use')}
            </Button>
          )}
          {price != null && (
            <Button
              size="xs"
              variant={owned > 0 ? 'outline' : 'default'}
              disabled={gold < price || !!disabledReason || buy.isPending}
              title={gold < price ? t('notEnoughGold', { gold: fmtExact(price) }) : undefined}
              onClick={() => buy.mutate({ path: { heroId: hero.id }, body: { itemId, payWith: 'gold' } })}
            >
              {t('common:gold', { gold: fmt(price) })}
            </Button>
          )}
          {owned <= 0 && price == null && (
            <Button size="xs" variant="outline" disabled>
              {t('common:actions.none')}
            </Button>
          )}
        </div>
      </div>
    );
  };
  const buffEnd = (attr: keyof typeof ATTR_LABEL) => hero.buffs.find((b) => b.id === attr && b.endTime > now)?.endTime;
  // the boost that suits this hero best: the one for its strongest attribute
  const best = dominantAttribute(hero);

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {t('title', { name: hero.name })} <span className="font-normal text-muted-foreground">{t('common:level.short', { level: hero.level })}</span>
        </DialogTitle>
        <DialogDescription>
          {t('summary', {
            progress: heroAtMaxLevel(hero) ? t('maxLevel') : t('experienceProgress', { exp: fmtExact(hero.experience), needed: fmtExact(hero.upgradeExp) }),
            loyalty: hero.loyalty,
            gold: fmtExact(gold),
          })}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <section className="grid gap-1.5">
          <h3 className="text-sm font-medium">{t('experience.title')}</h3>
          {experienceItems().map((id) =>
            row(
              id,
              t('experience.gain', { amount: fmtExact(experienceItemGain(id, hero.upgradeExp)) }),
              heroAtMaxLevel(hero) ? t('experience.atMax', { level: BALANCE.heroMaxLevel }) : undefined,
            ),
          )}
        </section>
        <section className="grid gap-1.5">
          <h3 className="text-sm font-medium">{t('boosts.title')}</h3>
          {Object.entries(HERO_ATTRIBUTE_ITEMS).map(([id, attr]) => {
            const end = buffEnd(attr);
            const suits = best.stat === attr;
            return row(
              id,
              <>
                {t('boosts.effect', {
                  label: ATTR_LABEL[attr],
                  bonus: percent(BALANCE.items.heroAttributeBuff.bonus),
                  period: period(BALANCE.items.heroAttributeBuff.durationMs),
                  amount: heroBuffAmount(heroBuffBase(hero, attr)),
                })}
                {end && (
                  <span className={cn('block', ITEM_BONUS_TEXT)}>
                    <Trans
                      t={t}
                      i18nKey="boosts.active"
                      values={{ period: period(BALANCE.items.heroAttributeBuff.durationMs) }}
                      components={{ countdown: <Countdown endTime={end} /> }}
                    />
                  </span>
                )}
              </>,
              undefined,
              suits
                ? {
                    className: ATTRIBUTE_BORDER[best.key],
                    badge: <span className={cn('rounded px-1.5 py-px text-[11px] font-normal', best.tone)}>{t('boosts.best')}</span>,
                  }
                : {},
            );
          })}
        </section>
        <section className="grid gap-1.5">
          <h3 className="text-sm font-medium">{t('loyalty.title')}</h3>
          {loyaltyMedals().map(({ id, loyalty }) =>
            row(id, t('loyalty.gain', { amount: loyalty }), isLoyaltyFull(hero.loyalty) ? t('loyalty.full') : undefined),
          )}
        </section>
      </div>
    </>
  );
}
