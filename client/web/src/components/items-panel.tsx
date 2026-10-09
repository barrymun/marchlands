import { useMemo, useRef, useState } from 'react';
import type { CityBean } from '@marchlands/api-client';
import {
  ITEM_CATEGORIES,
  ITEM_INFO,
  itemConfig,
  itemEffect,
  itemGoldPrice,
  medalSources,
  TROOP_ID_BY_KEY,
  TROOP_NAMES,
  type ItemInfo,
  type TroopKey,
} from '@marchlands/core';
import { Medal, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ActiveEffects } from '@/components/active-effects';
import { Countdown } from '@/components/countdown';
import { qk, useCommand, usePlayer } from '@/hooks/use-game';
import { useNow } from '@/hooks/use-now';
import { api, unwrap } from '@/lib/api';
import { fmt, fmtExact } from '@/lib/format';
import { ITEM_BONUS_TONE } from '@/lib/tones';
import { cn } from '@/lib/utils';

/** Gold price of an entry when one of its items is for sale (itemGoldPrice: there are no cents). */
function goldPriceOf(e: { ids: string[] }): { id: string; price: number } | null {
  const id = e.ids.find((x) => itemGoldPrice(x) != null);
  return id ? { id, price: itemGoldPrice(id)! } : null;
}

/** Items with the same name and effect are shown as one entry. */
interface Entry {
  info: ItemInfo;
  ids: string[];
  owned: number;
}

const ALL = 'All';

export function ItemsPanel({ city }: { city: CityBean }) {
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
      const key = `${info.name}|${info.description}`;
      const e = byKey.get(key) ?? { info, ids: [], owned: 0 };
      e.ids.push(info.id);
      e.owned += counts.get(info.id) ?? 0;
      byKey.set(key, e);
    }
    return [...byKey.values()];
  }, [counts]);

  const q = query.trim().toLowerCase();
  const shown = entries
    .filter((e) => !effectFilter || e.ids.some((id) => effectFilter.ids.includes(id)))
    .filter((e) => category === ALL || e.info.category === category)
    .filter((e) => !ownedOnly || e.owned > 0)
    .filter((e) => !q || e.info.name.toLowerCase().includes(q) || e.info.description.toLowerCase().includes(q))
    // alphabetical only, so buying or using an item never moves it
    .sort((a, b) => a.info.name.localeCompare(b.info.name));
  const ownedTotal = entries.filter((e) => e.owned > 0).length;
  const buffs = player.data?.buffs ?? [];

  const use = useCommand(
    (itemId: string) => unwrap(api.POST('/api/v1/player/items/{itemId}/use', { params: { path: { itemId } }, body: { cityId: city.id } })),
    () => [qk.player, qk.city(city.id)],
  );
  const buyGold = useCommand(
    (itemId: string) => unwrap(api.POST('/api/v1/cities/{cityId}/shop/gold', { params: { path: { cityId: city.id } }, body: { itemId, amount: 1 } })),
    () => [qk.player, qk.city(city.id)],
  );
  function useEntry(e: Entry) {
    const id = e.ids.find((x) => (counts.get(x) ?? 0) > 0);
    if (!id) return;
    use.mutate(id, {
      onSuccess: (r) => {
        if (r.granted) toast.success(`${e.info.name}: received ${describeGrant(r.granted)}`);
        else if (r.hero) toast.success(`${r.hero.name} (Lv ${r.hero.level}) joined your city`);
        else toast.success(`${e.info.name} used`);
      },
    });
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
            {[ALL, ...Object.values(ITEM_CATEGORIES)].map((c) => (
              <TabsTrigger key={c} value={c}>
                {c}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Input className="h-8 min-w-0 flex-1 sm:w-48 sm:flex-none" placeholder="Search items" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="flex items-center gap-2">
          <Switch id="owned-only" checked={ownedOnly} onCheckedChange={setOwnedOnly} />
          <Label htmlFor="owned-only" className="text-sm font-normal">
            Owned only ({ownedTotal})
          </Label>
        </div>
        {effectFilter && (
          <Badge variant="secondary" className="gap-1">
            Items for {effectFilter.label}
            <button type="button" className="-mr-1 rounded-sm opacity-70 hover:opacity-100" aria-label="Show all items" onClick={() => setEffectFilter(null)}>
              <X className="size-3" />
            </button>
          </Badge>
        )}
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {shown.map((e) => (
          <div key={e.ids[0]} className="grid gap-1.5 rounded-md border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {/* items not owned are dimmed, but never their buttons (a Buy button must not look disabled) or the active bonus */}
                <div className={cn('flex flex-wrap items-center gap-2', e.owned === 0 && 'opacity-60')}>
                  <span className="font-medium">{e.info.name}</span>
                  <Badge variant={e.owned > 0 ? 'default' : 'outline'} className="tabular-nums">
                    ×{fmtExact(e.owned)}
                  </Badge>
                  {category === ALL && <span className="text-xs text-muted-foreground">{e.info.category}</span>}
                </div>
                <ActiveBonus ids={e.ids} buffs={player.data?.buffs ?? []} />
              </div>
              <div className="flex shrink-0 gap-1">
                {goldPriceOf(e) && (
                  <Button
                    size="xs"
                    variant={e.owned === 0 ? 'default' : 'outline'}
                    disabled={city.resource.gold < goldPriceOf(e)!.price || buyGold.isPending}
                    title={
                      city.resource.gold < goldPriceOf(e)!.price
                        ? `Not enough gold in ${city.name} (${fmtExact(goldPriceOf(e)!.price)} needed)`
                        : `Buy one with ${city.name}'s gold`
                    }
                    onClick={() => buyGold.mutate(goldPriceOf(e)!.id, { onSuccess: () => toast.success(`Bought ${e.info.name}`) })}
                  >
                    Buy · {fmt(goldPriceOf(e)!.price)} gold
                  </Button>
                )}
                {e.info.use === 'direct' && (
                  <Button size="xs" disabled={e.owned === 0 || use.isPending} onClick={() => useEntry(e)}>
                    Use
                  </Button>
                )}
              </div>
            </div>
            <div className={cn('grid gap-1.5', e.owned === 0 && 'opacity-60')}>
              <p className="text-sm text-muted-foreground">{e.info.description}</p>
              {e.info.howTo && <p className="text-xs text-muted-foreground italic">{e.info.howTo}</p>}
              {medalLevelOf(e.ids) != null && <MedalSourcesInfo level={medalLevelOf(e.ids)!} />}
            </div>
          </div>
        ))}
        {shown.length === 0 && <p className="text-sm text-muted-foreground">No items match.</p>}
      </div>
    </div>
  );
}

function describeGrant(g: { items?: Record<string, number>; resources?: Record<string, number | undefined>; troops?: Record<string, number | undefined> }) {
  const parts: string[] = [];
  for (const [id, n] of Object.entries(g.items ?? {})) parts.push(`${n} × ${itemConfig(id)?.name.trim() ?? id}`);
  for (const [r, n] of Object.entries(g.resources ?? {})) if (n) parts.push(`${fmtExact(n)} ${r === 'wood' ? 'lumber' : r}`);
  for (const [k, n] of Object.entries(g.troops ?? {})) if (n) parts.push(`${fmtExact(n)} ${TROOP_NAMES[TROOP_ID_BY_KEY[k as TroopKey]] ?? k}`);
  return parts.join(', ') || 'nothing';
}

/** Medal level 1 (Cross) … 9 (Nation) of an entry, or null for other items. */
function medalLevelOf(ids: string[]): number | null {
  for (const id of ids) {
    const m = /^hero\.loyalty\.([1-9])$/.exec(id);
    if (m) return Number(m[1]);
  }
  return null;
}

const pct = (x: number) => `${x < 0.1 ? (x * 100).toFixed(1) : Math.round(x * 100)}%`;
const range = (min: number, max: number) => (min === max ? `${min}` : `${min}–${max}`);

/** Where a medal comes from, with the odds (core medalSources: the server's own drop rules). */
function MedalSourcesInfo({ level }: { level: number }) {
  const s = medalSources(level);
  return (
    <div className="mt-1 grid gap-1 rounded-md bg-muted/50 p-2 text-xs">
      <div className="flex items-center gap-1.5 font-medium">
        <Medal className="size-3.5 text-amber-500" /> Where to get it
      </div>
      <ul className="grid gap-1 text-muted-foreground">
        {s.attacks.length > 0 && (
          <li>
            <span className="text-foreground">Winning attacks</span> on NPC cities of these levels (a lord&apos;s city counts its Town Hall level), chance per
            win:
            <span className="mt-0.5 flex flex-wrap gap-1">
              {s.attacks.map((a) => (
                <span key={a.cityLevel} className="rounded bg-background px-1.5 py-px tabular-nums">
                  Lv {a.cityLevel} · {pct(a.chance)}
                </span>
              ))}
            </span>
          </li>
        )}
        {s.containers.map((c) => (
          <li key={c.id}>
            <span className="text-foreground">{c.name}</span> ({c.always ? range(c.min, c.max) : `sometimes ${range(c.min, c.max)}`}): {fmt(c.price)} gold in
            the shop
            {c.key && ` (opens with a ${c.key})`}
          </li>
        ))}
        {s.quests.map((q) => (
          <li key={q.name}>
            <span className="text-foreground">Quest &ldquo;{q.name}&rdquo;</span>: {q.count} (once)
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * For an item that applies a timed bonus (a buff on the lord): whether that bonus is running now and
 * for how long. Items sharing a bonus (e.g. the 1-day and 7-day production items) extend the same one:
 * the item last used shows it as active, the others which item is running and what using them adds.
 */
function ActiveBonus({ ids, buffs }: { ids: string[]; buffs: { id: string; endTime: number; itemId?: string }[] }) {
  const now = useNow(30_000);
  const effect = ids.map(itemEffect).find((e) => e?.kind === 'buff');
  if (effect?.kind !== 'buff') return null;
  const active = buffs.find((b) => b.id === effect.buff && b.endTime > now);
  if (!active) return null;
  if (active.itemId && ids.includes(active.itemId)) {
    return (
      <Badge className={cn('gap-1 tabular-nums', ITEM_BONUS_TONE)} title="This bonus is running now; using another extends it">
        Active · <Countdown endTime={active.endTime} />
      </Badge>
    );
  }
  // the same bonus, set by another item (or before the item was recorded): plain text, so this card does not read as active
  const source = active.itemId ? itemConfig(active.itemId)?.name.trim() : null;
  const days = effect.durationMs / 86_400_000;
  const adds = days >= 1 ? `${days} day${days === 1 ? '' : 's'}` : `${Math.round(effect.durationMs / 3_600_000)} hours`;
  return (
    <p className="text-xs text-muted-foreground tabular-nums">
      Same bonus already running{source ? ` from ${source}` : ''} (<Countdown endTime={active.endTime} /> left); using this adds {adds}.
    </p>
  );
}
