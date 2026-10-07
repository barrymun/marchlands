import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Lock, LockOpen, Pencil, RefreshCw, Sparkles, X } from 'lucide-react';
import type { CityBean, HeroBean } from '@evony/api-client';
import { toast } from 'sonner';
import { BALANCE, BuildingType, HeroStatus, heroManagement, heroPower, heroStratagem, levelsReady } from '@evony/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useSticky } from '@/hooks/use-sticky';
import { HeroPointsDialog } from '@/components/hero-points-dialog';
import { HeroItemsDialog } from '@/components/hero-items-dialog';
import { qk, useCommand } from '@/hooks/use-game';
import { useNow } from '@/hooks/use-now';
import { api, unwrap } from '@/lib/api';
import { duration, fmt, fmtExact, signedRate } from '@/lib/format';
import { dominantAttribute, heroAttributeValues } from '@/lib/hero-attributes';
import { cn } from '@/lib/utils';

const STATUS: Record<number, string> = {
  [HeroStatus.IDLE]: 'Idle',
  [HeroStatus.MAYOR]: 'Mayor',
  [HeroStatus.ATTACK]: 'Marching',
  [HeroStatus.SEIZED]: 'Captive',
  [HeroStatus.RETURN]: 'Returning',
};

export function HeroesPanel({ city }: { city: CityBean }) {
  const hasInn = city.buildings.some((b) => b.typeId === BuildingType.INN && b.level > 0);
  const tavern = useQuery({
    queryKey: ['tavern', city.id],
    enabled: hasInn,
    queryFn: () => unwrap(api.GET('/api/v1/cities/{cityId}/tavern', { params: { path: { cityId: city.id } } })),
  });
  const refresh = () => [qk.city(city.id), ['tavern', city.id]];
  const hire = useCommand(
    (heroId: number) => unwrap(api.POST('/api/v1/cities/{cityId}/tavern/{heroId}/hire', { params: { path: { cityId: city.id, heroId } } })),
    refresh,
    'Hero hired',
  );
  const reroll = useCommand(
    (payWith: 'gold' | 'item') => unwrap(api.POST('/api/v1/cities/{cityId}/tavern/refresh', { params: { path: { cityId: city.id } }, body: { payWith } })),
    refresh,
    'New heroes at the Inn',
  );
  const mayor = useCommand((heroId: number) => unwrap(api.POST('/api/v1/heroes/{heroId}/mayor', { params: { path: { heroId } } })), refresh, 'Mayor appointed');
  // one click takes every level the experience pays for
  const levelUp = useCommand(async (heroId: number) => {
    const before = city.heros.find((h) => h.id === heroId)?.level;
    const h = await unwrap(api.POST('/api/v1/heroes/{heroId}/level-up', { params: { path: { heroId } } }));
    const gained = before != null ? h.level - before : 1;
    toast.success(`${h.name} reached level ${h.level}${gained > 1 ? ` (+${gained} levels, +${gained} points)` : ''}`);
    return h;
  }, refresh);
  const rename = useCommand(
    (v: { heroId: number; name: string }) => unwrap(api.PATCH('/api/v1/heroes/{heroId}', { params: { path: { heroId: v.heroId } }, body: { name: v.name } })),
    refresh,
    'Hero renamed',
  );
  const fire = useCommand((heroId: number) => unwrap(api.POST('/api/v1/heroes/{heroId}/fire', { params: { path: { heroId } } })), refresh, 'Hero dismissed');
  const lock = useCommand(
    (v: { heroId: number; locked: boolean }) =>
      unwrap(api.PUT('/api/v1/heroes/{heroId}/lock', { params: { path: { heroId: v.heroId } }, body: { locked: v.locked } })),
    () => [qk.city(city.id)],
  );
  const [dismissing, setDismissing] = useState<HeroBean | null>(null);

  // the mayor's politics adds a percentage of (efficiency-adjusted) field output to every basic resource
  const fieldOutput = (['food', 'wood', 'stone', 'iron'] as const).reduce((sum, r) => sum + city.resource[r].breakdown.fields, 0);
  const mayorPct = (h: HeroBean) => Math.round(heroManagement(h) * BALANCE.mayorManagementProductionFactor * 100);
  const mayorGain = (h: HeroBean) => Math.round(fieldOutput * heroManagement(h) * BALANCE.mayorManagementProductionFactor);
  const currentMayor = city.heros.find((h) => h.status === HeroStatus.MAYOR);
  const [pointsFor, setPointsFor] = useState<number | null>(null);
  const [itemsFor, setItemsFor] = useState<number | null>(null);
  const currentGain = currentMayor ? mayorGain(currentMayor) : 0;
  const mayorNote = (h: HeroBean) => {
    if (h.seized) return null;
    if (h.status === HeroStatus.MAYOR) {
      return (
        <span className="text-emerald-600 dark:text-emerald-400">
          Mayor bonus +{mayorPct(h)}% production · {signedRate(mayorGain(h))}
        </span>
      );
    }
    if (h.status !== HeroStatus.IDLE) return null;
    const diff = mayorGain(h) - currentGain;
    return (
      <span>
        As mayor: +{mayorPct(h)}% production · {signedRate(mayorGain(h))}
        {currentMayor && (
          <span className={diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : diff < 0 ? 'text-destructive' : ''}>
            {' '}
            ({signedRate(diff)} vs {currentMayor.name})
          </span>
        )}
      </span>
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Your heroes</CardTitle>
          <CardDescription>A Feasting Hall raises how many heroes the city can keep.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {city.heros.length === 0 && <p className="text-sm text-muted-foreground">No heroes yet. Hire one at the Inn.</p>}
          {city.heros.map((h) => (
            <HeroRow
              key={h.id}
              hero={h}
              note={mayorNote(h)}
              showExp
              onRename={h.seized ? undefined : (name) => rename.mutateAsync({ heroId: h.id, name }).then(() => undefined)}
            >
              <Badge variant={h.status === HeroStatus.MAYOR ? 'default' : 'secondary'}>{h.seized ? 'Captive' : (STATUS[h.status] ?? h.status)}</Badge>
              {!h.seized && (h.status === HeroStatus.IDLE || h.status === HeroStatus.MAYOR) && (
                <Button size="xs" variant={h.remainPoint > 0 ? 'default' : 'outline'} onClick={() => setPointsFor(h.id)}>
                  Points{h.remainPoint > 0 ? ` (${h.remainPoint})` : ''}
                </Button>
              )}
              {!h.seized && (
                <Button size="xs" variant="outline" onClick={() => setItemsFor(h.id)}>
                  Items
                </Button>
              )}
              {!h.seized && (
                <div className="flex items-center gap-1.5 px-1">
                  <Switch
                    id={`lock-${h.id}`}
                    checked={h.locked}
                    disabled={lock.isPending}
                    onCheckedChange={(locked) => lock.mutate({ heroId: h.id, locked })}
                  />
                  <Label htmlFor={`lock-${h.id}`} className="gap-1 text-xs font-normal">
                    {h.locked ? <Lock className="size-3" /> : <LockOpen className="size-3" />}
                    {h.locked ? 'Locked' : 'Lock'}
                  </Label>
                </div>
              )}
              {h.experience >= h.upgradeExp && (
                <Button size="xs" onClick={() => levelUp.mutate(h.id)} disabled={levelUp.isPending}>
                  {levelsReady(h) > 1 ? `Level up ×${levelsReady(h)} → Lv ${h.level + levelsReady(h)}` : 'Level up'}
                </Button>
              )}
              {h.status === HeroStatus.IDLE && !h.seized && (
                <>
                  <Button size="xs" variant="outline" onClick={() => mayor.mutate(h.id)}>
                    Make mayor
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    disabled={h.locked}
                    title={h.locked ? 'Locked: unlock the hero to dismiss them' : undefined}
                    onClick={() => setDismissing(h)}
                  >
                    Dismiss
                  </Button>
                </>
              )}
            </HeroRow>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Inn</CardTitle>
          <CardDescription>{hasInn ? `${tavern.data?.posCount ?? '…'} free hero slots.` : 'Build an Inn to recruit heroes.'}</CardDescription>
        </CardHeader>
        {hasInn && (
          <CardContent className="grid gap-2">
            {tavern.data && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={reroll.isPending || city.resource.gold < tavern.data.refreshCost}
                  onClick={() => reroll.mutate('gold')}
                >
                  <RefreshCw /> New offers ({fmt(tavern.data.refreshCost)} gold)
                </Button>
                {tavern.data.huntingItems > 0 && (
                  <Button size="sm" variant="outline" disabled={reroll.isPending} onClick={() => reroll.mutate('item')}>
                    Use Hero Hunting ({tavern.data.huntingItems})
                  </Button>
                )}
              </div>
            )}
            {tavern.data?.heros.map((h) => (
              <HeroRow key={h.id} hero={h} note={mayorNote(h)}>
                <span className="text-xs text-muted-foreground tabular-nums">{fmt(h.level * 1000)} gold</span>
                <Button size="xs" disabled={hire.isPending} onClick={() => hire.mutate(h.id)}>
                  Hire
                </Button>
              </HeroRow>
            ))}
          </CardContent>
        )}
      </Card>
      <DismissHeroDialog
        hero={dismissing}
        pending={fire.isPending}
        onCancel={() => setDismissing(null)}
        onConfirm={(h) => fire.mutate(h.id, { onSuccess: () => setDismissing(null) })}
      />
      <HeroItemsDialog hero={city.heros.find((h) => h.id === itemsFor) ?? null} cityId={city.id} onClose={() => setItemsFor(null)} />
      <HeroPointsDialog
        hero={city.heros.find((h) => h.id === pointsFor) ?? null}
        cityId={city.id}
        fieldOutput={fieldOutput}
        onClose={() => setPointsFor(null)}
      />
    </div>
  );
}

function HeroRow({
  hero,
  note,
  showExp = false,
  onRename,
  children,
}: {
  hero: HeroBean;
  note?: React.ReactNode;
  showExp?: boolean;
  onRename?: (name: string) => Promise<void>;
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(hero.name);
  const save = async () => {
    const name = draft.trim();
    if (!name || name === hero.name) return setEditing(false);
    try {
      await onRename!(name);
      setEditing(false);
    } catch {
      /* the error is toasted; keep editing */
    }
  };
  return (
    <div className="grid gap-2 rounded-md border p-2">
      <div>
        {editing ? (
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <Input
              autoFocus
              className="h-7 w-40"
              maxLength={20}
              value={draft}
              aria-label="Hero name"
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
            />
            <Button type="submit" size="icon-xs" aria-label="Save name">
              <Check />
            </Button>
            <Button type="button" size="icon-xs" variant="ghost" aria-label="Cancel" onClick={() => setEditing(false)}>
              <X />
            </Button>
          </form>
        ) : (
          <div className="flex items-center gap-1 text-sm font-medium">
            {hero.name} <span className="font-normal text-muted-foreground">Lv {hero.level}</span>
            {onRename && (
              <Button
                size="icon-xs"
                variant="ghost"
                className="text-muted-foreground"
                aria-label={`Rename ${hero.name}`}
                onClick={() => {
                  setDraft(hero.name);
                  setEditing(true);
                }}
              >
                <Pencil />
              </Button>
            )}
          </div>
        )}
        <HeroAttributes hero={hero} />
        {note && <div className="text-xs tabular-nums">{note}</div>}
        <HeroBuffs hero={hero} />
        {showExp && <ExpBar hero={hero} />}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/** The hero's attributes, with the highest one (what the hero is best at) as a coloured badge. */
function HeroAttributes({ hero }: { hero: HeroBean }) {
  const values = heroAttributeValues(hero);
  const top = dominantAttribute(hero);
  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tabular-nums">
      <span className={cn('rounded-md px-1.5 py-0.5 text-sm font-semibold', top.tone)} title={`Strongest attribute: ${top.label}`}>
        {top.label} {top.v}
      </span>
      <span className="text-muted-foreground">
        {values
          .filter((a) => a.key !== top.key)
          .map((a) => `${a.short} ${a.v}`)
          .join(' · ')}{' '}
        · loyalty {hero.loyalty}
        {hero.remainPoint > 0 && ` · ${hero.remainPoint} points`}
      </span>
    </div>
  );
}

const BUFF_LABEL: Record<string, string> = { power: 'Attack', management: 'Politics', stratagem: 'Intelligence' };

/** Active attribute boosts with a live countdown (real time: boosts are not sped up by GAME_SPEED). */
function HeroBuffs({ hero }: { hero: HeroBean }) {
  const now = useNow();
  const active = (hero.buffs ?? []).filter((b) => b.endTime > now);
  if (!active.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {active.map((b) => (
        <Badge key={b.id} variant="outline" className="gap-1 font-normal tabular-nums">
          <Sparkles className="size-3 text-amber-500" />
          {BUFF_LABEL[b.id] ?? b.id} +{b.param ?? '25%'} · {duration(b.endTime - now)} left
        </Badge>
      ))}
    </div>
  );
}

/** Experience towards the next level; animates when a push updates the hero. */
function ExpBar({ hero }: { hero: HeroBean }) {
  const pct = Math.min(100, (hero.experience / Math.max(1, hero.upgradeExp)) * 100);
  const ready = hero.experience >= hero.upgradeExp;
  return (
    <div className="mt-1.5 grid w-56 max-w-full gap-1">
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={hero.upgradeExp}
        aria-valuenow={hero.experience}
        aria-label="Experience"
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-700 ease-out', ready ? 'bg-amber-500' : 'bg-primary')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-[11px] text-muted-foreground tabular-nums">
        {ready ? (
          <span className="font-medium text-amber-600 dark:text-amber-400">Ready to level up{levelsReady(hero) > 1 && ` ${levelsReady(hero)} times`}</span>
        ) : (
          <>
            XP {fmtExact(hero.experience)} / {fmtExact(hero.upgradeExp)} · {fmtExact(hero.upgradeExp - hero.experience)} to Lv {hero.level + 1}
          </>
        )}
      </div>
    </div>
  );
}

/** Asks before a hero is dismissed for good. */
function DismissHeroDialog({
  hero,
  pending,
  onCancel,
  onConfirm,
}: {
  hero: HeroBean | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (h: HeroBean) => void;
}) {
  const shown = useSticky(hero);
  return (
    <Dialog open={hero != null} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        {shown && (
          <>
            <DialogHeader>
              <DialogTitle>Dismiss {shown.name}?</DialogTitle>
              <DialogDescription>
                {shown.name} (Lv {shown.level}, att {heroPower(shown)} · pol {heroManagement(shown)} · int {heroStratagem(shown)}) will leave your city for
                good. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={onCancel}>
                Keep {shown.name}
              </Button>
              <Button variant="destructive" disabled={pending} onClick={() => onConfirm(shown)}>
                Dismiss
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
