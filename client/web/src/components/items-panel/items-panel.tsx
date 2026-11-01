import { X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { type CityBean, getCitiesByCityIdQueryKey, getPlayerQueryKey, postCitiesShopGoldMutation, postPlayerItemsUseMutation } from '@marchlands/api-client';
import { ITEM_CATEGORY_IDS, ITEM_INFO } from '@marchlands/core';

import { ActiveEffects } from '@/components/active-effects/active-effects';
import { ItemIcon } from '@/components/item-icon/item-icon';
import { ActiveBonus } from '@/components/items-panel/active-bonus/active-bonus';
import { ALL } from '@/components/items-panel/constants';
import { MedalSourcesInfo } from '@/components/items-panel/medal-sources-info/medal-sources-info';
import type { Entry } from '@/components/items-panel/types';
import { describeGrant, goldPriceOf, medalLevelOf } from '@/components/items-panel/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCommand, usePlayer } from '@/hooks/use-game';
import { fmt, fmtExact } from '@/lib/format';
import { itemCategoryName, itemName } from '@/lib/game-data';
import { translateMessage } from '@/lib/messages';
import { cn } from '@/lib/utils';

export function ItemsPanel({ city }: { city: CityBean }) {
  const { t } = useTranslation(['items-panel', 'common']);
  const player = usePlayer();
  const [category, setCategory] = useState(ALL);
  const [query, setQuery] = useState('');
  const [ownedOnly, setOwnedOnly] = useState(false);
  // set by an inactive Active effects slot: only the items that give that bonus
  const [effectFilter, setEffectFilter] = useState<{ label: string; ids: string[] } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const counts = useMemo(() => new Map((player.data?.items ?? []).map((i) => [i.id, i.count])), [player.data?.items]);

  const entries = useMemo(() => {
    const byKey = new Map<string, Entry>();
    for (const info of ITEM_INFO) {
      const key = `${itemName(info.id)}|${JSON.stringify(info.description)}`;
      const e = byKey.get(key) ?? { info, ids: [], owned: 0 };
      e.ids.push(info.id);
      e.owned += counts.get(info.id) ?? 0;
      byKey.set(key, e);
    }
    return [...byKey.values()];
  }, [counts]);

  const q = query.trim().toLowerCase();
  const nameOf = (e: Entry) => itemName(e.info.id);
  const shown = entries
    .filter((e) => !effectFilter || e.ids.some((id) => effectFilter.ids.includes(id)))
    .filter((e) => category === ALL || String(e.info.category) === category)
    .filter((e) => !ownedOnly || e.owned > 0)
    .filter((e) => !q || nameOf(e).toLowerCase().includes(q) || translateMessage(e.info.description).toLowerCase().includes(q))
    // alphabetical only, so buying or using an item never moves it
    .sort((a, b) => nameOf(a).localeCompare(nameOf(b)))
    .map((e) => ({ ...e, gold: goldPriceOf(e), medalLevel: medalLevelOf(e.ids) }));
  const ownedTotal = entries.filter((e) => e.owned > 0).length;
  const buffs = player.data?.buffs ?? [];

  const refresh = () => [getPlayerQueryKey(), getCitiesByCityIdQueryKey({ path: { cityId: city.id } })];
  const use = useCommand(postPlayerItemsUseMutation(), refresh);
  const buyGold = useCommand(postCitiesShopGoldMutation(), refresh);
  function applyEntry(e: Entry) {
    const id = e.ids.find((x) => (counts.get(x) ?? 0) > 0);
    if (!id) return;
    use.mutate(
      { path: { itemId: id }, body: { cityId: city.id } },
      {
        onSuccess: (r) => {
          if (r.granted) toast.success(t('received', { item: nameOf(e), grant: describeGrant(r.granted) }));
          else if (r.hero) toast.success(t('heroJoined', { hero: r.hero.name, level: r.hero.level }));
          else toast.success(t('used', { item: nameOf(e) }));
        },
      },
    );
  }

  return (
    <div className="grid gap-4">
      <ActiveEffects
        city={city}
        buffs={buffs}
        counts={counts}
        onFind={(label, ids) => {
          setEffectFilter({ label, ids });
          setCategory(ALL);
          setQuery('');
          setOwnedOnly(false);
          listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
      />
      <div ref={listRef} className="flex min-w-0 scroll-mt-4 flex-wrap items-center gap-3">
        <Tabs value={category} onValueChange={setCategory} className="max-w-full min-w-0">
          <TabsList className="max-w-full justify-start overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsTrigger value={ALL}>{t('common:actions.all')}</TabsTrigger>
            {ITEM_CATEGORY_IDS.map((c) => (
              <TabsTrigger key={c} value={String(c)}>
                {itemCategoryName(c)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Input className="h-8 min-w-0 flex-1 sm:w-48 sm:flex-none" placeholder={t('search')} value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="flex items-center gap-2">
          <Switch id="owned-only" checked={ownedOnly} onCheckedChange={setOwnedOnly} />
          <Label htmlFor="owned-only" className="text-sm font-normal">
            {t('ownedOnly', { n: ownedTotal })}
          </Label>
        </div>
        {effectFilter && (
          <Badge variant="secondary" className="gap-1">
            {t('itemsFor', { label: effectFilter.label })}
            <button type="button" className="-mr-1 rounded-sm opacity-70 hover:opacity-100" aria-label={t('showAll')} onClick={() => setEffectFilter(null)}>
              <X className="size-3" />
            </button>
          </Badge>
        )}
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {shown.map((e) => (
          <div key={e.ids[0]} className="flex gap-3 rounded-md border bg-card p-3">
            <ItemIcon id={e.info.id} size={64} className={cn('size-8 sm:size-16', e.owned === 0 && 'opacity-60')} />
            <div className="grid min-w-0 flex-1 gap-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {/* items not owned are dimmed, but never their buttons (a Buy button must not look disabled) or the active bonus */}
                  <div className={cn('flex flex-wrap items-center gap-2', e.owned === 0 && 'opacity-60')}>
                    <span className="font-medium">{nameOf(e)}</span>
                    <Badge variant={e.owned > 0 ? 'default' : 'outline'} className="tabular-nums">
                      ×{fmtExact(e.owned)}
                    </Badge>
                    {category === ALL && <span className="text-xs text-muted-foreground">{itemCategoryName(e.info.category)}</span>}
                  </div>
                  <ActiveBonus ids={e.ids} buffs={player.data?.buffs ?? []} />
                </div>
                <div className="flex shrink-0 gap-1">
                  {e.gold && (
                    <Button
                      size="xs"
                      variant={e.owned === 0 ? 'default' : 'outline'}
                      disabled={city.resource.gold < e.gold.price || buyGold.isPending}
                      title={
                        city.resource.gold < e.gold.price
                          ? t('notEnoughGold', { city: city.name, price: fmtExact(e.gold.price) })
                          : t('buyWithGold', { city: city.name })
                      }
                      onClick={() =>
                        e.gold &&
                        buyGold.mutate(
                          { path: { cityId: city.id }, body: { itemId: e.gold.id, amount: 1 } },
                          { onSuccess: () => toast.success(t('bought', { item: nameOf(e) })) },
                        )
                      }
                    >
                      {t('buyFor', { price: fmt(e.gold.price) })}
                    </Button>
                  )}
                  {e.info.use === 'direct' && (
                    <Button size="xs" disabled={e.owned === 0 || use.isPending} onClick={() => applyEntry(e)}>
                      {t('common:actions.use')}
                    </Button>
                  )}
                </div>
              </div>
              <div className={cn('grid gap-1.5', e.owned === 0 && 'opacity-60')}>
                <p className="text-sm text-muted-foreground">{translateMessage(e.info.description)}</p>
                {e.info.howTo && <p className="text-xs text-muted-foreground italic">{translateMessage(e.info.howTo)}</p>}
                {e.medalLevel != null && <MedalSourcesInfo level={e.medalLevel} />}
              </div>
            </div>
          </div>
        ))}
        {shown.length === 0 && <p className="text-sm text-muted-foreground">{t('noMatch')}</p>}
      </div>
    </div>
  );
}
