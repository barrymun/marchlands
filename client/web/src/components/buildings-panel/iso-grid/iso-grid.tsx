import { Plus } from 'lucide-react';
import { type MouseEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { BuildingBean } from '@marchlands/api-client';
import { BuildingType } from '@marchlands/core';

import { BUILDING_ART, CITY_ART } from '@/components/buildings-panel/constants';
import { HEADROOM, TILE_H, TILE_W } from '@/components/buildings-panel/iso-grid/constants';
import type { IsoLayout, IsoSprite, IsoTile } from '@/components/buildings-panel/iso-grid/types';
import { buildingSprites, depthOf, gridBounds, hitTest, markerOf, spriteBox, tilePoint } from '@/components/buildings-panel/iso-grid/utils';
import { Countdown } from '@/components/countdown/countdown';
import { opaqueAt, useImages } from '@/hooks/use-images';
import { artBand, buildingArtFile, cityGroundFile, grandTownHallFile } from '@/lib/game-art';
import { buildingName } from '@/lib/game-data';
import { cn } from '@/lib/utils';

/**
 * Building slots laid out as an isometric diamond, as wide as its card: the ground, the buildings standing on it and
 * any `extra` sprites (the walls) are drawn back to front on one canvas at the art's own size, which the browser then
 * scales to the card's width, pixels kept square and sharp; the height follows, up to the screen's height below the
 * header (HEADROOM), past which the height decides the width instead. Everything over the art (level numbers,
 * the hover outline and label, the buttons) is placed in percentages, so it follows any width. A click picks the
 * building whose pixels are under the pointer, else the tile; every slot is also a focusable button, so the keyboard
 * reaches them all. Each building's level shows small on its tile's front corner (on the grass, not over the building),
 * with the time left while it is built.
 */
export function IsoGrid({
  layout,
  extra = [],
  byPos,
  onSelect,
  outlined,
}: {
  layout: IsoLayout;
  extra?: readonly IsoSprite[];
  byPos: ReadonlyMap<number, BuildingBean>;
  onSelect: (pos: number) => void;
  /** Draw a dashed line round the ground (the town before its walls are built). */
  outlined?: boolean;
}) {
  const { t } = useTranslation(['buildings-panel', 'common']);
  const { tiles, ground } = layout;
  const [hover, setHover] = useState<number | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const built = (pos?: number) => {
    const b = pos != null ? byPos.get(pos) : undefined;
    return b && b.typeId !== 0 ? b : undefined;
  };
  // a tile's name, on its button and over it on hover: the building and its level, the Walls to build, or the slot
  const label = (tile: IsoTile, b?: BuildingBean) =>
    b
      ? t('slot.building', { name: buildingName(b.typeId), level: b.level })
      : tile.kind === 'gate'
        ? buildingName(BuildingType.WALLS)
        : t('slot.build', { pos: tile.pos });
  const artOf = (type: number, level: number, span: number) =>
    span === 2 ? CITY_ART[grandTownHallFile(artBand(level))] : BUILDING_ART[buildingArtFile(type, artBand(level))];
  const sprites = [...buildingSprites(tiles, byPos, artOf), ...extra].sort((a, b) => a.depth - b.depth);
  const markers = tiles.flatMap((tile) => {
    const m = markerOf(tile, !!built(tile.pos));
    return m ? [{ col: tile.col, row: tile.row, src: CITY_ART[cityGroundFile(m)] }] : [];
  });
  const grass = CITY_ART[cityGroundFile('grass')];
  const images = useImages([grass, ...markers.map((m) => m.src), ...sprites.map((s) => s.src)]);
  const bounds = gridBounds([...ground, ...tiles.map((tile) => ({ ...tile, size: (tile.span ?? 1) * 64 })), ...extra]);
  const { width: W, height: H } = bounds;

  // the art, at its own size; the canvas is scaled by CSS
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);
    const draw = (src: string, col: number, row: number, size?: number, lit = false) => {
      const img = images.get(src);
      if (!img) return;
      const p = tilePoint(col, row);
      const box = spriteBox(size);
      ctx.filter = lit ? 'brightness(1.15)' : 'none';
      ctx.drawImage(img, bounds.originX + p.x + box.left, bounds.originY + p.y + box.top);
    };
    for (const g of ground) draw(grass, g.col, g.row);
    for (const m of markers) draw(m.src, m.col, m.row);
    for (const s of sprites) draw(s.src, s.col, s.row, s.size, s.pos != null && s.pos === hover);
    ctx.filter = 'none';
  });

  // positions over the art, as percentages of its width and height
  const x = (px: number) => `${(px / W) * 100}%`;
  const y = (px: number) => `${(px / H) * 100}%`;
  const at = (col: number, row: number) => {
    const p = tilePoint(col, row);
    return { x: bounds.originX + p.x, y: bounds.originY + p.y };
  };
  const pick = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const p = { x: ((e.clientX - r.left) / r.width) * W - bounds.originX, y: ((e.clientY - r.top) / r.height) * H - bounds.originY };
    return hitTest(p, sprites, tiles, opaqueAt);
  };
  const hovered = tiles.find((tile) => tile.pos != null && tile.pos === hover && tile.kind !== 'locked');
  const corners = (pts: { x: number; y: number }[]) => pts.map((p) => `${p.x},${p.y}`).join(' ');
  const diamond = (tile: IsoTile) => {
    const p = at(tile.col, tile.row);
    const [w, h] = [(TILE_W / 2) * (tile.span ?? 1), (TILE_H / 2) * (tile.span ?? 1)];
    return corners([
      { x: p.x, y: p.y - h },
      { x: p.x + w, y: p.y },
      { x: p.x, y: p.y + h },
      { x: p.x - w, y: p.y },
    ]);
  };
  // the dashed line round the town: the edge of its ground
  const outline = () => corners([at(-0.5, -0.5), at(layout.cols - 0.5, -0.5), at(layout.cols - 0.5, layout.rows - 0.5), at(-0.5, layout.rows - 0.5)]);

  return (
    <div
      className={cn('relative mx-auto', hover != null && 'cursor-pointer')}
      // as wide as the card, but never taller than the screen below the header: on a wide screen the height decides
      style={{ width: `min(100%, calc((100svh - ${HEADROOM}) * ${W / H}))` }}
      onPointerMove={(e) => setHover(pick(e) ?? null)}
      onPointerLeave={() => setHover(null)}
      onClick={(e) => {
        const pos = pick(e);
        if (pos != null) onSelect(pos);
      }}
    >
      <canvas ref={canvas} width={W} height={H} className="block h-auto w-full [image-rendering:pixelated]" />
      {(outlined || hovered) && (
        <svg className="pointer-events-none absolute inset-0 size-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
          {outlined && (
            <polygon
              points={outline()}
              className="fill-none stroke-muted-foreground"
              strokeWidth={1.5}
              strokeDasharray="6 4"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {hovered && <polygon points={diamond(hovered)} className="fill-white/10 stroke-amber-300" strokeWidth={2} vectorEffect="non-scaling-stroke" />}
        </svg>
      )}
      {tiles.map((tile) => {
        const b = built(tile.pos);
        const p = at(tile.col, tile.row);
        if (!b && tile.kind === 'gate')
          return (
            <span
              key={`c${tile.pos}`}
              className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-md border border-dashed bg-background/85 px-2 py-1 text-xs text-muted-foreground"
              style={{ left: x(p.x), top: y(p.y) }}
            >
              <Plus className="size-3.5" />
              {buildingName(BuildingType.WALLS)}
            </span>
          );
        if (!b) return null;
        // the level, small, on the tile's front corner: on the grass in front of the building rather than over it (the
        // hover label names the building and its level in full)
        return (
          <div
            key={`c${tile.pos}`}
            aria-hidden
            className="pointer-events-none absolute flex -translate-x-1/2 flex-col items-center gap-0.5"
            style={{ left: x(p.x), top: y(p.y + (TILE_H / 2) * (tile.span ?? 1) - 5) }}
          >
            <span
              className={cn(
                'min-w-4 rounded-sm bg-background/80 px-0.5 text-center text-[9px] leading-3 font-medium tabular-nums',
                b.status !== 0 && 'ring-1 ring-amber-500',
              )}
            >
              {b.level}
            </span>
            {b.status !== 0 && (
              <span className="rounded-sm bg-background/80 px-0.5 text-[9px] leading-3 whitespace-nowrap text-amber-600 tabular-nums">
                <Countdown endTime={b.endTime} />
              </span>
            )}
          </div>
        );
      })}
      {hovered && (
        <span
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded bg-popover px-1.5 py-0.5 text-xs whitespace-nowrap text-popover-foreground shadow"
          style={{ left: x(at(hovered.col, hovered.row).x), top: y(at(hovered.col, hovered.row).y + spriteBox((hovered.span ?? 1) * 64).top + 8) }}
        >
          {label(hovered, built(hovered.pos))}
        </span>
      )}
      {tiles
        .filter((tile) => (tile.kind === 'slot' || tile.kind === 'gate') && tile.pos != null)
        .sort((a, b) => depthOf(a.col, a.row) - depthOf(b.col, b.row))
        .map((tile) => {
          const p = at(tile.col, tile.row);
          const span = tile.span ?? 1;
          return (
            <button
              key={`k${tile.pos}`}
              aria-label={label(tile, built(tile.pos))}
              className="pointer-events-none absolute opacity-0"
              style={{ left: x(p.x - (TILE_W / 4) * span), top: y(p.y - (TILE_H / 4) * span), width: x((TILE_W / 2) * span), height: y((TILE_H / 2) * span) }}
              onFocus={() => setHover(tile.pos!)}
              onBlur={() => setHover(null)}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(tile.pos!);
              }}
            />
          );
        })}
    </div>
  );
}
