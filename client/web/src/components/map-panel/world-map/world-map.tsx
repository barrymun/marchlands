import { Minus, Plus } from 'lucide-react';
import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Relation } from '@marchlands/core';

import { GRASS, RELATION_STYLE, TILE_ART } from '@/components/map-panel/constants';
import { relationGroup } from '@/components/map-panel/utils';
import { ANCHOR, DRAG_SLOP, SPRITE, TILE_H, TILE_W } from '@/components/map-panel/world-map/constants';
import { useMapArea, useSize } from '@/components/map-panel/world-map/hooks';
import type { PanDirection } from '@/components/map-panel/world-map/types';
import { chunksFor, dragged, nextZoom, panStep, pickTile, startZoom, tileOrigin, visibleTiles, wrap } from '@/components/map-panel/world-map/utils';
import { Button } from '@/components/ui/button';
import { opaqueAt, useImages } from '@/hooks/use-images';
import { artBand, tileArtFile } from '@/lib/game-art';
import { tileName } from '@/lib/game-data';
import { cn } from '@/lib/utils';

const KEYS: Record<string, PanDirection> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

/**
 * The world map, isometric like the original: continuous grass with every valley, castle and barbarian camp standing
 * on it, drawn on a canvas that fills the view at a zoom landing on whole device pixels. Drag it (mouse or finger) to
 * look round; it loads the squares coming into view and wraps round the world's edge. A click (a press that hardly
 * moves) picks the tile under the pointer, by the sprite's pixels first. Your valleys, other players' valleys, your
 * city and the selected tile are outlined, and players' castles carry their flag and name; a tile's level shows in its
 * hover label.
 * The arrow keys move the map, + and - zoom.
 */
export function WorldMap({
  center,
  onCenter,
  mapSize,
  selected,
  onSelect,
  home,
  owned,
}: {
  center: { x: number; y: number };
  onCenter: (c: { x: number; y: number }) => void;
  mapSize: number;
  selected: number | null;
  onSelect: (tileId: number) => void;
  home: { x: number; y: number };
  owned: ReadonlyMap<number, { cityName: string; here: boolean }>;
}) {
  const { t } = useTranslation(['map-panel', 'common']);
  const [ref, size] = useSize<HTMLDivElement>();
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; from: { x: number; y: number }; moved: boolean } | null>(null);
  const [chosenZoom, setZoom] = useState<number | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  const view = { w: size.w, h: size.h, dpr };
  const cam = { x: center.x, y: center.y, zoom: chosenZoom ?? startZoom(size.w, dpr) };
  const unit = { ...view, dpr: 1 };
  const idOf = (x: number, y: number) => wrap(y, mapSize) * mapSize + wrap(x, mapSize);

  const visible = size.w ? visibleTiles(cam, view) : [];
  const area = useMapArea(chunksFor(visible, mapSize), mapSize);
  const drawn = visible.map((v) => {
    const id = idOf(v.x, v.y);
    const info = area.tiles.get(id);
    return { ...v, id, info, src: info ? TILE_ART[tileArtFile(info.type, artBand(info.level))] : undefined };
  });
  const grass = GRASS;
  const images = useImages([grass, ...drawn.flatMap((d) => (d.src ? [d.src] : []))]);
  const hoverId = hover ? idOf(hover.x, hover.y) : null;

  // the art, in device pixels: grass under every tile, then each tile's sprite, back to front
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    const k = cam.zoom * dpr;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    const draw = (src: string | undefined, x: number, y: number, lit = false) => {
      const img = src && images.get(src);
      if (!img) return;
      const p = tileOrigin(x, y, cam, view);
      ctx.filter = lit ? 'brightness(1.15)' : 'none';
      ctx.drawImage(img, p.x - ANCHOR.x * k, p.y - ANCHOR.y * k, SPRITE * k, SPRITE * k);
    };
    for (const d of drawn) draw(grass, d.x, d.y);
    for (const d of drawn) draw(d.src, d.x, d.y, d.id === hoverId);
    ctx.filter = 'none';
  });

  const at = (x: number, y: number) => tileOrigin(x, y, cam, unit);
  const pick = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return pickTile(e.clientX - r.left, e.clientY - r.top, drawn, cam, view, opaqueAt);
  };
  const diamond = (x: number, y: number) => {
    const p = at(x, y);
    const [w, h] = [(TILE_W / 2) * cam.zoom, (TILE_H / 2) * cam.zoom];
    return `${p.x},${p.y - h} ${p.x + w},${p.y} ${p.x},${p.y + h} ${p.x - w},${p.y}`;
  };
  const pan = (dir: PanDirection, n = 1) => {
    const { dx, dy } = panStep(dir, n);
    onCenter({ x: center.x + dx, y: center.y + dy });
  };
  const zoomBy = (step: 1 | -1) => setZoom(nextZoom(cam.zoom, step, dpr));

  // what a tile is, for its hover label: a castle by name and player, a camp, or a valley with its holder
  const describe = (x: number, y: number) => {
    const id = idOf(x, y);
    const castle = area.castles.get(id);
    const info = area.tiles.get(id);
    if (castle && !castle.npc) return t('tile.castle', { name: castle.name ?? '', player: castle.userName ?? '' });
    if (!info) return t('tile.loading', { x: wrap(x, mapSize), y: wrap(y, mapSize) });
    const held = owned.get(id);
    const foreign = area.valleys.get(id);
    return [
      t('tile.summary', { type: tileName(info.type), level: info.level, x: wrap(x, mapSize), y: wrap(y, mapSize) }),
      held && t('tile.heldByYou', { city: held.cityName }),
      !held &&
        foreign &&
        foreign.relation !== Relation.SELF &&
        (foreign.allianceName
          ? t('tile.heldByAlliance', { city: foreign.cityName, player: foreign.userName, alliance: foreign.allianceName })
          : t('tile.heldBy', { city: foreign.cityName, player: foreign.userName })),
    ]
      .filter(Boolean)
      .join(' · ');
  };

  // outlines: other players' valleys by relation, your valleys, your city, then the selection on top
  const outlines = drawn.flatMap((d) => {
    const held = owned.get(d.id);
    const foreign = !held ? area.valleys.get(d.id) : undefined;
    const lines: { key: string; className: string; width: number }[] = [];
    if (foreign && foreign.relation !== Relation.SELF) lines.push({ key: 'f', className: RELATION_STYLE[relationGroup(foreign.relation)].stroke, width: 2 });
    if (held) lines.push({ key: 'h', className: held.here ? 'stroke-fuchsia-500' : 'stroke-violet-300', width: held.here ? 3 : 2 });
    if (wrap(d.x, mapSize) === home.x && wrap(d.y, mapSize) === home.y) lines.push({ key: 'c', className: 'stroke-amber-400', width: 2.5 });
    if (d.id === selected) lines.push({ key: 's', className: 'stroke-primary', width: 2.5 });
    return lines.map((l) => ({ ...l, key: `${d.x},${d.y}${l.key}`, x: d.x, y: d.y }));
  });

  return (
    <div
      ref={ref}
      tabIndex={0}
      role="application"
      aria-label={t('aria')}
      className="relative h-[min(65vh,640px)] min-h-72 w-full cursor-grab touch-none overflow-hidden rounded-md border bg-[#7c9c4c] outline-none select-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, y: e.clientY, from: center, moved: false };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (d) {
          const [dx, dy] = [e.clientX - d.x, e.clientY - d.y];
          if (!d.moved && Math.hypot(dx, dy) < DRAG_SLOP) return;
          d.moved = true;
          const next = dragged({ ...cam, ...d.from }, dx, dy);
          onCenter({ x: next.x, y: next.y });
          return;
        }
        setHover(pick(e) ?? null);
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        drag.current = null;
        if (d && !d.moved) {
          const tile = pick(e);
          if (tile) onSelect(idOf(tile.x, tile.y));
        }
      }}
      onPointerCancel={() => (drag.current = null)}
      onPointerLeave={() => setHover(null)}
      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
        if (KEYS[e.key]) pan(KEYS[e.key]);
        else if (e.key === '+' || e.key === '=') zoomBy(1);
        else if (e.key === '-') zoomBy(-1);
        else if (e.key === 'Enter') onSelect(idOf(Math.round(center.x), Math.round(center.y)));
        else return;
        e.preventDefault();
      }}
    >
      <canvas
        ref={canvas}
        width={Math.round(size.w * dpr)}
        height={Math.round(size.h * dpr)}
        className="absolute inset-0 size-full [image-rendering:pixelated]"
      />
      <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden>
        {outlines.map((o) => (
          <polygon key={o.key} points={diamond(o.x, o.y)} className={cn('fill-none', o.className)} strokeWidth={o.width} />
        ))}
        {hover && <polygon points={diamond(hover.x, hover.y)} className="fill-white/10 stroke-amber-200" strokeWidth={1.5} />}
      </svg>
      {drawn.map((d) => {
        if (!d.info) return null;
        const p = at(d.x, d.y);
        const castle = area.castles.get(d.id);
        return (
          <div key={`${d.x},${d.y}`} aria-hidden className="pointer-events-none">
            {castle && !castle.npc && (
              <span
                className="absolute flex -translate-x-1/2 -translate-y-full items-center gap-1 rounded-sm bg-background/85 px-1 text-[10px] leading-4 font-medium whitespace-nowrap"
                style={{ left: p.x, top: p.y - (ANCHOR.y - 8) * cam.zoom }}
              >
                {castle.flag && <span className="rounded-[2px] bg-red-700 px-0.5 text-[9px] text-white">{castle.flag}</span>}
                {castle.name}
              </span>
            )}
          </div>
        );
      })}
      {hover && (
        <span
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded bg-popover px-1.5 py-0.5 text-xs whitespace-nowrap text-popover-foreground shadow"
          style={{ left: at(hover.x, hover.y).x, top: at(hover.x, hover.y).y - (ANCHOR.y - 4) * cam.zoom }}
        >
          {describe(hover.x, hover.y)}
        </span>
      )}
      <div className="absolute right-2 bottom-2 flex flex-col gap-1" onPointerDown={(e) => e.stopPropagation()}>
        <Button size="icon-xs" variant="secondary" onClick={() => zoomBy(1)} aria-label={t('zoom.in')}>
          <Plus />
        </Button>
        <Button size="icon-xs" variant="secondary" onClick={() => zoomBy(-1)} aria-label={t('zoom.out')}>
          <Minus />
        </Button>
      </div>
    </div>
  );
}
