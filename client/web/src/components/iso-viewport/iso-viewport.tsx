import { Minus, Plus } from 'lucide-react';
import { type KeyboardEvent, type PointerEvent, type ReactNode, useEffect, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { ANIMATION_FPS, DRAG_SLOP, KEY_STEP } from '@/components/iso-viewport/constants';
import type { Viewport } from '@/components/iso-viewport/hooks';
import type { Camera, Drawable, PanDirection, Piece, Sky, ViewPoint } from '@/components/iso-viewport/types';
import { artCanvas, clampZoom, dragged, isOverlay, overlayRect, panStep, spriteBox, tileOrigin, zoomAround } from '@/components/iso-viewport/utils';
import { Button } from '@/components/ui/button';
import { useImages } from '@/hooks/use-images';
import { useMotion } from '@/hooks/use-motion';
import { cn } from '@/lib/utils';

const KEYS: Record<string, PanDirection> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

/**
 * An isometric view filling its parent (the world map, the town, the fields): the `ground` and then the `sprites`, back
 * to front, drawn on a canvas in device pixels at the camera's zoom, so the pixel art stays sharp; `children` lay
 * labels and outlines over it (place them with `vp.at`), and zoom buttons sit in the corner. The camera and the input
 * is `vp` (useIsoViewport). Input: drag with the mouse or a finger (a press that hardly moves is a tap), pinch with
 * two fingers to zoom smoothly towards their middle, the mouse wheel and trackpad (`vp`), the arrow keys to move a
 * tile, + and - (and the buttons) to step between the sharp zooms.
 *
 * With `animate` (and motion allowed, `useMotion`) the scene moves: about ANIMATION_FPS times a second, driven by the
 * clock rather than by rendering, the canvas is redrawn with the pieces `animate` gives for that moment (sprites and
 * overlays made in code, back to front). Without it, or with reduced motion, `sprites` are drawn still.
 */
export function IsoViewport({
  vp,
  ground,
  sprites,
  label,
  className,
  children,
  animate,
  sky,
  preload = [],
}: {
  vp: Viewport;
  ground: readonly Drawable[];
  sprites: readonly Drawable[];
  /** the scene at time `t` (ms, the page's clock), when it moves */
  animate?: (t: number) => readonly Piece[];
  /** the sky over it at time `t`: night, weather, lightning (only while it moves) */
  sky?: (t: number) => Sky | undefined;
  /** sprites `animate` may draw that `sprites` doesn't hold (bare twins), to load in advance */
  preload?: readonly string[];
  /** what the view is, for screen readers, with how to move it */
  label: string;
  className?: string;
  children?: ReactNode;
}) {
  const { t } = useTranslation('iso-viewport');
  const canvas = useRef<HTMLCanvasElement>(null);
  const images = useImages([...ground.map((g) => g.src), ...sprites.map((s) => s.src), ...preload]);
  const motion = useMotion() && !!animate;
  const { camera, view, options, setElement } = vp;
  // the pointers on the view, and the drag or pinch they are making
  const pointers = useRef(new Map<number, ViewPoint>());
  const drag = useRef<{ p: ViewPoint; from: Camera; moved: boolean } | null>(null);
  const pinch = useRef<{ dist: number; mid: ViewPoint; from: Camera } | null>(null);
  const point = (e: { clientX: number; clientY: number; currentTarget: Element }): ViewPoint => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  /** The two fingers' distance and middle, or null with fewer than two down. */
  const two = () => {
    const [a, b] = [...pointers.current.values()];
    if (!a || !b) return null;
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  };

  // the art, in device pixels: the ground, then the pieces back to front, sprites lit or dimmed as they ask
  const paint = (pieces: readonly Piece[], skyNow?: Sky) => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx || !camera) return;
    const k = camera.zoom * view.dpr;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    const draw = (d: Piece) => {
      if (isOverlay(d)) {
        const img = artCanvas(d.art);
        if (!img) return;
        const r = overlayRect(d, camera, view);
        ctx.filter = 'none';
        ctx.globalAlpha = d.alpha ?? 1;
        ctx.drawImage(img, r.x, r.y, r.w, r.h);
        return;
      }
      const img = images.get(d.src);
      if (!img) return;
      const p = tileOrigin(d.col, d.row, camera, view);
      const box = spriteBox(d.size);
      ctx.filter = d.tone === 'lit' ? 'brightness(1.15)' : d.tone === 'dim' ? 'grayscale(0.7) brightness(0.7)' : 'none';
      ctx.globalAlpha = d.tone === 'dim' ? 0.55 : 1;
      ctx.drawImage(img, p.x + box.left * k, p.y + box.top * k, box.width * k, box.height * k);
    };
    for (const g of ground) draw(g);
    // lights (lit windows, fires) go over the night's darkness, everything else under it
    for (const s of pieces) if (!(skyNow?.darkness && isOverlay(s) && s.light)) draw(s);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    if (!skyNow) return;
    const { width, height } = ctx.canvas;
    if (skyNow.darkness > 0) {
      // a deep blue over what is drawn (source-atop leaves the empty background alone): colours sink towards night
      // without blurring a pixel
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = `rgba(14, 18, 52, ${Math.min(1, skyNow.darkness) * 0.5})`;
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';
      for (const s of pieces) if (isOverlay(s) && s.light) draw(s);
      ctx.globalAlpha = 1;
    }
    const px = Math.max(1, Math.round(view.dpr));
    if (skyNow.weather === 'snow') {
      ctx.fillStyle = 'rgba(250, 250, 255, 0.85)';
      for (const p of skyNow.particles) ctx.fillRect(Math.round(p.x * view.dpr), Math.round(p.y * view.dpr), px * 2, px * 2);
    } else if (skyNow.weather) {
      ctx.fillStyle = 'rgba(190, 210, 235, 0.55)';
      // a streak, slanting a pixel across for every two down
      for (const p of skyNow.particles)
        for (let i = 0; i < p.len; i++) ctx.fillRect(Math.round((p.x - i / 2) * view.dpr), Math.round((p.y - i) * view.dpr), px, px);
    }
    if (skyNow.flash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.8, skyNow.flash * 0.8)})`;
      ctx.fillRect(0, 0, width, height);
    }
  };
  // the clock-driven redraw reads the paint and animate of the latest render
  const latest = useRef({ paint, animate, sky });
  useLayoutEffect(() => {
    latest.current = { paint, animate, sky };
  });
  // a still scene is drawn after every render; a moving one is too (at once), then on every tick of the clock
  useEffect(() => {
    const { paint, animate, sky } = latest.current;
    const now = performance.now();
    if (motion && animate) paint(animate(now), sky?.(now));
    else paint(sprites);
  });
  // the clock: browsers stop animation frames in a hidden tab, so a scene nobody sees costs nothing
  useEffect(() => {
    if (!motion) return;
    let id = 0;
    let last = 0;
    const tick = (t: number) => {
      if (t - last >= 1000 / ANIMATION_FPS) {
        last = t;
        const { paint, animate, sky } = latest.current;
        if (animate) paint(animate(t), sky?.(t));
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [motion]);

  return (
    // eslint-disable-next-line jsx-a11y-x/no-noninteractive-element-interactions -- the scene (map, town, fields) is an application: it takes the pointer and the keyboard
    <div
      ref={setElement}
      // eslint-disable-next-line jsx-a11y-x/no-noninteractive-tabindex -- as above, it is focused to move and zoom with the keys
      tabIndex={0}
      role="application"
      aria-label={label}
      className={cn(
        'absolute inset-0 cursor-grab touch-none overflow-hidden outline-none select-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing',
        className,
      )}
      onPointerDown={(e: PointerEvent<HTMLDivElement>) => {
        if (!camera) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        pointers.current.set(e.pointerId, point(e));
        if (pointers.current.size === 1) drag.current = { p: point(e), from: camera, moved: false };
        else if (pointers.current.size === 2) {
          const both = two();
          if (both) pinch.current = { ...both, from: camera };
          if (drag.current) drag.current.moved = true;
        }
      }}
      onPointerMove={(e: PointerEvent<HTMLDivElement>) => {
        const p = point(e);
        if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, p);
        const pin = pinch.current;
        const now = pin && two();
        if (pin && now) {
          // two fingers: the view follows their middle, and zooms as far as they spread or close
          const zoom = clampZoom(pin.from.zoom * (now.dist / pin.dist));
          vp.setCamera(zoomAround(dragged(pin.from, now.mid.x - pin.mid.x, now.mid.y - pin.mid.y), zoom, now.mid, view));
          return;
        }
        const d = drag.current;
        if (d) {
          if (!d.moved && Math.hypot(p.x - d.p.x, p.y - d.p.y) < DRAG_SLOP) return;
          d.moved = true;
          vp.setCamera(dragged(d.from, p.x - d.p.x, p.y - d.p.y));
          return;
        }
        options.onHover?.(p);
      }}
      onPointerUp={(e: PointerEvent<HTMLDivElement>) => {
        pointers.current.delete(e.pointerId);
        if (pinch.current) {
          if (pointers.current.size < 2) pinch.current = null;
          drag.current = null;
          return;
        }
        const d = drag.current;
        drag.current = null;
        if (d && !d.moved) options.onTap?.(point(e));
      }}
      onPointerCancel={(e: PointerEvent<HTMLDivElement>) => {
        pointers.current.delete(e.pointerId);
        drag.current = null;
        pinch.current = null;
      }}
      onPointerLeave={() => options.onHover?.(null)}
      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
        const dir = KEYS[e.key];
        if (dir) {
          const { dx, dy } = panStep(dir, KEY_STEP);
          vp.panBy(dx, dy);
        } else if (e.key === '+' || e.key === '=') vp.zoomBy(1);
        else if (e.key === '-') vp.zoomBy(-1);
        else if (e.key === 'Enter' && options.onEnter) options.onEnter();
        else return;
        e.preventDefault();
      }}
    >
      <canvas ref={canvas} width={Math.round(view.w * view.dpr)} height={Math.round(view.h * view.dpr)} className="absolute inset-0 size-full" />
      {camera && children}
      <div className="absolute end-2 bottom-2 flex flex-col gap-1" onPointerDown={(e) => e.stopPropagation()}>
        <Button size="icon-xs" variant="secondary" onClick={() => vp.zoomBy(1)} aria-label={t('zoom.in')}>
          <Plus />
        </Button>
        <Button size="icon-xs" variant="secondary" onClick={() => vp.zoomBy(-1)} aria-label={t('zoom.out')}>
          <Minus />
        </Button>
      </div>
    </div>
  );
}
