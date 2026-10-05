import type { HeroBean } from '@evony/api-client';
import { experienceItemGain, HERO_ATTRIBUTE_BUFF, HERO_ATTRIBUTE_ITEMS, itemConfig, LOYALTY_MEDALS } from '@evony/core';
import { Button } from '@/components/ui/button';
import { useSticky } from '@/hooks/use-sticky';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { qk, useCommand } from '@/hooks/use-game';
import { useInventory } from '@/hooks/use-inventory';
import { api, unwrap } from '@/lib/api';
import { fmtExact } from '@/lib/format';

const ATTR_LABEL = { power: 'Attack', management: 'Politics', stratagem: 'Intelligence' } as const;
/** Cents charged when the item is not owned (medals cannot be bought on use). */
const CENTS: Record<string, number> = { 'player.experience.1.a': 8, 'player.experience.1.b': 30, 'player.experience.1.c': 100, 'hero.power.1': 40, 'hero.management.1': 40, 'hero.intelligence.1': 40 };

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
  const use = useCommand(
    (itemId: string) => unwrap(api.POST('/api/v1/heroes/{heroId}/items', { params: { path: { heroId: hero.id } }, body: { itemId } })),
    () => [qk.city(cityId), qk.player],
    'Item used',
  );
  const row = (itemId: string, effect: string, disabledReason?: string) => {
    const owned = inv.count(itemId);
    const cents = CENTS[itemId];
    const affordable = owned > 0 || (cents != null && inv.cents >= cents);
    return (
      <div key={itemId} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
        <div>
          <div className="font-medium">
            {itemConfig(itemId)?.name} <span className="font-normal text-muted-foreground">×{owned}</span>
          </div>
          <div className="text-xs text-muted-foreground">{disabledReason ?? effect}</div>
        </div>
        <Button size="xs" variant={owned > 0 ? 'default' : 'outline'} disabled={!affordable || !!disabledReason || use.isPending} onClick={() => use.mutate(itemId)}>
          {owned > 0 ? 'Use' : cents != null ? `${cents} cents` : 'None'}
        </Button>
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
          Experience {fmtExact(hero.experience)} / {fmtExact(hero.upgradeExp)} · loyalty {hero.loyalty} · {fmtExact(inv.cents)} cents
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <section className="grid gap-1.5">
          <h3 className="text-sm font-medium">Experience</h3>
          {['player.experience.1.a', 'player.experience.1.b', 'player.experience.1.c'].map((id) => row(id, `+${fmtExact(experienceItemGain(id, hero.upgradeExp))} experience`))}
        </section>
        <section className="grid gap-1.5">
          <h3 className="text-sm font-medium">Attribute boosts</h3>
          {Object.entries(HERO_ATTRIBUTE_ITEMS).map(([id, attr]) =>
            row(
              id,
              `${ATTR_LABEL[attr]} +${HERO_ATTRIBUTE_BUFF.bonus * 100}% (+${Math.ceil(hero[attr] * HERO_ATTRIBUTE_BUFF.bonus)}) for 24 hours`,
              buffed(attr) ? `${ATTR_LABEL[attr]} boost already active (using again restarts it)` : undefined,
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
