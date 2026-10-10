import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { usePlayer } from '@/hooks/use-game';
import type { Targets } from '@/components/flows-panel/types';

/** All cities (including ones gained later), or a selection of one or more cities. */
export function CityPicker({ value, onChange, currentCityId }: { value: Targets; onChange: (t: Targets) => void; currentCityId?: number }) {
  const cities = usePlayer().data?.castles ?? [];
  const all = value === 'all';
  const chosen = new Set(all ? [] : value);
  const set = (id: number, on: boolean) => onChange(on ? [...chosen, id] : [...chosen].filter((x) => x !== id));
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">Cities</Label>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={all}
          onCheckedChange={(on) => onChange(on === true ? 'all' : currentCityId != null ? [currentCityId] : cities.slice(0, 1).map((c) => c.id))}
        />
        All cities <span className="text-xs text-muted-foreground">({cities.length}, and any you gain later)</span>
      </label>
      {!all && (
        <div className="grid gap-1 pl-6 sm:grid-cols-2">
          {cities.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <Checkbox checked={chosen.has(c.id)} onCheckedChange={(on) => set(c.id, on === true)} />
              <span className="truncate">
                {c.name}{' '}
                <span className="text-xs text-muted-foreground tabular-nums">
                  ({c.x},{c.y}){c.id === currentCityId ? ' · here' : ''}
                </span>
              </span>
            </label>
          ))}
        </div>
      )}
      {!all && chosen.size === 0 && <p className="text-xs text-destructive">Choose at least one city.</p>}
    </div>
  );
}
