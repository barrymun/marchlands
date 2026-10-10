import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getPlayerArmyPresetsQueryKey, postPlayerArmyPresetsMutation } from '@marchlands/api-client';
import { TROOP_KEYS, type TroopKey } from '@marchlands/core';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCommand } from '@/hooks/use-game';
import { troopName } from '@/lib/format';

/** Save a new army composition on the fly (it joins your saved armies). */
export function NewArmy({ onSaved }: { onSaved: (id: string) => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [troops, setTroops] = useState<Partial<Record<TroopKey, string>>>({});
  const body = Object.fromEntries(
    Object.entries(troops)
      .map(([k, v]) => [k, Number(v || 0)])
      .filter(([, n]) => Number(n) > 0),
  );
  const save = useCommand(postPlayerArmyPresetsMutation(), () => [getPlayerArmyPresetsQueryKey()]);
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
          save.mutate(
            { body: { name: name.trim(), troops: body } },
            {
              onSuccess: (list) => {
                const made = list.find((p) => p.name.toLowerCase() === name.trim().toLowerCase());
                void qc.invalidateQueries({ queryKey: getPlayerArmyPresetsQueryKey() });
                toast.success(`Saved "${name.trim()}"`);
                if (made) onSaved(made.id);
              },
            },
          )
        }
      >
        Save army
      </Button>
    </div>
  );
}
