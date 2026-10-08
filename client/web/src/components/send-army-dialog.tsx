import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Star, Trash2 } from 'lucide-react';
import type { CityBean } from '@marchlands/api-client';
import {
  armyLoad,
  buildingLevel,
  BuildingType,
  heroPower,
  HeroStatus,
  maxArmyTroops,
  Mission,
  TROOP_ID_BY_KEY,
  TROOP_KEYS,
  type TroopKey,
} from '@marchlands/core';
import { Button } from '@/components/ui/button';
import { useSticky } from '@/hooks/use-sticky';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MISSION_NAMES } from '@/components/armies-panel';
import { qk, useCommand, usePlayer } from '@/hooks/use-game';
import { api, unwrap } from '@/lib/api';
import { duration, fmt, fmtExact, troopName } from '@/lib/format';
import { ITEM_BONUS_TEXT } from '@/lib/tones';

export interface SendTarget {
  tileId: number;
  name: string;
  missions: number[];
  /** mission selected when the dialog opens (default: the first of `missions`) */
  mission?: number;
  /** troop amounts filled in when the dialog opens */
  troops?: Partial<Record<TroopKey, string>>;
  /** what is at the target, for the scouting note */
  kind?: 'city' | 'npc' | 'valley';
}

export function SendArmyDialog({ city, target, onClose }: { city: CityBean; target: SendTarget | null; onClose: () => void }) {
  const shown = useSticky(target);
  return (
    <Dialog open={target != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        {shown && <SendForm key={shown.tileId} city={city} target={shown} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

const RES = ['gold', 'food', 'wood', 'stone', 'iron'] as const;

function SendForm({ city, target, onDone }: { city: CityBean; target: SendTarget; onDone: () => void }) {
  const [mission, setMission] = useState(String(target.mission ?? target.missions[0]));
  // the strongest idle hero (by Attack) leads by default
  const [heroId, setHeroId] = useState(() => {
    const best = city.heros
      .filter((h) => h.status === HeroStatus.IDLE && !h.seized)
      .reduce<CityBean['heros'][number] | null>((top, h) => (!top || heroPower(h) > heroPower(top) ? h : top), null);
    return best ? String(best.id) : 'none';
  });
  const [troops, setTroops] = useState<Partial<Record<TroopKey, string>>>(target.troops ?? {});
  const scouting = Number(mission) === Mission.SCOUT;
  const [resources, setResources] = useState<Partial<Record<(typeof RES)[number], string>>>({});
  // only scouts go on a scouting mission
  const available = Object.entries(TROOP_KEYS).filter(([, key]) => city.troop[key] > 0 && (!scouting || key === 'scouter'));
  const idleHeroes = city.heros.filter((h) => h.status === HeroStatus.IDLE && !h.seized);
  const troopBody = Object.fromEntries(
    Object.entries(troops)
      .map(([k, v]) => [k, Number(v || 0)])
      .filter(([k, n]) => Number(n) > 0 && (!scouting || k === 'scouter')),
  );
  // troops one army may hold (Rally Spot level x 10,000, +25% with a War Ensign)
  const player = usePlayer();
  const ensign = (player.data?.buffs ?? []).some((b) => b.id === 'WarEnsignBuff' && b.endTime > Date.now());
  const cap = maxArmyTroops(city.buildings, ensign);
  const rally = buildingLevel(city.buildings, BuildingType.RALLY_SPOT);
  const chosen = Object.values(troopBody).reduce<number>((t, n) => t + Number(n), 0);
  const over = chosen > cap;
  const resourceBody = Object.fromEntries(
    Object.entries(resources)
      .map(([k, v]) => [k, Number(v || 0)])
      .filter(([, n]) => Number(n) > 0),
  );
  const path = { cityId: city.id };
  // carrying capacity of the chosen troops (troop load x Logistics), shared by every resource
  const capacity = armyLoad(troopBody, player.data?.research ?? {});
  const loaded = Object.values(resourceBody).reduce<number>((t, n) => t + Number(n), 0);
  const overloaded = loaded > capacity;
  const inCity = (r: (typeof RES)[number]) => Math.floor(r === 'gold' ? city.resource.gold : city.resource[r].amount);
  /** Fill one resource with whatever the troops can still carry (and the city has). */
  const maxOf = (r: (typeof RES)[number]) => {
    const others = loaded - Number(resourceBody[r] ?? 0);
    setResources({ ...resources, [r]: String(Math.max(0, Math.min(inCity(r), capacity - others))) });
  };

  const estimate = useMutation({
    mutationFn: () =>
      unwrap(api.POST('/api/v1/cities/{cityId}/armies/estimate', { params: { path }, body: { targetTileId: target.tileId, troops: troopBody } })),
  });
  const send = useCommand(
    () =>
      unwrap(
        api.POST('/api/v1/cities/{cityId}/armies', {
          params: { path },
          body: {
            targetTileId: target.tileId,
            mission: Number(mission),
            troops: troopBody,
            resources: Number(mission) === Mission.TRANSPORT || Number(mission) === Mission.BUILD_CITY ? resourceBody : undefined,
            heroId: heroId === 'none' ? null : Number(heroId),
          },
        }),
      ),
    () => [qk.armies, qk.city(city.id)],
    'Army dispatched',
  );
  const carriesResources = Number(mission) === Mission.TRANSPORT || Number(mission) === Mission.BUILD_CITY;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Send army</DialogTitle>
        <DialogDescription>
          From {city.name} to {target.name}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label>Mission</Label>
            <Select value={mission} onValueChange={setMission}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {target.missions.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {MISSION_NAMES[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Hero</Label>
            <Select value={heroId} onValueChange={setHeroId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No hero</SelectItem>
                {idleHeroes.map((h) => (
                  <SelectItem key={h.id} value={String(h.id)}>
                    {h.name} (Lv {h.level}, att {heroPower(h)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {!scouting && <ArmyPresets city={city} troops={troopBody} onLoad={setTroops} />}
        <div className="grid gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <Label>Troops</Label>
            <span className={over ? 'text-xs font-medium text-destructive tabular-nums' : 'text-xs text-muted-foreground tabular-nums'}>
              {fmtExact(chosen)} / {fmtExact(cap)} (Rally Spot Lv {rally}
              {ensign && <span className={over ? undefined : ITEM_BONUS_TEXT}>, War Ensign +25%</span>})
            </span>
          </div>
          {available.length === 0 && (
            <p className="text-sm text-muted-foreground">{scouting ? 'No Scouts in the city: train some in the Military tab.' : 'No troops in the city.'}</p>
          )}
          {scouting && <ScoutNote kind={target.kind} />}
          {available.map(([id, key]) => (
            <div key={key} className="flex items-center justify-between gap-2 text-sm">
              <span>
                {troopName(Number(id))} <span className="text-muted-foreground">({fmtExact(city.troop[key])})</span>
              </span>
              <div className="flex items-center gap-1">
                <Input
                  className="h-8 w-24"
                  inputMode="numeric"
                  value={troops[key] ?? ''}
                  placeholder="0"
                  onChange={(e) => setTroops({ ...troops, [key]: e.target.value.replace(/\D/g, '') })}
                />
                <Button
                  size="xs"
                  variant="ghost"
                  title="As many as fit in the army"
                  onClick={() => {
                    // room left in the army without this type, so "All" never goes over the Rally Spot limit
                    const others = chosen - Number(troopBody[key] ?? 0);
                    setTroops({ ...troops, [key]: String(Math.max(0, Math.min(city.troop[key], cap - others))) });
                  }}
                >
                  All
                </Button>
              </div>
            </div>
          ))}
        </div>
        {carriesResources && (
          <div className="grid gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label>Resources</Label>
              <span className={overloaded ? 'text-xs font-medium text-destructive tabular-nums' : 'text-xs text-muted-foreground tabular-nums'}>
                {capacity > 0 ? `${fmtExact(loaded)} / ${fmtExact(capacity)} carried` : 'Choose troops to carry resources'}
              </span>
            </div>
            {RES.map((r) => (
              <div key={r} className="flex items-center justify-between gap-2 text-sm">
                <span className="capitalize">
                  {r === 'wood' ? 'lumber' : r} <span className="text-muted-foreground">({fmtExact(inCity(r))})</span>
                </span>
                <div className="flex items-center gap-1">
                  <Input
                    className="h-8 w-32"
                    inputMode="numeric"
                    placeholder="0"
                    value={resources[r] ?? ''}
                    onChange={(e) => setResources({ ...resources, [r]: e.target.value.replace(/\D/g, '') })}
                  />
                  <Button size="xs" variant="ghost" disabled={capacity <= 0} title="As much as the troops can still carry" onClick={() => maxOf(r)}>
                    Max
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        {estimate.data && (
          <p className="text-sm text-muted-foreground">
            March {duration(estimate.data.marchTime)} · carries {fmt(estimate.data.load)}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" disabled={!Object.keys(troopBody).length} onClick={() => estimate.mutate()}>
          Estimate
        </Button>
        <Button
          disabled={!Object.keys(troopBody).length || over || (carriesResources && overloaded) || send.isPending}
          onClick={() => send.mutate(undefined, { onSuccess: onDone })}
        >
          Send
        </Button>
      </DialogFooter>
    </>
  );
}

/** What a scouting mission does at this kind of target (combat.ts arriveScout). */
function ScoutNote({ kind }: { kind?: SendTarget['kind'] }) {
  const text =
    kind === 'city'
      ? "Your scouts fight the city's scouts (a hero helps). If any survive, the report shows its resources, troops, fortifications and loyalty; Informatics adds heroes (level 1) and buildings (level 2). If none survive, you learn nothing."
      : kind === 'npc'
        ? 'Barbarian cities never stop scouts: one is enough. The report shows their troops, fortifications, walls, resources, loyalty, buildings and hero.'
        : kind === 'valley'
          ? 'Valleys never stop scouts: one is enough. The report shows the troops guarding it and who holds it.'
          : 'Only scouts go on a scouting mission.';
  return <p className="text-xs text-muted-foreground">{text}</p>;
}

/**
 * Saved army compositions (e.g. a layered wave): load one into the form, or save the troops chosen
 * now under a name. Kept on the server per lord, so every city and device sees them.
 */
function ArmyPresets({ city, troops, onLoad }: { city: CityBean; troops: Record<string, number>; onLoad: (t: Partial<Record<TroopKey, string>>) => void }) {
  const presets = useQuery({ queryKey: ['army-presets'], queryFn: () => unwrap(api.GET('/api/v1/player/army-presets')) });
  const [selected, setSelected] = useState('');
  const [name, setName] = useState('');
  const [short, setShort] = useState('');
  const [managing, setManaging] = useState(false);
  const save = useCommand(
    () => unwrap(api.POST('/api/v1/player/army-presets', { body: { name: name.trim(), troops } })),
    () => [['army-presets']],
    `Saved "${name.trim()}"`,
  );
  const remove = useCommand(
    (presetId: string) => unwrap(api.DELETE('/api/v1/player/army-presets/{presetId}', { params: { path: { presetId } } })),
    () => [['army-presets']],
    'Preset deleted',
  );
  const list = presets.data ?? [];
  const load = (id: string) => {
    setSelected(id);
    const p = list.find((x) => x.id === id);
    if (!p) return;
    // fill in what the city has; note anything it is short of
    const next: Partial<Record<TroopKey, string>> = {};
    const missing: string[] = [];
    for (const [k, n] of Object.entries(p.troops) as [TroopKey, number][]) {
      const have = city.troop[k] ?? 0;
      next[k] = String(Math.min(n, have));
      if (have < n) missing.push(`${fmtExact(n - have)} ${troopName(TROOP_ID_BY_KEY[k])}`);
    }
    onLoad(next);
    setShort(missing.length ? `Short of ${missing.join(', ')}: loaded what the city has.` : '');
  };
  const hasTroops = Object.keys(troops).length > 0;
  return (
    <div className="grid gap-2 rounded-md border p-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs">Saved armies</Label>
        {list.length > 0 && (
          <Button size="xs" variant="ghost" className="h-6 text-xs" onClick={() => setManaging(!managing)}>
            {managing ? 'Done' : 'Manage'}
          </Button>
        )}
      </div>
      {managing && (
        <ul className="grid gap-1">
          {list.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 rounded border px-2 py-1 text-xs">
              <span className="min-w-0 truncate">
                {p.name}{' '}
                <span className="text-muted-foreground tabular-nums">· {fmtExact(Object.values(p.troops).reduce((a, b) => a + (b ?? 0), 0))} troops</span>
              </span>
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label={`Delete saved army ${p.name}`}
                title="Delete"
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate(p.id, {
                    onSuccess: () => {
                      if (selected === p.id) setSelected('');
                      if (list.length <= 1) setManaging(false);
                    },
                  })
                }
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Select value={selected} onValueChange={load} disabled={!list.length}>
          <SelectTrigger className="w-full" size="sm">
            <SelectValue placeholder={list.length ? 'Load a saved army…' : 'No saved armies yet'} />
          </SelectTrigger>
          <SelectContent>
            {list.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name} · {fmtExact(Object.values(p.troops).reduce((a, b) => a + (b ?? 0), 0))} troops
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selected && (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Delete this saved army"
            disabled={remove.isPending}
            onClick={() => remove.mutate(selected, { onSuccess: () => (setSelected(''), setShort('')) })}
          >
            <Trash2 />
          </Button>
        )}
      </div>
      {short && <p className="text-xs text-amber-600">{short}</p>}
      <div className="flex gap-2">
        <Input className="h-8" placeholder="Name this army, e.g. Layered L10" maxLength={30} value={name} onChange={(e) => setName(e.target.value)} />
        <Button
          size="sm"
          variant="outline"
          disabled={!name.trim() || !hasTroops || save.isPending}
          onClick={() => save.mutate(undefined, { onSuccess: () => setName('') })}
        >
          <Star /> Save
        </Button>
      </div>
    </div>
  );
}
