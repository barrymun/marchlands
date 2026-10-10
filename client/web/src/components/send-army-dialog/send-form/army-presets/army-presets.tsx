import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Star, Trash2 } from 'lucide-react';
import {
  deletePlayerArmyPresetsByPresetIdMutation,
  getPlayerArmyPresetsOptions,
  getPlayerArmyPresetsQueryKey,
  postPlayerArmyPresetsMutation,
  type CityBean,
} from '@marchlands/api-client';
import { TROOP_ID_BY_KEY, type TroopKey } from '@marchlands/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCommand } from '@/hooks/use-game';
import { fmtExact, troopName } from '@/lib/format';

/**
 * Saved army compositions (e.g. a layered wave): load one into the form, or save the troops chosen
 * now under a name. Kept on the server per lord, so every city and device sees them.
 */
export function ArmyPresets({
  city,
  troops,
  onLoad,
}: {
  city: CityBean;
  troops: Record<string, number>;
  onLoad: (t: Partial<Record<TroopKey, string>>) => void;
}) {
  const presets = useQuery(getPlayerArmyPresetsOptions());
  const [selected, setSelected] = useState('');
  const [name, setName] = useState('');
  const [short, setShort] = useState('');
  const [managing, setManaging] = useState(false);
  const save = useCommand(postPlayerArmyPresetsMutation(), () => [getPlayerArmyPresetsQueryKey()], `Saved "${name.trim()}"`);
  const remove = useCommand(deletePlayerArmyPresetsByPresetIdMutation(), () => [getPlayerArmyPresetsQueryKey()], 'Preset deleted');
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
                  remove.mutate(
                    { path: { presetId: p.id } },
                    {
                      onSuccess: () => {
                        if (selected === p.id) setSelected('');
                        if (list.length <= 1) setManaging(false);
                      },
                    },
                  )
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
            onClick={() => remove.mutate({ path: { presetId: selected } }, { onSuccess: () => (setSelected(''), setShort('')) })}
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
          onClick={() => save.mutate({ body: { name: name.trim(), troops } }, { onSuccess: () => setName('') })}
        >
          <Star /> Save
        </Button>
      </div>
    </div>
  );
}
