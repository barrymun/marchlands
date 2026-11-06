import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Castle, Crosshair, Info, MapPin, Swords } from 'lucide-react';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
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
import { MapList } from '@/components/map-panel/constants';
import { FarmTargets } from '@/components/map-panel/farm-targets/farm-targets';
import { GoToCoords } from '@/components/map-panel/go-to-coords/go-to-coords';
import { HeldValleys } from '@/components/map-panel/held-valleys/held-valleys';
import { MapLegend } from '@/components/map-panel/map-legend/map-legend';
import { OtherCities } from '@/components/map-panel/other-cities/other-cities';
import { TileCard } from '@/components/map-panel/tile-card/tile-card';
import { farmedTiles, farmLists, readFactionTint, saveFactionTint, wrap } from '@/components/map-panel/utils';
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
import { useSearchState } from '@/hooks/use-search-state';
import { allOf } from '@/lib/query-keys';
import { MAP_SEARCH } from '@/lib/screen-search';
import { cn } from '@/lib/utils';

/**
 * The world map filling the viewport, everything else floating over it: a toolbar (where the map is, which opens a box
 * to go to any coordinates, the arrows, back to the city, the player's other cities, this city's valleys, the farming
 * lists, the key), the selected tile's card, and the other cities, the valleys, the farming lists or the key when asked
 * for. On a phone the tile's card and the lists share the top of the map, one at a time.
 */
export function MapPanel({ city, mapSize }: { city: CityBean; mapSize: number }) {
  const { t } = useTranslation(['map-panel', 'common']);
  // the place last gone to (the address's `at`): the map opens there again after a reload, with it selected
  const [search, setSearch] = useSearchState(MAP_SEARCH);
  const at = search.at && { x: wrap(search.at.x, mapSize), y: wrap(search.at.y, mapSize) };
  const [selected, setSelected] = useState<number | null>(() => (at ? at.y * mapSize + at.x : null));
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [list, setList] = useState<MapList | null>(null);
  const [factions, setFactions] = useState(readFactionTint);
  const [target, setTarget] = useState<SendTarget | null>(null);
  const [moveTo, setMoveTo] = useState<{ x: number; y: number } | null>(null);
  const wide = useMediaQuery('(min-width: 1024px)');
  // the camera starts on the city, or the place last gone to, at a zoom wide enough to look round; it may go past the
  // edge, which the map wraps
  const vp = useIsoViewport({
    start: (view) => ({ ...(at ?? { x: city.x, y: city.y }), zoom: startZoom(view.w, view.dpr) }),
    resetKey: city.id,
    onTap: (p) => {
      const tile = pick(p);
      if (!tile) return;
      const id = map.idOf(tile.x, tile.y);
      select(id);
      pickedOwn(id);
    },
    onHover: (p) => setHover(p ? (pick(p) ?? null) : null),
    onEnter: () => vp.camera && select(map.idOf(Math.round(vp.camera.x), Math.round(vp.camera.y))),
  });
  const map = useWorldMap(vp, mapSize);
  // the place gone to let go of in the address (the city picked in the switcher or the city list, even this one): back
  // to the city…
  const home = !search.at;
  // …and the card of that place closes with it (a city of the player's picked on the map stays open)
  const atId = at ? at.y * mapSize + at.x : null;
  const [lastAt, setLastAt] = useState(atId);
  if (atId !== lastAt) {
    setLastAt(atId);
    if (atId == null && selected === lastAt) setSelected(null);
    else if (atId != null) setSelected(atId);
  }
  const centreOnCity = useEffectEvent(() => vp.centreOn(city.x, city.y));
  useEffect(() => {
    if (home) centreOnCity();
  }, [home]);
  // a place in the address this map didn't put there (Send army's Show on map, the map already open): it goes there too
  const placed = useRef(atId);
  const followAddress = useEffectEvent(() => {
    if (at && atId !== placed.current) vp.centreOn(at.x, at.y);
    placed.current = atId;
  });
  useEffect(() => followAddress(), [atId]);
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
  const otherCities = (player.data?.castles ?? []).filter((c) => c.id !== city.id);
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
  // after going to a place, picking one of the player's own cities on the map takes its place in the address: this city
  // lets it go (back home), another becomes it, so a reload opens there
  const pickedOwn = (tileId: number) => {
    const own = player.data?.castles.find((c) => c.fieldId === tileId);
    if (!own || !search.at) return;
    placed.current = own.id === city.id ? null : own.fieldId;
    setSearch({ at: own.id === city.id ? null : { x: own.x, y: own.y } });
  };
  // going to a place (the go-to box, a valley, a farming target, a tile card's Centre here) keeps it in the address; going
  // home lets it go
  const goTo = (x: number, y: number) => {
    vp.centreOn(x, y);
    select(y * mapSize + x);
    placed.current = y * mapSize + x;
    setSearch({ at: { x, y } });
  };
  const goHome = () => {
    vp.centreOn(city.x, city.y);
    setSearch({ at: null });
  };
  const pan = (dir: PanDirection) => {
    const { dx, dy } = panStep(dir, PAN_STEP);
    vp.panBy(dx, dy);
  };
  const toggle = (which: MapList) => setList((l) => (l === which ? null : which));
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
        className="absolute top-2 start-2 flex max-w-[calc(100%-1rem)] flex-wrap items-center gap-1 rounded-lg border bg-background/90 p-1 shadow backdrop-blur"
      >
        <GoToCoords x={wrap(Math.round(centre.x), mapSize)} y={wrap(Math.round(centre.y), mapSize)} mapSize={mapSize} onGoTo={goTo} />
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
        <Button size="icon-xs" variant="ghost" onClick={goHome} aria-label={t('pan.home')}>
          <Crosshair />
        </Button>
        <span className="mx-0.5 h-5 w-px bg-border" />
        {otherCities.length > 0 && (
          <Button
            size="xs"
            variant={list === MapList.CITIES ? 'secondary' : 'ghost'}
            aria-pressed={list === MapList.CITIES}
            onClick={() => toggle(MapList.CITIES)}
            className="gap-1"
          >
            <Castle />
            <span className="tabular-nums">{otherCities.length}</span>
            <span className="sr-only">{t('cities.title')}</span>
          </Button>
        )}
        <Button
          size="xs"
          variant={list === MapList.VALLEYS ? 'secondary' : 'ghost'}
          aria-pressed={list === MapList.VALLEYS}
          onClick={() => toggle(MapList.VALLEYS)}
          className="gap-1"
        >
          <MapPin />
          <span className="tabular-nums">{city.fields.length}</span>
          <span className="sr-only">{t('held.title', { city: city.name })}</span>
        </Button>
        <Button
          size="xs"
          variant={list === MapList.FARMS ? 'secondary' : 'ghost'}
          aria-pressed={list === MapList.FARMS}
          onClick={() => toggle(MapList.FARMS)}
          className="gap-1"
        >
          <Swords />
          <span className="tabular-nums">{farmedHere}</span>
          <span className="sr-only">{t('farms.title')}</span>
        </Button>
        <Button
          size="icon-xs"
          variant={list === MapList.LEGEND ? 'secondary' : 'ghost'}
          aria-pressed={list === MapList.LEGEND}
          onClick={() => toggle(MapList.LEGEND)}
          aria-label={t('legend.title')}
        >
          <Info />
        </Button>
      </div>
      {list === MapList.CITIES && (
        <OtherCities
          cities={otherCities}
          fromTileId={city.fieldId}
          mapSize={mapSize}
          onGoTo={goTo}
          className={cn(floating, 'top-14 start-2 w-[min(24rem,calc(100%-1rem))]')}
        />
      )}
      {list === MapList.VALLEYS && (
        <HeldValleys
          city={city}
          onGoTo={goTo}
          onRelease={(tileId) => release.mutateAsync({ path: { tileId } })}
          releasing={release.isPending}
          className={cn(floating, 'top-14 start-2 w-[min(24rem,calc(100%-1rem))]')}
        />
      )}
      {list === MapList.FARMS && (
        <FarmTargets lists={farms} mapSize={mapSize} onGoTo={goTo} className={cn(floating, 'top-14 start-2 w-[min(26rem,calc(100%-1rem))]')} />
      )}
      {list === MapList.LEGEND && (
        <MapLegend factions={factions} onFactions={tintFactions} className={cn(floating, 'top-14 start-2 w-[min(22rem,calc(100%-1rem))]')} />
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
          onCentre={goTo}
          onRelease={(tileId) => release.mutateAsync({ path: { tileId } })}
          releasing={release.isPending}
          onUpgrade={(tileId) => upgrade.mutateAsync({ path: { tileId }, body: { cityId: city.id } })}
          upgrading={upgrade.isPending}
          className={cn(floating, 'inset-x-2 top-14 lg:top-2 lg:end-2 lg:start-auto lg:w-88', list && 'hidden lg:grid')}
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
