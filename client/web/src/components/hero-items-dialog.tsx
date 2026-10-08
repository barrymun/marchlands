import type { HeroBean } from '@marchlands/api-client';
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
import { Button } from '@/components/ui/button';
import { useSticky } from '@/hooks/use-sticky';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { qk, useCity, useCommand } from '@/hooks/use-game';
import { useInventory } from '@/hooks/use-inventory';
import { api, unwrap } from '@/lib/api';
import { duration, fmt, fmtExact } from '@/lib/format';

const ATTR_LABEL = { power: 'Attack', management: 'Politics', stratagem: 'Intelligence' } as const;

export function HeroItemsDialog({ hero, cityId, onClose }: { hero: HeroBean | null; cityId: number; onClose: () => void }) {
  const shown = useSticky(hero);
  return (
    <Dialog open={hero != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">{shown && <HeroItems hero={shown} cityId={cityId} />}</DialogContent>
    </Dialog>
  );
}

function HeroItems({ hero, cityId }: { hero: HeroBean; cityId: number }) {
  const inv = useInventory();
  const city = useCity(cityId);
  const gold = city.data?.resource.gold ?? 0;
  const use = useCommand(
    (itemId: string) => unwrap(api.POST('/api/v1/heroes/{heroId}/items', { params: { path: { heroId: hero.id } }, body: { itemId } })),
    () => [qk.city(cityId), qk.player],
    'Item used',
  );
  const buy = useCommand(
    (itemId: string) => unwrap(api.POST('/api/v1/heroes/{heroId}/items', { params: { path: { heroId: hero.id } }, body: { itemId, payWith: 'gold' } })),
    () => [qk.city(cityId), qk.player],
    'Bought with gold and used',
  );
  const row = (itemId: string, effect: string, disabledReason?: string) => {
    const owned = inv.count(itemId);
    const price = heroItemGoldPrice(itemId, hero.upgradeExp);
    return (
      <div key={itemId} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
        <div>
          <div className="font-medium">
            {itemConfig(itemId)?.name} <span className="font-normal text-muted-foreground">×{owned}</span>
          </div>
          <div className="text-xs text-muted-foreground">{disabledReason ?? effect}</div>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          {owned > 0 && (
            <Button size="xs" disabled={!!disabledReason || use.isPending} onClick={() => use.mutate(itemId)}>
              Use
            </Button>
          )}
          {price != null && (
            <Button
              size="xs"
              variant={owned > 0 ? 'outline' : 'default'}
              disabled={gold < price || !!disabledReason || buy.isPending}
              title={gold < price ? `Not enough gold in this city (${fmtExact(price)} needed)` : undefined}
              onClick={() => buy.mutate(itemId)}
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
  const buffed = (attr: keyof typeof ATTR_LABEL) => hero[`${attr}BuffAdded` as const] > 0;

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
          {Object.entries(HERO_ATTRIBUTE_ITEMS).map(([id, attr]) =>
            row(
              id,
              `${ATTR_LABEL[attr]} +${HERO_ATTRIBUTE_BUFF.bonus * 100}% (+${heroBuffAmount(heroBuffBase(hero, attr))}, gear included) for 24 hours`,
              buffed(attr)
                ? `${ATTR_LABEL[attr]} boost active, ${duration(Math.max(0, (hero.buffs.find((b) => b.id === attr)?.endTime ?? 0) - Date.now()))} left (using again restarts it)`
                : undefined,
            ),
          )}
        </section>
        <section className="grid gap-1.5">
          <h3 className="text-sm font-medium">Loyalty medals</h3>
          {Object.entries(LOYALTY_MEDALS).map(([id, n]) => row(id, `+${n} loyalty (max 100)`, hero.loyalty >= 100 ? 'Loyalty is already 100' : undefined))}
        </section>
      </div>
    </>
  );
}
