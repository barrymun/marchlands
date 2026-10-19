import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { BuildingBean } from '@marchlands/api-client';
import { BuildingType } from '@marchlands/core';

import { BUILDING_ART, CITY_ART } from '@/components/buildings-panel/constants';
import type { IsoLayout, IsoSprite, IsoTile } from '@/components/buildings-panel/iso-grid/types';
import { buildingSprites, depthOf, hitTest, markerOf } from '@/components/buildings-panel/iso-grid/utils';
import { Countdown } from '@/components/countdown/countdown';
import { SPRITE, TILE_H, TILE_W } from '@/components/iso-viewport/constants';
import { useIsoViewport } from '@/components/iso-viewport/hooks';
import { IsoViewport } from '@/components/iso-viewport/iso-viewport';
import type { Drawable, ViewPoint } from '@/components/iso-viewport/types';
import { clampToScene, fitZoom, sceneBox, sceneCentre, spriteAt, spriteBox, tileAt } from '@/components/iso-viewport/utils';
import { opaqueAt } from '@/hooks/use-images';
import { artBand, buildingArtFile, cityGroundFile, grandTownHallFile } from '@/lib/game-art';
import { buildingName } from '@/lib/game-data';
import { cn } from '@/lib/utils';

/**
 * Building slots laid out as an isometric diamond, in a viewport filling its parent: the ground, the buildings standing
 * on it and any `extra` sprites (the walls). It opens at the largest sharp zoom that shows the whole scene, and drags,
 * zooms (buttons, wheel, pinch, keys) and resets each visit; however far it goes, at least half the scene stays in
 * view across and down. A click picks the building whose pixels are under the pointer, else the tile; every slot is
 * also a focusable button, so the keyboard reaches them all. With `highlight` (the building filter) the buildings it
 * picks stand out and the rest are dimmed. Each building's level shows small on its tile's front corner, with the time
 * left while it is built.
 */
export function IsoGrid({
  layout,
  extra = [],
  byPos,
  onSelect,
  outlined,
  highlight,
  label,
}: {
  layout: IsoLayout;
  extra?: readonly IsoSprite[];
  byPos: ReadonlyMap<number, BuildingBean>;
  onSelect: (pos: number) => void;
  /** Draw a dashed line round the ground (the town before its walls are built). */
  outlined?: boolean;
  /** The buildings to pick out (the rest are dimmed); none set, all show as they are. */
  highlight?: (b: BuildingBean) => boolean;
  /** what the scene is, for screen readers */
  label: string;
}) {
  const { t } = useTranslation(['buildings-panel', 'common']);
  const { tiles, ground } = layout;
  const [hover, setHover] = useState<number | null>(null);
  const built = (pos?: number) => {
    const b = pos != null ? byPos.get(pos) : undefined;
    return b && b.typeId !== 0 ? b : undefined;
  };
  // a tile's name, on its button and over it on hover: the building and its level, the Walls to build, or the slot
  const tileLabel = (tile: IsoTile, b?: BuildingBean) =>
    b
      ? t('slot.building', { name: buildingName(b.typeId), level: b.level })
      : tile.kind === 'gate'
        ? buildingName(BuildingType.WALLS)
        : t('slot.build', { pos: tile.pos });
  const artOf = (type: number, level: number, span: number) =>
    span === 2 ? CITY_ART[grandTownHallFile(artBand(level))] : BUILDING_ART[buildingArtFile(type, artBand(level))];
  const sprites = [...buildingSprites(tiles, byPos, artOf), ...extra].sort((a, b) => a.depth - b.depth);
  const box = sceneBox([...ground, ...tiles.map((tile) => ({ ...tile, size: (tile.span ?? 1) * SPRITE })), ...extra]);

  /** The building under a point: the front-most sprite with a pixel there, else the slot whose diamond holds it. */
  const pick = (p: ViewPoint): number | undefined => {
    const cam = vp.camera;
    if (!cam) return undefined;
    const sprite = spriteAt(
      p,
      sprites.filter((s) => s.pos != null),
      cam,
      vp.view,
      opaqueAt,
    );
    if (sprite) return sprite.pos;
    const at = tileAt(p, cam, vp.view);
    return hitTest({ x: ((at.x - at.y) * TILE_W) / 2, y: ((at.x + at.y) * TILE_H) / 2 }, [], tiles, opaqueAt);
  };
  const vp = useIsoViewport({
    start: (view) => clampToScene({ ...sceneCentre(box), zoom: fitZoom(box, view) }, box, view),
    clamp: (cam, view) => clampToScene(cam, box, view),
    onTap: (p) => {
      const pos = pick(p);
      if (pos != null) onSelect(pos);
    },
    onHover: (p) => setHover(p ? (pick(p) ?? null) : null),
  });
  const zoom = vp.camera?.zoom ?? 1;

  // with a filter, everything it does not pick is dimmed: empty plots, and buildings of other types
  const dimmed = (pos?: number) => {
    if (!highlight) return false;
    const b = built(pos);
    return !b || !highlight(b);
  };
  const groundArt: Drawable[] = [
    ...ground.map((g) => ({ key: `g${g.col},${g.row}`, col: g.col, row: g.row, src: CITY_ART[cityGroundFile('grass')] })),
    ...tiles.flatMap((tile) => {
      const m = markerOf(tile, !!built(tile.pos));
      return m ? [{ key: `m${tile.pos}`, col: tile.col, row: tile.row, src: CITY_ART[cityGroundFile(m)], tone: highlight ? ('dim' as const) : undefined }] : [];
    }),
  ];
  const spriteArt: Drawable[] = sprites.map((s) => ({
    ...s,
    tone: s.pos != null && s.pos === hover ? 'lit' : s.pos != null && byPos.has(s.pos) && s.key.startsWith('b') && dimmed(s.pos) ? 'dim' : undefined,
  }));
  const hovered = tiles.find((tile) => tile.pos != null && tile.pos === hover && tile.kind !== 'locked');
  const corners = (pts: ViewPoint[]) => pts.map((p) => `${p.x},${p.y}`).join(' ');
  const diamond = (tile: IsoTile) => {
    const p = vp.at(tile.col, tile.row);
    const [w, h] = [(TILE_W / 2) * (tile.span ?? 1) * zoom, (TILE_H / 2) * (tile.span ?? 1) * zoom];
    return corners([
      { x: p.x, y: p.y - h },
      { x: p.x + w, y: p.y },
      { x: p.x, y: p.y + h },
      { x: p.x - w, y: p.y },
    ]);
  };
  const [c1, r1] = [layout.cols - 0.5, layout.rows - 0.5];

  return (
    <IsoViewport vp={vp} label={label} ground={groundArt} sprites={spriteArt}>
      {(outlined || hovered) && (
        <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden>
          {outlined && (
            <polygon
              points={corners([vp.at(-0.5, -0.5), vp.at(c1, -0.5), vp.at(c1, r1), vp.at(-0.5, r1)])}
              className="fill-none stroke-muted-foreground"
              strokeWidth={1.5}
              strokeDasharray="6 4"
            />
          )}
          {hovered && <polygon points={diamond(hovered)} className="fill-white/10 stroke-amber-300" strokeWidth={2} />}
        </svg>
      )}
      {tiles.map((tile) => {
        const b = built(tile.pos);
        const p = vp.at(tile.col, tile.row);
        if (!b && tile.kind === 'gate')
          return (
            <span
              key={`c${tile.pos}`}
              className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-md border border-dashed bg-background/85 px-2 py-1 text-xs text-muted-foreground"
              style={{ left: p.x, top: p.y }}
            >
              <Plus className="size-3.5" />
              {buildingName(BuildingType.WALLS)}
            </span>
          );
        if (!b || dimmed(tile.pos)) return null;
        // the level, small, on the tile's front corner: on the grass in front of the building rather than over it
        return (
          <div
            key={`c${tile.pos}`}
            aria-hidden
            className="pointer-events-none absolute flex -translate-x-1/2 flex-col items-center gap-0.5"
            style={{ left: p.x, top: p.y + (TILE_H / 2) * (tile.span ?? 1) * zoom - 5 }}
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
          style={{
            left: vp.at(hovered.col, hovered.row).x,
            top: vp.at(hovered.col, hovered.row).y + (spriteBox((hovered.span ?? 1) * SPRITE).top + 8) * zoom,
          }}
        >
          {tileLabel(hovered, built(hovered.pos))}
        </span>
      )}
      {tiles
        .filter((tile) => (tile.kind === 'slot' || tile.kind === 'gate') && tile.pos != null)
        .sort((a, b) => depthOf(a.col, a.row) - depthOf(b.col, b.row))
        .map((tile) => {
          const p = vp.at(tile.col, tile.row);
          const span = tile.span ?? 1;
          return (
            <button
              key={`k${tile.pos}`}
              aria-label={tileLabel(tile, built(tile.pos))}
              className="pointer-events-none absolute opacity-0"
              style={{
                left: p.x - (TILE_W / 4) * span * zoom,
                top: p.y - (TILE_H / 4) * span * zoom,
                width: (TILE_W / 2) * span * zoom,
                height: (TILE_H / 2) * span * zoom,
              }}
              onFocus={() => setHover(tile.pos!)}
              onBlur={() => setHover(null)}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(tile.pos!);
              }}
            />
          );
        })}
    </IsoViewport>
  );
}
