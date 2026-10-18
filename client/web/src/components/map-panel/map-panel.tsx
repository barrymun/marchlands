import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Crosshair, Info, MapPin } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type CityBean,
  deleteValleysByTileIdMutation,
  getArmiesQueryKey,
  getCitiesByCityIdQueryKey,
  getMapQueryKey,
  getMapTilesByTileIdQueryKey,
  getPlayerQueryKey,
  postValleysUpgradeMutation,
} from '@marchlands/api-client';

import { CityDialog } from '@/components/city-dialog/city-dialog';
import { HeldValleys } from '@/components/map-panel/held-valleys/held-valleys';
import { MapLegend } from '@/components/map-panel/map-legend/map-legend';
import { TileCard } from '@/components/map-panel/tile-card/tile-card';
import type { PanDirection } from '@/components/map-panel/world-map/types';
import { panStep } from '@/components/map-panel/world-map/utils';
import { WorldMap } from '@/components/map-panel/world-map/world-map';
import { SendArmyDialog } from '@/components/send-army-dialog/send-army-dialog';
import type { SendTarget } from '@/components/send-army-dialog/types';
import { Button } from '@/components/ui/button';
import { useCommand, usePlayer } from '@/hooks/use-game';
import { useMediaQuery } from '@/hooks/use-media-query';
import { allOf } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

/**
 * The world map filling the viewport, everything else floating over it: a toolbar (where the map is, the arrows, back
 * to the city, this city's valleys, the key), the selected tile's card, and the valleys or the key when asked for. On
 * a phone the tile's card and the lists share the top of the map, one at a time.
 */
export function MapPanel({ city, mapSize }: { city: CityBean; mapSize: number }) {
  const { t } = useTranslation(['map-panel', 'common']);
  // the tile at the middle of the map (fractional while dragging, and allowed past the edge, which the map wraps)
  const [center, setCenter] = useState({ x: city.x, y: city.y });
  const [selected, setSelected] = useState<number | null>(null);
  const [list, setList] = useState<'valleys' | 'legend' | null>(null);
  const [target, setTarget] = useState<SendTarget | null>(null);
  const [moveTo, setMoveTo] = useState<{ x: number; y: number } | null>(null);
  const wide = useMediaQuery('(min-width: 1024px)');
  const wrap = (v: number) => ((v % mapSize) + mapSize) % mapSize;
  // valleys held by this city, then by the lord's other cities
  const player = usePlayer();
  const owned = new Map<number, { cityName: string; here: boolean }>();
  for (const c of player.data?.castles ?? []) if (c.id !== city.id) for (const v of c.fields) owned.set(v.id, { cityName: c.name, here: false });
  for (const v of city.fields) owned.set(v.id, { cityName: city.name, here: true });
  const release = useCommand(
    deleteValleysByTileIdMutation(),
    () => [
      getCitiesByCityIdQueryKey({ path: { cityId: city.id } }),
      getPlayerQueryKey(),
      allOf(getMapQueryKey),
      allOf(getMapTilesByTileIdQueryKey),
      getArmiesQueryKey(),
    ],
    t('release.success'),
  );
  const upgrade = useCommand(
    postValleysUpgradeMutation(),
    () => [getCitiesByCityIdQueryKey({ path: { cityId: city.id } }), allOf(getMapQueryKey), allOf(getMapTilesByTileIdQueryKey)],
    t('info.upgraded'),
  );
  // on a phone a tile's card takes the place of an open list
  const select = (id: number) => {
    setSelected(id);
    if (!wide) setList(null);
  };
  const goTo = (x: number, y: number) => {
    setCenter({ x, y });
    select(y * mapSize + x);
  };
  const pan = (dir: PanDirection) => {
    const { dx, dy } = panStep(dir);
    setCenter((c) => ({ x: c.x + dx, y: c.y + dy }));
  };
  const toggle = (which: 'valleys' | 'legend') => setList((l) => (l === which ? null : which));
  const floating = 'absolute max-h-[calc(100%-4.5rem)] overflow-y-auto';

  return (
    <div className="relative h-full min-h-80 overflow-hidden">
      <WorldMap center={center} onCenter={setCenter} mapSize={mapSize} selected={selected} onSelect={select} home={{ x: city.x, y: city.y }} owned={owned} />
      <div
        role="toolbar"
        aria-label={t('toolbar')}
        className="absolute top-2 left-2 flex max-w-[calc(100%-1rem)] flex-wrap items-center gap-1 rounded-lg border bg-background/90 p-1 shadow backdrop-blur"
      >
        <span className="px-1.5 text-sm font-medium tabular-nums">{t('title', { x: wrap(Math.round(center.x)), y: wrap(Math.round(center.y)) })}</span>
        <Button size="icon-xs" variant="ghost" onClick={() => pan('left')} aria-label={t('pan.left')}>
          <ArrowLeft />
        </Button>
        <Button size="icon-xs" variant="ghost" onClick={() => pan('up')} aria-label={t('pan.up')}>
          <ArrowUp />
        </Button>
        <Button size="icon-xs" variant="ghost" onClick={() => pan('down')} aria-label={t('pan.down')}>
          <ArrowDown />
        </Button>
        <Button size="icon-xs" variant="ghost" onClick={() => pan('right')} aria-label={t('pan.right')}>
          <ArrowRight />
        </Button>
        <Button size="icon-xs" variant="ghost" onClick={() => setCenter({ x: city.x, y: city.y })} aria-label={t('pan.home')}>
          <Crosshair />
        </Button>
        <span className="mx-0.5 h-5 w-px bg-border" />
        <Button
          size="xs"
          variant={list === 'valleys' ? 'secondary' : 'ghost'}
          aria-pressed={list === 'valleys'}
          onClick={() => toggle('valleys')}
          className="gap-1"
        >
          <MapPin />
          <span className="tabular-nums">{city.fields.length}</span>
          <span className="sr-only">{t('held.title', { city: city.name })}</span>
        </Button>
        <Button
          size="icon-xs"
          variant={list === 'legend' ? 'secondary' : 'ghost'}
          aria-pressed={list === 'legend'}
          onClick={() => toggle('legend')}
          aria-label={t('legend.title')}
        >
          <Info />
        </Button>
      </div>
      {list === 'valleys' && (
        <HeldValleys
          city={city}
          onGoTo={goTo}
          onRelease={(tileId) => release.mutateAsync({ path: { tileId } })}
          releasing={release.isPending}
          className={cn(floating, 'top-14 left-2 w-[min(24rem,calc(100%-1rem))]')}
        />
      )}
      {list === 'legend' && <MapLegend className={cn(floating, 'top-14 left-2 w-[min(22rem,calc(100%-1rem))]')} />}
      {selected != null && (
        <TileCard
          key={selected}
          city={city}
          tileId={selected}
          here={!!owned.get(selected)?.here}
          onClose={() => setSelected(null)}
          onSend={setTarget}
          onMoveTo={setMoveTo}
          onRelease={(tileId) => release.mutateAsync({ path: { tileId } })}
          releasing={release.isPending}
          onUpgrade={(tileId) => upgrade.mutateAsync({ path: { tileId }, body: { cityId: city.id } })}
          upgrading={upgrade.isPending}
          className={cn(floating, 'inset-x-2 top-14 lg:top-2 lg:right-2 lg:left-auto lg:w-88', list && 'hidden lg:grid')}
        />
      )}
      <SendArmyDialog city={city} target={target} onClose={() => setTarget(null)} />
      <CityDialog
        key={moveTo ? `${moveTo.x},${moveTo.y}` : 'none'}
        city={city}
        open={moveTo != null}
        target={moveTo ?? undefined}
        onClose={() => setMoveTo(null)}
      />
    </div>
  );
}
