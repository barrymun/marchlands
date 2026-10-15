import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import type { CityBean } from '@marchlands/api-client';
import { tileId as toTileId } from '@marchlands/core';

import { TileLabel } from '@/components/flow-attack/attack-targets-fields/city-targets/tile-label/tile-label';
import { idleHeroes, targetCap } from '@/components/flow-attack/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePlayer } from '@/hooks/use-game';

export function CityTargets({ city, list, onChange }: { city: CityBean; list: number[]; onChange: (list: number[]) => void }) {
  const { t } = useTranslation('flow-attack');
  const mapSize = usePlayer().data?.mapSizeX ?? 800;
  const [text, setText] = useState('');
  const cap = targetCap(city);
  const add = () => {
    const m = text.match(/^\s*\(?\s*(\d+)\s*[,\s]\s*(\d+)\s*\)?\s*$/);
    if (!m) return toast.error(t('cityTargets.badFormat'));
    const [x, y] = [Number(m[1]), Number(m[2])];
    if (x >= mapSize || y >= mapSize) return toast.error(t('cityTargets.outOfRange', { max: mapSize - 1 }));
    const id = toTileId(x, y, mapSize);
    if (list.includes(id)) return toast.error(t('cityTargets.duplicate'));
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
          {t('cityTargets.count', { n: list.length, count: cap, heroes: t('cityTargets.idleHeroes', { count: idleHeroes(city) }) })}
        </span>
      </div>
      {list.length > 0 && (
        <ol className="grid gap-1">
          {list.map((target, i) => (
            <li key={target} className="flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-2">
                <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] tabular-nums">{i + 1}</span>
                <TileLabel tileId={target} />
              </span>
              <Button size="icon-xs" variant="ghost" aria-label={t('cityTargets.remove')} onClick={() => onChange(list.filter((x) => x !== target))}>
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
          <Input
            className="h-8 w-32"
            placeholder={t('cityTargets.placeholder')}
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label={t('cityTargets.addFor', { city: city.name })}
          />
          <Button type="submit" size="sm" variant="outline" disabled={!text.trim()}>
            <Plus /> {t('cityTargets.add')}
          </Button>
        </form>
      ) : (
        <p className="text-xs text-muted-foreground">{cap === 0 ? t('cityTargets.noIdle') : t('cityTargets.full')}</p>
      )}
    </div>
  );
}
