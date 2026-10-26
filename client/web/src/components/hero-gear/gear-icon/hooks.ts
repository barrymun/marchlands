import { type RefObject, useEffect } from 'react';

import { GEAR_ART } from '@/components/hero-gear/constants';
import { BURST_FRAMES, FRAME_MS, GEAR_SIZE } from '@/components/hero-gear/gear-icon/constants';
import type { GearFrame, GearPixel } from '@/components/hero-gear/gear-icon/types';
import { gearFrame, hasMotion, movedPiece, moveShare, pieceMove, piecePhase, pixelData } from '@/components/hero-gear/gear-icon/utils';
import { burstAt, onBurst } from '@/components/hero-gear/utils';
import { ANIMATION_FPS } from '@/components/iso-viewport/constants';
import { useImages } from '@/hooks/use-images';
import { useMotion } from '@/hooks/use-motion';
import { gearTwinFile } from '@/lib/game-art';

/** The icons moving on the page, each drawing itself at a moment: one clock for them all. */
const painters = new Set<(t: number) => void>();
let frame = 0;
let drawn = -Infinity;

/** The one frame loop: every moving icon redrawn together about 12 times a second, while any is shown (it stops in a hidden tab). */
function tick(now: number) {
  if (now - drawn >= 1000 / ANIMATION_FPS) {
    drawn = now;
    for (const paint of painters) paint(now);
  }
  frame = painters.size ? requestAnimationFrame(tick) : 0;
}

/** Add an icon to the clock; the function returned takes it off, and the clock stops with the last one. */
function onClock(paint: (t: number) => void): () => void {
  painters.add(paint);
  if (!frame) frame = requestAnimationFrame(tick);
  return () => {
    painters.delete(paint);
    if (!painters.size && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  };
}

/** A canvas the size of a sprite, where each layer is laid out and cut to the piece before it joins the icon. */
let scratch: CanvasRenderingContext2D | null = null;
/** A canvas the size of a sprite, where a moving piece is put together for the moment being drawn. */
let stage: CanvasRenderingContext2D | null = null;

/** A canvas of a sprite's size to draw on; null where the browser gives no 2D canvas. */
function spriteCanvas(): CanvasRenderingContext2D | null {
  const c = document.createElement('canvas');
  c.width = c.height = GEAR_SIZE;
  return c.getContext('2d', { willReadFrequently: true });
}

/** Each loaded sprite's pixels, read once. */
const pixels = new Map<HTMLImageElement, Uint8ClampedArray>();

/** A loaded sprite's pixels (32×32 RGBA), or null where they can't be read. */
function pixelsOf(img: HTMLImageElement): Uint8ClampedArray | null {
  const hit = pixels.get(img);
  if (hit) return hit;
  stage ??= spriteCanvas();
  if (!stage) return null;
  stage.clearRect(0, 0, GEAR_SIZE, GEAR_SIZE);
  stage.drawImage(img, 0, 0);
  const data = stage.getImageData(0, 0, GEAR_SIZE, GEAR_SIZE).data;
  pixels.set(img, data);
  return data;
}

/**
 * Draw a moment of an icon's movement on `ctx`, the piece being `piece`: what's behind it hidden where it stands, the
 * piece itself when the canvas draws it (`own`, a piece that moves), what's on it kept to it, then the rest over all.
 */
function paint(ctx: CanvasRenderingContext2D, f: GearFrame, piece: CanvasImageSource, own: boolean) {
  ctx.clearRect(0, 0, GEAR_SIZE, GEAR_SIZE);
  scratch ??= spriteCanvas();
  const s = scratch;
  if (!s) return;
  const layer = (px: readonly GearPixel[], cut?: GlobalCompositeOperation) => {
    if (!px.length) return;
    s.putImageData(new ImageData(pixelData(px), GEAR_SIZE, GEAR_SIZE), 0, 0);
    if (cut) {
      s.globalCompositeOperation = cut;
      s.drawImage(piece, 0, 0);
      s.globalCompositeOperation = 'source-over';
    }
    ctx.drawImage(s.canvas, 0, 0);
  };
  layer(f.behind, 'destination-out');
  if (own) ctx.drawImage(piece, 0, 0);
  layer(f.piece, 'destination-in');
  layer(f.over);
}

/**
 * Move a gear icon's `canvas`, laid over its sprite (`art`, the piece's URL, shown by `still`), as its level has it
 * (`gearFrame`), on the page's one clock, and play a burst whenever one is started on its piece (`startBurst`), at any
 * level. A piece with a movement of its own (`pieceMove`) is drawn by the canvas, moving now and then, its still image
 * hidden meanwhile; the helm's plume moves alone, over its bare twin. Nothing moves with reduced motion, nor until the
 * images have loaded; below level 3 only a burst and a piece's own movement do.
 */
export function useGearMotion(
  canvas: RefObject<HTMLCanvasElement | null>,
  still: RefObject<HTMLImageElement | null>,
  piece: string,
  level: number,
  art: string | undefined,
) {
  const motion = useMotion();
  const move = pieceMove(piece, level);
  // the plume sways alone: the helm without it, and the plume
  const twins = move?.k === 'sway' ? [GEAR_ART[gearTwinFile(piece, level, 'bare')], GEAR_ART[gearTwinFile(piece, level, 'plume')]] : [];
  const srcs = motion && art ? [art, ...twins].flatMap((src) => (src ? [src] : [])) : [];
  const images = useImages(srcs);
  const loaded = srcs.length > 0 && srcs.every((src) => images.has(src));
  const key = srcs.join('|');
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    const [main, bareSrc, partSrc] = key.split('|');
    const img = main ? images.get(main) : undefined;
    if (!ctx || !motion || !loaded || !img) return;
    // the pixels a moving piece is moved from: its bare twin and part, or the whole sprite
    const bareImg = bareSrc ? images.get(bareSrc) : undefined;
    const partImg = partSrc ? images.get(partSrc) : undefined;
    const bare = bareImg ? pixelsOf(bareImg) : null;
    const part = partImg ? pixelsOf(partImg) : move ? pixelsOf(img) : null;
    const idle = hasMotion(piece, level);
    const phase = piecePhase(piece);
    let hidden = false;
    let stop: (() => void) | null = null;
    const draw = (t: number) => {
      const b = burstAt(piece);
      // a burst waiting its turn or under way keeps the icon on the clock
      const bursting = b != null && t < b + BURST_FRAMES * FRAME_MS;
      let source: CanvasImageSource = img;
      const own = !!move && !!part && !!stage;
      if (move && part && stage) {
        stage.putImageData(new ImageData(movedPiece(bare, part, move, moveShare(t, phase) ?? 0), GEAR_SIZE, GEAR_SIZE), 0, 0);
        source = stage.canvas;
      }
      paint(ctx, gearFrame(piece, level, t, bursting ? b : undefined), source, own);
      // the canvas now shows the piece: the still image would show behind it where it moves
      if (own && !hidden && still.current) {
        still.current.style.visibility = 'hidden';
        hidden = true;
      }
      if (!idle && !bursting) {
        stop?.();
        stop = null;
        ctx.clearRect(0, 0, GEAR_SIZE, GEAR_SIZE);
      }
    };
    const start = () => {
      stop ??= onClock(draw);
    };
    if (idle) start();
    const off = onBurst((p) => {
      if (p === piece) start();
    });
    const shown = still.current;
    return () => {
      off();
      stop?.();
      ctx.clearRect(0, 0, GEAR_SIZE, GEAR_SIZE);
      if (shown) shown.style.visibility = '';
    };
  }, [canvas, still, motion, loaded, key, images, move, piece, level]);
}
