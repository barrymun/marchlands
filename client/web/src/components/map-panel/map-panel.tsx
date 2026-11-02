import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Crosshair, Info, MapPin, Swords } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type CityBean,
  deleteValleysByTileIdMutation,
  getArmiesQueryKey,
  getCitiesByCityIdQueryKey,
  getMapQueryKey,
  getMapTilesByTileIdQueryKey,
  getPlayerFlowsOptions,
  getPlayerQueryKey,
  postValleysUpgradeMutation,
} from '@marchlands/api-client';

import { CityDialog } from '@/components/city-dialog/city-dialog';
import { useIsoViewport } from '@/components/iso-viewport/hooks';
import type { PanDirection, ViewPoint } from '@/components/iso-viewport/types';
import { panStep, spriteAt, tileAt } from '@/components/iso-viewport/utils';
import { FarmTargets } from '@/components/map-panel/farm-targets/farm-targets';
import { GoToCoords } from '@/components/map-panel/go-to-coords/go-to-coords';
import { HeldValleys } from '@/components/map-panel/held-valleys/held-valleys';
import { MapLegend } from '@/components/map-panel/map-legend/map-legend';
import { TileCard } from '@/components/map-panel/tile-card/tile-card';
import { farmedTiles, farmLists, readFactionTint, saveFactionTint } from '@/components/map-panel/utils';
import { PAN_STEP } from '@/components/map-panel/world-map/constants';
import { useWorldMap } from '@/components/map-panel/world-map/hooks';
import { startZoom } from '@/components/map-panel/world-map/utils';
import { WorldMap } from '@/components/map-panel/world-map/world-map';
import { SendArmyDialog } from '@/components/send-army-dialog/send-army-dialog';
import type { SendTarget } from '@/components/send-army-dialog/types';
import { Button } from '@/components/ui/button';
import { useCommand, usePlayer } from '@/hooks/use-game';
import { opaqueAt } from '@/hooks/use-images';
import { useMediaQuery } from '@/hooks/use-media-query';
import { allOf } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

/**
 * The world map filling the viewport, everything else floating over it: a toolbar (where the map is, which opens a box
 * to go to any coordinates, the arrows, back to the city, this city's valleys, the farming lists, the key), the selected
 * tile's card, and the valleys, the farming lists or the key when asked for. On a phone the tile's card and the lists share the top of the map, one at a
 * time.
 */
export function MapPanel({ city, mapSize }: { city: CityBean; mapSize: number }) {
  const { t } = useTranslation(['map-panel', 'common']);
  const [selected, setSelected] = useState<number | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [list, setList] = useState<'valleys' | 'farms' | 'legend' | null>(null);
  const [factions, setFactions] = useState(readFactionTint);
  const [target, setTarget] = useState<SendTarget | null>(null);
  const [moveTo, setMoveTo] = useState<{ x: number; y: number } | null>(null);
  const wide = useMediaQuery('(min-width: 1024px)');
  const wrap = (v: number) => ((v % mapSize) + mapSize) % mapSize;
  // the camera starts on the city, at a zoom wide enough to look round; it may go past the edge, which the map wraps
  const vp = useIsoViewport({
    start: (view) => ({ x: city.x, y: city.y, zoom: startZoom(view.w, view.dpr) }),
    resetKey: city.id,
    onTap: (p) => {
      const tile = pick(p);
      if (tile) select(map.idOf(tile.x, tile.y));
    },
    onHover: (p) => setHover(p ? (pick(p) ?? null) : null),
    onEnter: () => vp.camera && select(map.idOf(Math.round(vp.camera.x), Math.round(vp.camera.y))),
  });
  const map = useWorldMap(vp, mapSize);
  /** The tile under a point: the front-most sprite with a pixel there, else the tile whose diamond holds it. */
  const pick = (p: ViewPoint) => {
    if (!vp.camera) return undefined;
    const sprite = spriteAt(p, map.sprites, vp.camera, vp.view, opaqueAt);
    if (sprite) return { x: sprite.col, y: sprite.row };
    const t = tileAt(p, vp.camera, vp.view);
    return { x: Math.round(t.x), y: Math.round(t.y) };
  };
  const centre = vp.camera ?? { x: city.x, y: city.y };
  // valleys held by this city, then by the lord's other cities
  const player = usePlayer();
  const owned = new Map<number, { cityName: string; here: boolean }>();
  for (const c of player.data?.castles ?? []) if (c.id !== city.id) for (const v of c.fields) owned.set(v.id, { cityName: c.name, here: false });
  for (const v of city.fields) owned.set(v.id, { cityName: city.name, here: true });
  // the farming lists (flows' attack targets): this city's, then the lord's other cities'
  const flows = useQuery(getPlayerFlowsOptions());
  const farms = farmLists(flows.data ?? [], player.data?.castles ?? [], city.id);
  const farmed = farmedTiles(farms);
  const farmedHere = farms.find((l) => l.here)?.targets.length ?? 0;
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
    vp.centreOn(x, y);
    select(y * mapSize + x);
  };
  const pan = (dir: PanDirection) => {
    const { dx, dy } = panStep(dir, PAN_STEP);
    vp.panBy(dx, dy);
  };
  const toggle = (which: 'valleys' | 'farms' | 'legend') => setList((l) => (l === which ? null : which));
  const tintFactions = (on: boolean) => {
    setFactions(on);
    saveFactionTint(on);
  };
  const floating = 'absolute max-h-[calc(100%-4.5rem)] overflow-y-auto';

  return (
    <div className="relative h-full min-h-80 overflow-hidden">
      <WorldMap
        vp={vp}
        map={map}
        mapSize={mapSize}
        selected={selected}
        hover={hover}
        home={{ x: city.x, y: city.y }}
        owned={owned}
        farms={farmed}
        factions={factions}
      />
      <div
        role="toolbar"
        aria-label={t('toolbar')}
        className="absolute top-2 left-2 flex max-w-[calc(100%-1rem)] flex-wrap items-center gap-1 rounded-lg border bg-background/90 p-1 shadow backdrop-blur"
      >
        <GoToCoords x={wrap(Math.round(centre.x))} y={wrap(Math.round(centre.y))} mapSize={mapSize} onGoTo={goTo} />
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
        <Button size="icon-xs" variant="ghost" onClick={() => vp.centreOn(city.x, city.y)} aria-label={t('pan.home')}>
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
        <Button size="xs" variant={list === 'farms' ? 'secondary' : 'ghost'} aria-pressed={list === 'farms'} onClick={() => toggle('farms')} className="gap-1">
          <Swords />
          <span className="tabular-nums">{farmedHere}</span>
          <span className="sr-only">{t('farms.title')}</span>
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
      {list === 'farms' && (
        <FarmTargets lists={farms} mapSize={mapSize} onGoTo={goTo} className={cn(floating, 'top-14 left-2 w-[min(26rem,calc(100%-1rem))]')} />
      )}
      {list === 'legend' && (
        <MapLegend factions={factions} onFactions={tintFactions} className={cn(floating, 'top-14 left-2 w-[min(22rem,calc(100%-1rem))]')} />
      )}
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
