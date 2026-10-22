import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { BuildingBean } from '@marchlands/api-client';
import { BuildingType } from '@marchlands/core';

import { BUILDING_ART } from '@/components/buildings-panel/constants';
import type { BuildingArt, IsoLayout, IsoSprite, IsoTile } from '@/components/buildings-panel/iso-grid/types';
import { buildingSprites, depthOf, hitTest, markerOf } from '@/components/buildings-panel/iso-grid/utils';
import { cityArt } from '@/components/buildings-panel/utils';
import { Countdown } from '@/components/countdown/countdown';
import { useAnimations } from '@/components/iso-anim/hooks';
import type { TownState } from '@/components/iso-anim/types';
import { SPRITE, TILE_H, TILE_W } from '@/components/iso-viewport/constants';
import { useIsoViewport } from '@/components/iso-viewport/hooks';
import { IsoViewport } from '@/components/iso-viewport/iso-viewport';
import type { Drawable, Piece, ViewPoint } from '@/components/iso-viewport/types';
import { clampToScene, fitZoom, sceneBox, sceneCentre, spriteAt, spriteBox, tileAt } from '@/components/iso-viewport/utils';
import { opaqueAt } from '@/hooks/use-images';
import { builtAt } from '@/lib/build-events';
import { artBand, bareArtFile, buildingArtFile, cityGroundFile, grandTownHallFile } from '@/lib/game-art';
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
  cityId,
  people,
  state,
  layout,
  extra = [],
  byPos,
  onSelect,
  outlined,
  highlight,
  label,
}: {
  cityId: number;
  /** how many people walk between the slots */
  people: number;
  /** what the city is doing, for the buildings that show it */
  state: TownState;
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
  const artOf = (type: number, level: number, span: number): BuildingArt => {
    if (span === 2) {
      const file = grandTownHallFile(artBand(level));
      return { src: cityArt(file), file: `city/${file}` };
    }
    const file = buildingArtFile(type, artBand(level));
    return { src: BUILDING_ART[file], file: `buildings/${file}`, bare: BUILDING_ART[bareArtFile(file)] };
  };
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
    ...ground.map((g) => ({ key: `g${g.col},${g.row}`, col: g.col, row: g.row, src: cityArt(cityGroundFile('grass')) })),
    ...tiles.flatMap((tile) => {
      const m = markerOf(tile, !!built(tile.pos));
      return m ? [{ key: `m${tile.pos}`, col: tile.col, row: tile.row, src: cityArt(cityGroundFile(m)), tone: highlight ? ('dim' as const) : undefined }] : [];
    }),
  ];
  // each sprite with how it's drawn now (lit under the pointer, dimmed when not picked)
  const toned = sprites.map((s) => ({
    s,
    d: {
      ...s,
      tone:
        s.pos != null && s.pos === hover
          ? ('lit' as const)
          : s.pos != null && byPos.has(s.pos) && s.key.startsWith('b') && dimmed(s.pos)
            ? ('dim' as const)
            : undefined,
    } satisfies Drawable,
  }));
  const spriteArt: Drawable[] = toned.map(({ d }) => d);
  // the scene at a moment, once the animation code has loaded: each sprite (bare under its turning parts), then what it
  // shows (smoke, sails, construction, a finished level's sparkle), and people on the streets, all back to front; a
  // dimmed building stays still
  const anim = useAnimations();
  const streets = anim?.streetsOf(tiles.filter((tile) => tile.kind === 'slot'));
  const animate =
    anim && streets
      ? (t: number): Piece[] => {
          const night = anim.isNight();
          const layers: { depth: number; pieces: Piece[] }[] = toned.map(({ s, d }) => {
            if (!s.file || d.tone === 'dim') return { depth: s.depth, pieces: [d] };
            const owner = { key: s.key, col: s.col, row: s.row, size: s.size, file: s.file };
            const b = s.pos != null ? byPos.get(s.pos) : undefined;
            return {
              depth: s.depth,
              pieces: [
                s.bare ? { ...d, src: s.bare } : d,
                ...anim.buildingOverlays(owner, b?.typeId ?? 0, s.pos, state, t, night),
                ...(b && b.status !== 0 ? anim.constructionOverlays(owner, t) : []),
                ...(s.pos != null ? anim.sparkleOverlays(owner, t, builtAt(cityId, s.pos)) : []),
              ],
            };
          });
          for (const w of anim.walkerOverlays(streets, people, t, label)) layers.push({ depth: depthOf(w.col, w.row), pieces: [w] });
          const burnable = sprites.flatMap((s) => (s.file && s.pos != null ? [{ key: s.key, col: s.col, row: s.row, size: s.size, file: s.file }] : []));
          for (const f of anim.aftermathOverlays(burnable, state.attackedAt, t)) layers.push({ depth: depthOf(f.col, f.row) + 0.01, pieces: [f] });
          return layers.sort((a, b) => a.depth - b.depth).flatMap((l) => l.pieces);
        }
      : undefined;
  const preload = sprites.flatMap((s) => (s.bare ? [s.bare] : []));
  // the sky over the city's state: night by the player's clock, and the weather
  const sky = anim ? (t: number) => anim.skyAt(state.zoneId, t, vp.view.w, vp.view.h) : undefined;
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
    <IsoViewport vp={vp} label={label} ground={groundArt} sprites={spriteArt} animate={animate} sky={sky} preload={preload}>
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
