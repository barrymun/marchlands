import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { getArmiesOptions } from '@marchlands/api-client';
import { factionOfZone, Relation, stateOf } from '@marchlands/core';

import { useAnimations } from '@/components/iso-anim/hooks';
import { TILE_H, TILE_W } from '@/components/iso-viewport/constants';
import type { Viewport } from '@/components/iso-viewport/hooks';
import { IsoViewport } from '@/components/iso-viewport/iso-viewport';
import type { Piece } from '@/components/iso-viewport/types';
import { spriteBox } from '@/components/iso-viewport/utils';
import { GRASS, RELATION_STYLE } from '@/components/map-panel/constants';
import type { FarmMark } from '@/components/map-panel/types';
import { relationGroup } from '@/components/map-panel/utils';
import { placeName } from '@/components/map-panel/utils';
import { wrap } from '@/components/map-panel/utils';
import { FARM_OUTLINE } from '@/components/map-panel/world-map/constants';
import type { WorldMapData } from '@/components/map-panel/world-map/hooks';
import { useStateRulers } from '@/hooks/use-state-rulers';
import { FACTION_STYLE } from '@/lib/factions';
import { cn } from '@/lib/utils';

/**
 * The world map, isometric like the original: continuous grass with every valley, castle and barbarian camp standing
 * on it, in a viewport (drag, zoom with the buttons, wheel or pinch; it loads the squares coming into view and wraps
 * round the world's edge). Your valleys, other players' valleys, your farming lists' targets (`farms`, dashed), your
 * city and the selected tile are outlined; players' castles carry their flag and name, and the tile under the pointer
 * is named with its level, its holder and the cities farming it.
 * With `factions` on, the land is tinted by the faction holding each zone.
 */
export function WorldMap({
  vp,
  map,
  mapSize,
  selected,
  hover,
  home,
  owned,
  farms,
  factions,
}: {
  vp: Viewport;
  map: WorldMapData;
  mapSize: number;
  selected: number | null;
  hover: { x: number; y: number } | null;
  home: { x: number; y: number };
  owned: ReadonlyMap<number, { cityName: string; here: boolean }>;
  farms: ReadonlyMap<number, FarmMark>;
  factions: boolean;
}) {
  const { t } = useTranslation(['map-panel', 'common']);
  const { area, tiles, sprites, idOf } = map;
  const zoom = vp.camera?.zoom ?? 1;
  const hoverId = hover ? idOf(hover.x, hover.y) : null;
  const anchor = -spriteBox().top;
  const shown = sprites.map((s) => (s.id === hoverId ? { ...s, tone: 'lit' as const } : s));

  // the map at a moment, once the animation code has loaded: campfires and glints on the tiles, a worker on each of the
  // player's valleys, and the armies the player can see on the march, back to front; and the sky over the camera's state
  const anim = useAnimations();
  const rulers = useStateRulers();
  const armies = useQuery({ ...getArmiesOptions(), enabled: !!anim });
  const marching = [
    ...(armies.data?.self ?? []).map((army) => ({ army, side: 'own' as const })),
    ...(armies.data?.friend ?? []).map((army) => ({ army, side: 'ally' as const })),
    ...(armies.data?.enemy ?? []).map((army) => ({ army, side: 'enemy' as const })),
  ];
  const near = vp.camera ?? { x: home.x, y: home.y };
  const animate = anim
    ? (t: number): Piece[] => {
        const layers: { depth: number; pieces: Piece[] }[] = shown.map((s) => ({
          depth: s.col + s.row,
          pieces: s.file ? [s, ...anim.ambientOverlays({ key: s.key, col: s.col, row: s.row, file: s.file }, t)] : [s],
        }));
        const valleys = tiles.filter((d) => owned.has(d.id) && d.info).map((d) => ({ key: `v${d.id}`, col: d.x, row: d.y }));
        for (const w of anim.workerOverlays(valleys, t)) layers.push({ depth: w.col + w.row + 0.01, pieces: [w] });
        for (const a of anim.armyOverlays(marching, mapSize, { col: near.x, row: near.y }, t)) layers.push({ depth: a.col + a.row + 0.02, pieces: [a] });
        return layers.sort((a, b) => a.depth - b.depth).flatMap((l) => l.pieces);
      }
    : undefined;
  const sky = anim ? (t: number) => anim.skyAt(anim.zoneOf({ col: near.x, row: near.y }, mapSize), t, vp.view.w, vp.view.h) : undefined;
  const diamond = (x: number, y: number) => {
    const p = vp.at(x, y);
    const [w, h] = [(TILE_W / 2) * zoom, (TILE_H / 2) * zoom];
    return `${p.x},${p.y - h} ${p.x + w},${p.y} ${p.x},${p.y + h} ${p.x - w},${p.y}`;
  };

  // what a tile is, for its hover label: a castle by name and player, a camp, or a valley with its holder
  const describe = (x: number, y: number) => {
    const id = idOf(x, y);
    const castle = area.castles.get(id);
    const info = area.tiles.get(id);
    if (castle && !castle.npc) return t('tile.castle', { name: castle.name ?? '', player: castle.userName ?? '' });
    if (!info) return t('tile.loading', { x: wrap(x, mapSize), y: wrap(y, mapSize) });
    const held = owned.get(id);
    const foreign = area.valleys.get(id);
    const farmed = farms.get(id);
    return [
      t('tile.summary', {
        type: placeName({ type: info.type, x: wrap(x, mapSize), y: wrap(y, mapSize) }),
        level: info.level,
        x: wrap(x, mapSize),
        y: wrap(y, mapSize),
      }),
      held && t('tile.heldByYou', { city: held.cityName }),
      !held &&
        foreign &&
        foreign.relation !== Relation.SELF &&
        (foreign.allianceName
          ? t('tile.heldByAlliance', { city: foreign.cityName, player: foreign.userName, alliance: foreign.allianceName })
          : t('tile.heldBy', { city: foreign.cityName, player: foreign.userName })),
      farmed && t('tile.farmedBy', { cities: farmed.cities.join(t('common:list.separator')) }),
    ]
      .filter(Boolean)
      .join(' · ');
  };

  // outlines: other players' valleys by relation, your valleys, your farm targets (dashed), your city, then the selection on top
  const outlines = tiles.flatMap((d) => {
    const held = owned.get(d.id);
    const foreign = !held ? area.valleys.get(d.id) : undefined;
    const farmed = farms.get(d.id);
    const lines: { key: string; className: string; width: number; dash?: string }[] = [];
    if (foreign && foreign.relation !== Relation.SELF) lines.push({ key: 'f', className: RELATION_STYLE[relationGroup(foreign.relation)].stroke, width: 2 });
    if (held) lines.push({ key: 'h', className: held.here ? 'stroke-fuchsia-500' : 'stroke-violet-300', width: held.here ? 3 : 2 });
    if (farmed) lines.push({ key: 'r', ...(farmed.here ? FARM_OUTLINE.here : FARM_OUTLINE.other) });
    if (wrap(d.x, mapSize) === home.x && wrap(d.y, mapSize) === home.y) lines.push({ key: 'c', className: 'stroke-amber-400', width: 2.5 });
    if (d.id === selected) lines.push({ key: 's', className: 'stroke-primary', width: 2.5 });
    return lines.map((l) => ({ ...l, key: `${d.x},${d.y}${l.key}`, x: d.x, y: d.y }));
  });

  return (
    <IsoViewport
      vp={vp}
      label={t('aria')}
      className="bg-[#7c9c4c]"
      ground={tiles.map((d) => ({ key: `g${d.x},${d.y}`, col: d.x, row: d.y, src: GRASS }))}
      sprites={shown}
      animate={animate}
      sky={sky}
    >
      <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden>
        {factions &&
          tiles.map((d) => {
            const zone = stateOf(d.id, mapSize);
            // a state a player rules is no faction's
            const f = rulers.has(zone) ? null : factionOfZone(zone);
            return f && <polygon key={`z${d.x},${d.y}`} points={diamond(d.x, d.y)} className={FACTION_STYLE[f.id].tint} />;
          })}
        {outlines.map((o) => (
          <polygon key={o.key} points={diamond(o.x, o.y)} className={cn('fill-none', o.className)} strokeWidth={o.width} strokeDasharray={o.dash} />
        ))}
        {hover && <polygon points={diamond(hover.x, hover.y)} className="fill-white/10 stroke-amber-200" strokeWidth={1.5} />}
      </svg>
      {tiles.map((d) => {
        const castle = d.info && area.castles.get(d.id);
        if (!castle || castle.npc) return null;
        const p = vp.at(d.x, d.y);
        return (
          <span
            key={`${d.x},${d.y}`}
            aria-hidden
            className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-full items-center gap-1 rounded-sm bg-background/85 py-0.5 pr-1.5 pl-0.5 text-[11px] leading-4 font-medium whitespace-nowrap"
            style={{ left: p.x, top: p.y - (anchor - 8) * zoom }}
          >
            {castle.flag && <span className="rounded-[3px] bg-red-700 px-1 text-xs leading-5 font-bold tracking-wide text-white shadow-sm">{castle.flag}</span>}
            {castle.name}
          </span>
        );
      })}
      {hover && (
        <span
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded bg-popover px-1.5 py-0.5 text-xs whitespace-nowrap text-popover-foreground shadow"
          style={{ left: vp.at(hover.x, hover.y).x, top: vp.at(hover.x, hover.y).y - (anchor - 4) * zoom }}
        >
          {describe(hover.x, hover.y)}
        </span>
      )}
    </IsoViewport>
  );
}
