// (evony-re) The "Attack targets" flow action: a saved army plus each city's own targets, picked by
// typing x,y here or with "Add to farming list" on the Map tab.

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Swords, X } from 'lucide-react';
import type { CityBean, Flow, FlowAction } from '@evony/api-client';
import { FLOW_MAX_TARGETS_PER_CITY, HeroStatus, tileId as toTileId, tileXY, TROOP_KEYS, type TroopKey } from '@evony/core';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCommand, usePlayer } from '@/hooks/use-game';
import { api, errorMessage, unwrap } from '@/lib/api';
import { fmtExact, troopName } from '@/lib/format';

export type AttackAction = Extract<FlowAction, { type: 'attackTargets' }>;

const usePresets = () => useQuery({ queryKey: ['army-presets'], queryFn: () => unwrap(api.GET('/api/v1/player/army-presets')) });

/** Idle heroes in a city: each target needs one to lead it. */
const idleHeroes = (c: Pick<CityBean, 'heros'>) => c.heros.filter((h) => h.status === HeroStatus.IDLE && !h.seized).length;

/** Most targets a city can list: its idle heroes (and at most FLOW_MAX_TARGETS_PER_CITY). */
export const targetCap = (c: Pick<CityBean, 'heros'>) => Math.min(FLOW_MAX_TARGETS_PER_CITY, idleHeroes(c));

/** Editor fields of an "Attack targets" action: the saved army, then each city's targets. */
export function AttackTargetsFields({
  action,
  onChange,
  cities: targets,
}: {
  action: AttackAction;
  onChange: (a: AttackAction) => void;
  cities: 'all' | number[];
}) {
  const player = usePlayer();
  const presets = usePresets();
  const [creating, setCreating] = useState(false);
  const castles = (player.data?.castles ?? []).filter((c) => targets === 'all' || targets.includes(c.id));
  const preset = presets.data?.find((p) => p.id === action.presetId);
  const setList = (cityId: number, list: number[]) => onChange({ ...action, targets: { ...action.targets, [String(cityId)]: list } });

  return (
    <div className="grid w-full gap-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Swords className="size-4 text-muted-foreground" />
        <span>Attack with saved army</span>
        <Select value={action.presetId || undefined} onValueChange={(presetId) => onChange({ ...action, presetId })}>
          <SelectTrigger size="sm" className="w-48">
            <SelectValue placeholder={presets.data?.length ? 'Choose a saved army' : 'No saved armies'} />
          </SelectTrigger>
          <SelectContent>
            {(presets.data ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name} · {fmtExact(Object.values(p.troops).reduce((a, b) => a + (b ?? 0), 0))} troops
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="xs" variant="ghost" onClick={() => setCreating(!creating)}>
          {creating ? 'Close' : '+ New army'}
        </Button>
      </div>
      {preset && (
        <p className="text-xs text-muted-foreground">
          {Object.entries(preset.troops)
            .map(([k, n]) => `${fmtExact(n ?? 0)} ${troopName(Number(Object.entries(TROOP_KEYS).find(([, key]) => key === k)?.[0]))}`)
            .join(', ')}
        </p>
      )}
      {creating && (
        <NewArmy
          onSaved={(id) => {
            onChange({ ...action, presetId: id });
            setCreating(false);
          }}
        />
      )}
      <p className="text-xs text-muted-foreground">
        Each city attacks its own targets in order; its idle heroes lead, strongest Attack first. A target is skipped (the flow carries on) when the city lacks
        the troops, a hero or Rally Spot room.
      </p>
      {castles.map((c) => (
        <CityTargets key={c.id} city={c} list={action.targets[String(c.id)] ?? []} onChange={(list) => setList(c.id, list)} />
      ))}
    </div>
  );
}

function CityTargets({ city, list, onChange }: { city: CityBean; list: number[]; onChange: (list: number[]) => void }) {
  const mapSize = usePlayer().data?.mapSizeX ?? 800;
  const [text, setText] = useState('');
  const cap = targetCap(city);
  const add = () => {
    const m = text.match(/^\s*\(?\s*(\d+)\s*[,\s]\s*(\d+)\s*\)?\s*$/);
    if (!m) return toast.error('Type coordinates as x,y');
    const [x, y] = [Number(m[1]), Number(m[2])];
    if (x >= mapSize || y >= mapSize) return toast.error(`Coordinates go from 0 to ${mapSize - 1}`);
    const id = toTileId(x, y, mapSize);
    if (list.includes(id)) return toast.error('Already in the list');
    onChange([...list, id]);
    setText('');
  };
  return (
    <div className="grid gap-1.5 rounded-md border p-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium">
          {city.name}{' '}
          <span className="text-xs font-normal text-muted-foreground tabular-nums">
            ({city.x},{city.y})
          </span>
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {list.length} / {cap} targets ({idleHeroes(city)} idle heroes)
        </span>
      </div>
      {list.length > 0 && (
        <ol className="grid gap-1">
          {list.map((t, i) => (
            <li key={t} className="flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-2">
                <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] tabular-nums">{i + 1}</span>
                <TileLabel tileId={t} />
              </span>
              <Button size="icon-xs" variant="ghost" aria-label="Remove target" onClick={() => onChange(list.filter((x) => x !== t))}>
                <X />
              </Button>
            </li>
          ))}
        </ol>
      )}
      {list.length < cap ? (
        <form
          className="flex gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <Input className="h-8 w-32" placeholder="x,y" value={text} onChange={(e) => setText(e.target.value)} aria-label={`Add a target for ${city.name}`} />
          <Button type="submit" size="sm" variant="outline" disabled={!text.trim()}>
            <Plus /> Add
          </Button>
        </form>
      ) : (
        <p className="text-xs text-muted-foreground">
          {cap === 0 ? 'No idle heroes in this city: targets need a hero each.' : 'One target per idle hero: this city is full.'}
        </p>
      )}
    </div>
  );
}

/** "(x,y) NPC City Lv 10" for a tile. */
function TileLabel({ tileId }: { tileId: number }) {
  const mapSize = usePlayer().data?.mapSizeX ?? 800;
  const { x, y } = tileXY(tileId, mapSize);
  const info = useQuery({
    queryKey: ['tile', tileId],
    queryFn: () => unwrap(api.GET('/api/v1/map/tiles/{tileId}', { params: { path: { tileId } } })),
    staleTime: 60_000,
  });
  return (
    <span className="tabular-nums">
      ({x},{y}){' '}
      {info.data && (
        <span className="text-muted-foreground">
          {info.data.name} Lv {info.data.level}
        </span>
      )}
    </span>
  );
}

/** Save a new army composition on the fly (it joins your saved armies). */
function NewArmy({ onSaved }: { onSaved: (id: string) => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [troops, setTroops] = useState<Partial<Record<TroopKey, string>>>({});
  const body = Object.fromEntries(
    Object.entries(troops)
      .map(([k, v]) => [k, Number(v || 0)])
      .filter(([, n]) => Number(n) > 0),
  );
  const save = useCommand(
    () => unwrap(api.POST('/api/v1/player/army-presets', { body: { name: name.trim(), troops: body } })),
    () => [['army-presets']],
  );
  return (
    <div className="grid gap-2 rounded-md border border-dashed p-2">
      <div className="grid gap-1">
        <Label className="text-xs">New saved army</Label>
        <Input className="h-8" maxLength={30} placeholder="Name, e.g. Layered L10" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {Object.entries(TROOP_KEYS).map(([id, key]) => (
          <label key={key} className="grid gap-0.5 text-xs">
            {troopName(Number(id))}
            <Input
              className="h-7"
              inputMode="numeric"
              placeholder="0"
              value={troops[key] ?? ''}
              onChange={(e) => setTroops({ ...troops, [key]: e.target.value.replace(/\D/g, '') })}
            />
          </label>
        ))}
      </div>
      <Button
        size="sm"
        className="justify-self-end"
        disabled={!name.trim() || !Object.keys(body).length || save.isPending}
        onClick={() =>
          save.mutate(undefined, {
            onSuccess: (list) => {
              const made = list.find((p) => p.name.toLowerCase() === name.trim().toLowerCase());
              void qc.invalidateQueries({ queryKey: ['army-presets'] });
              toast.success(`Saved "${name.trim()}"`);
              if (made) onSaved(made.id);
            },
          })
        }
      >
        Save army
      </Button>
    </div>
  );
}

/** Map tab: add a tile to this city's targets in a flow that has an "Attack targets" action. */
export function AddToFarmButton({ city, tileId, tileName }: { city: CityBean; tileId: number; tileName: string }) {
  const qc = useQueryClient();
  const flows = useQuery({ queryKey: ['flows'], queryFn: () => unwrap(api.GET('/api/v1/player/flows')) });
  const farms = (flows.data ?? []).filter((f) => f.actions.some((a) => a.type === 'attackTargets'));
  const [busy, setBusy] = useState(false);

  const addTo = async (flow: Flow) => {
    const i = flow.actions.findIndex((a) => a.type === 'attackTargets');
    const action = flow.actions[i] as AttackAction;
    const list = action.targets[String(city.id)] ?? [];
    if (list.includes(tileId)) return toast.info(`${tileName} is already in "${flow.name}"`);
    if (list.length >= targetCap(city)) return toast.error(`${city.name} has no idle hero left for another target in "${flow.name}"`);
    const actions = flow.actions.map((a, j) => (j === i ? { ...action, targets: { ...action.targets, [String(city.id)]: [...list, tileId] } } : a));
    // the flow must also run on this city
    const cities = flow.cities === 'all' || flow.cities.includes(city.id) ? flow.cities : [...flow.cities, city.id];
    setBusy(true);
    try {
      const saved = await unwrap(api.POST('/api/v1/player/flows', { body: { id: flow.id, name: flow.name, actions, cities } }));
      qc.setQueryData(['flows'], saved);
      toast.success(`Added ${tileName} to "${flow.name}" (${city.name}, target ${list.length + 1})`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  /** No farming flow yet: start one ("Farming list") holding this tile; the saved army is chosen later in the Flows tab. */
  const createList = async () => {
    setBusy(true);
    try {
      const saved = await unwrap(
        api.POST('/api/v1/player/flows', {
          body: { name: 'Farming list', actions: [{ type: 'attackTargets', presetId: '', targets: { [String(city.id)]: [tileId] } }], cities: 'all' },
        }),
      );
      qc.setQueryData(['flows'], saved);
      toast.success(`Started "Farming list" with ${tileName}`, { description: 'Choose the saved army to send in the Flows tab.' });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!farms.length) {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={busy || targetCap(city) === 0}
        title={targetCap(city) === 0 ? 'Each target needs an idle hero in this city' : undefined}
        onClick={() => void createList()}
      >
        <Swords /> Add to farming list
      </Button>
    );
  }
  if (farms.length === 1) {
    return (
      <Button size="sm" variant="outline" disabled={busy} title={`Adds to the flow "${farms[0].name}" (${city.name})`} onClick={() => void addTo(farms[0])}>
        <Swords /> Add to farming list
      </Button>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" disabled={busy}>
          <Swords /> Add to farming list
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Which farming list?</DropdownMenuLabel>
        {farms.map((f) => (
          <DropdownMenuItem key={f.id} onSelect={() => void addTo(f)}>
            {f.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
