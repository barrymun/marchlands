import type { ReactNode } from 'react';
import { getCitiesByCityIdQueryKey, getPlayerQueryKey, postHeroesItemsMutation, type HeroBean } from '@marchlands/api-client';
import {
  BALANCE,
  experienceItemGain,
  HERO_ATTRIBUTE_BUFF,
  HERO_ATTRIBUTE_ITEMS,
  heroAtMaxLevel,
  heroBuffAmount,
  heroBuffBase,
  heroItemGoldPrice,
  itemConfig,
  LOYALTY_MEDALS,
} from '@marchlands/core';
import { Countdown } from '@/components/countdown/countdown';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCity, useCommand } from '@/hooks/use-game';
import { useInventory } from '@/hooks/use-inventory';
import { fmt, fmtExact } from '@/lib/format';
import { ATTRIBUTE_BORDER, dominantAttribute } from '@/lib/hero-attributes';
import { ITEM_BONUS_TEXT } from '@/lib/tones';
import { cn } from '@/lib/utils';
import { ATTR_LABEL } from '@/components/hero-items-dialog/hero-items/constants';
import { useNow } from '@/hooks/use-now';

export function HeroItems({ hero, cityId }: { hero: HeroBean; cityId: number }) {
  const now = useNow();
  const inv = useInventory();
  const city = useCity(cityId);
  const gold = city.data?.resource.gold ?? 0;
  const refresh = () => [getCitiesByCityIdQueryKey({ path: { cityId } }), getPlayerQueryKey()];
  const use = useCommand(postHeroesItemsMutation(), refresh, 'Item used');
  const buy = useCommand(postHeroesItemsMutation(), refresh, 'Bought with gold and used');
  const row = (itemId: string, effect: ReactNode, disabledReason?: string, extra: { className?: string; badge?: ReactNode } = {}) => {
    const owned = inv.count(itemId);
    const price = heroItemGoldPrice(itemId, hero.upgradeExp);
    return (
      <div key={itemId} className={cn('flex items-center justify-between gap-2 rounded-md border p-2 text-sm', extra.className)}>
        <div>
          <div className="flex flex-wrap items-center gap-1.5 font-medium">
            {itemConfig(itemId)?.name} <span className="font-normal text-muted-foreground">×{owned}</span>
            {extra.badge}
          </div>
          <div className="text-xs text-muted-foreground">{disabledReason ?? effect}</div>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          {owned > 0 && (
            <Button size="xs" disabled={!!disabledReason || use.isPending} onClick={() => use.mutate({ path: { heroId: hero.id }, body: { itemId } })}>
              Use
            </Button>
          )}
          {price != null && (
            <Button
              size="xs"
              variant={owned > 0 ? 'outline' : 'default'}
              disabled={gold < price || !!disabledReason || buy.isPending}
              title={gold < price ? `Not enough gold in this city (${fmtExact(price)} needed)` : undefined}
              onClick={() => buy.mutate({ path: { heroId: hero.id }, body: { itemId, payWith: 'gold' } })}
            >
              {fmt(price)} gold
            </Button>
          )}
          {owned <= 0 && price == null && (
            <Button size="xs" variant="outline" disabled>
              None
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
          Items for {hero.name} <span className="font-normal text-muted-foreground">Lv {hero.level}</span>
        </DialogTitle>
        <DialogDescription>
          {heroAtMaxLevel(hero) ? 'Max level' : `Experience ${fmtExact(hero.experience)} / ${fmtExact(hero.upgradeExp)}`} · loyalty {hero.loyalty} ·{' '}
          {fmtExact(gold)} gold in this city
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <section className="grid gap-1.5">
          <h3 className="text-sm font-medium">Experience</h3>
          {['player.experience.1.a', 'player.experience.1.b', 'player.experience.1.c'].map((id) =>
            row(
              id,
              `+${fmtExact(experienceItemGain(id, hero.upgradeExp))} experience`,
              heroAtMaxLevel(hero) ? `Level ${BALANCE.heroMaxLevel} is the maximum: no more experience` : undefined,
            ),
          )}
        </section>
        <section className="grid gap-1.5">
          <h3 className="text-sm font-medium">Attribute boosts</h3>
          {Object.entries(HERO_ATTRIBUTE_ITEMS).map(([id, attr]) => {
            const end = buffEnd(attr);
            const suits = best.stat === attr;
            return row(
              id,
              <>
                {ATTR_LABEL[attr]} +{HERO_ATTRIBUTE_BUFF.bonus * 100}% (+{heroBuffAmount(heroBuffBase(hero, attr))}, gear included) for 24 hours
                {end && (
                  <span className={cn('block', ITEM_BONUS_TEXT)}>
                    Active, <Countdown endTime={end} /> left; using another adds 24 hours
                  </span>
                )}
              </>,
              undefined,
              suits
                ? {
                    className: ATTRIBUTE_BORDER[best.key],
                    badge: <span className={cn('rounded px-1.5 py-px text-[11px] font-normal', best.tone)}>Best for this hero</span>,
                  }
                : {},
            );
          })}
        </section>
        <section className="grid gap-1.5">
          <h3 className="text-sm font-medium">Loyalty medals</h3>
          {Object.entries(LOYALTY_MEDALS).map(([id, n]) => row(id, `+${n} loyalty (max 100)`, hero.loyalty >= 100 ? 'Loyalty is already 100' : undefined))}
        </section>
      </div>
    </>
  );
}
