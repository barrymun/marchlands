import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { CityBean } from '@marchlands/api-client';
import { tileId as toTileId } from '@marchlands/core';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePlayer } from '@/hooks/use-game';
import { idleHeroes, targetCap } from '@/components/flow-attack/utils';
import { TileLabel } from '@/components/flow-attack/attack-targets-fields/city-targets/tile-label/tile-label';

export function CityTargets({ city, list, onChange }: { city: CityBean; list: number[]; onChange: (list: number[]) => void }) {
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
