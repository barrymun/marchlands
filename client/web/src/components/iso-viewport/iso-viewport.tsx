import { Minus, Plus } from 'lucide-react';
import { type KeyboardEvent, type PointerEvent, type ReactNode, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { DRAG_SLOP, KEY_STEP } from '@/components/iso-viewport/constants';
import type { Viewport } from '@/components/iso-viewport/hooks';
import type { Camera, Drawable, PanDirection, ViewPoint } from '@/components/iso-viewport/types';
import { clampZoom, dragged, panStep, spriteBox, tileOrigin, zoomAround } from '@/components/iso-viewport/utils';
import { Button } from '@/components/ui/button';
import { useImages } from '@/hooks/use-images';
import { cn } from '@/lib/utils';

const KEYS: Record<string, PanDirection> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

/**
 * An isometric view filling its parent (the world map, the town, the fields): the `ground` and then the `sprites`, back
 * to front, drawn on a canvas in device pixels at the camera's zoom, so the pixel art stays sharp; `children` lay
 * labels and outlines over it (place them with `vp.at`), and zoom buttons sit in the corner. The camera and the input
 * is `vp` (useIsoViewport). Input: drag with the mouse or a finger (a press that hardly moves is a tap), pinch with
 * two fingers to zoom smoothly towards their middle, the mouse wheel and trackpad (`vp`), the arrow keys to move a
 * tile, + and - (and the buttons) to step between the sharp zooms.
 */
export function IsoViewport({
  vp,
  ground,
  sprites,
  label,
  className,
  children,
}: {
  vp: Viewport;
  ground: readonly Drawable[];
  sprites: readonly Drawable[];
  /** what the view is, for screen readers, with how to move it */
  label: string;
  className?: string;
  children?: ReactNode;
}) {
  const { t } = useTranslation('iso-viewport');
  const canvas = useRef<HTMLCanvasElement>(null);
  const images = useImages([...ground.map((g) => g.src), ...sprites.map((s) => s.src)]);
  const { camera, view, options, setElement } = vp;
  // the pointers on the view, and the drag or pinch they are making
  const pointers = useRef(new Map<number, ViewPoint>());
  const drag = useRef<{ p: ViewPoint; from: Camera; moved: boolean } | null>(null);
  const pinch = useRef<{ dist: number; mid: ViewPoint; from: Camera } | null>(null);
  const point = (e: { clientX: number; clientY: number; currentTarget: Element }): ViewPoint => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const two = () => {
    const [a, b] = [...pointers.current.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  };

  // the art, in device pixels: the ground, then the sprites back to front, lit or dimmed as they ask
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx || !camera) return;
    const k = camera.zoom * view.dpr;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    const draw = (d: Drawable) => {
      const img = images.get(d.src);
      if (!img) return;
      const p = tileOrigin(d.col, d.row, camera, view);
      const box = spriteBox(d.size);
      ctx.filter = d.tone === 'lit' ? 'brightness(1.15)' : d.tone === 'dim' ? 'grayscale(0.7) brightness(0.7)' : 'none';
      ctx.globalAlpha = d.tone === 'dim' ? 0.55 : 1;
      ctx.drawImage(img, p.x + box.left * k, p.y + box.top * k, box.width * k, box.height * k);
    };
    for (const g of ground) draw(g);
    for (const s of sprites) draw(s);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
  });

  return (
    <div
      ref={setElement}
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
          pinch.current = { ...two(), from: camera };
          if (drag.current) drag.current.moved = true;
        }
      }}
      onPointerMove={(e: PointerEvent<HTMLDivElement>) => {
        const p = point(e);
        if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, p);
        const pin = pinch.current;
        if (pin && pointers.current.size >= 2) {
          // two fingers: the view follows their middle, and zooms as far as they spread or close
          const now = two();
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
      <div className="absolute right-2 bottom-2 flex flex-col gap-1" onPointerDown={(e) => e.stopPropagation()}>
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
