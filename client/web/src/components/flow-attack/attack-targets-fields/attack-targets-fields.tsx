// (marchlands) The "Attack targets" flow action: a saved army plus each city's own targets, picked by
// typing x,y here or with "Add to farming list" on the Map tab.

import { useState } from 'react';
import { Swords } from 'lucide-react';
import { TROOP_KEYS } from '@marchlands/core';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePlayer } from '@/hooks/use-game';
import { fmtExact, troopName } from '@/lib/format';
import type { AttackAction } from '@/components/flow-attack/types';
import { usePresets } from '@/components/flow-attack/attack-targets-fields/hooks';
import { CityTargets } from '@/components/flow-attack/attack-targets-fields/city-targets/city-targets';
import { NewArmy } from '@/components/flow-attack/attack-targets-fields/new-army/new-army';

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
