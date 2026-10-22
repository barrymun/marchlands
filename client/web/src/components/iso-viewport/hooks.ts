import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Camera, View, ViewPoint } from '@/components/iso-viewport/types';
import { clampZoom, nextZoom, viewPoint, wheelZoom, zoomAround } from '@/components/iso-viewport/utils';

/** What a view does with its camera and its input. */
export interface ViewportOptions {
  /** Where the camera starts once the view has a size (and again whenever `resetKey` changes). */
  start: (view: View) => Camera;
  /** Where the camera may go: every move passes through it (the town keeps half its scene in view). */
  clamp?: (cam: Camera, view: View) => Camera;
  /** A click or tap (a press that hardly moved) at a point of the view. */
  onTap?: (p: ViewPoint) => void;
  /** The pointer moving over the view, or leaving it (null). */
  onHover?: (p: ViewPoint | null) => void;
  /** Enter pressed with the view focused. */
  onEnter?: () => void;
  /** Change it to put the camera back at its start (another city, another scene). */
  resetKey?: unknown;
}

/**
 * The camera of an isometric view (IsoViewport draws it and takes its input): the view's size, kept up to date, and
 * the camera, which starts where `start` says and moves only through `clamp`. The mouse wheel and the trackpad (a
 * scroll, or a pinch, which Chrome and Firefox send as a wheel with Ctrl and Safari as gesture events) zoom it smoothly
 * towards the pointer; the buttons and keys (`zoomBy`) step between the zooms that land on whole device pixels.
 */
export function useIsoViewport(o: ViewportOptions) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  const view: View = { w: size.w, h: size.h, dpr };
  const [moved, setMoved] = useState<{ key: unknown; cam: Camera } | null>(null);
  const camera = moved && moved.key === o.resetKey ? moved.cam : size.w ? o.start(view) : null;
  // the wheel listener lives across renders, so it reads the camera and the options as they are now
  const latest = useRef({ camera, view, o });
  useLayoutEffect(() => {
    latest.current = { camera, view, o };
  });

  /** Move the camera, through the clamp. */
  const setCamera = (cam: Camera) => setMoved({ key: o.resetKey, cam: o.clamp ? o.clamp(cam, view) : cam });

  useEffect(() => {
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => entry && setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    observer.observe(el);
    // the wheel and the trackpad zoom the view rather than scrolling or zooming the page, so they need listeners that may
    // cancel that; events can come faster than React renders, so each zoom builds on the last one, not on the camera
    // the last render saw
    const zoomTo = (zoom: (cam: Camera) => number, e: { clientX: number; clientY: number }) => {
      const { camera: cam, view: v, o: opts } = latest.current;
      if (!cam) return;
      const r = el.getBoundingClientRect();
      const moved = zoomAround(cam, zoom(cam), { x: e.clientX - r.left, y: e.clientY - r.top }, v);
      const next = opts.clamp ? opts.clamp(moved, v) : moved;
      latest.current = { ...latest.current, camera: next };
      setMoved({ key: opts.resetKey, cam: next });
    };
    const onWheel = (e: WheelEvent) => {
      if (!latest.current.camera) return;
      e.preventDefault();
      zoomTo((cam) => wheelZoom(cam.zoom, e, latest.current.view.h), e);
    };
    // Safari: a trackpad pinch is a gesture, its `scale` measured from where it started
    let gesture: number | null = null;
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      gesture = latest.current.camera?.zoom ?? null;
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const g = e as Event & { scale: number; clientX: number; clientY: number };
      const from = gesture;
      if (from != null) zoomTo(() => clampZoom(from * g.scale), g);
    };
    const onGestureEnd = (e: Event) => {
      e.preventDefault();
      gesture = null;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', onGestureStart);
    el.addEventListener('gesturechange', onGestureChange);
    el.addEventListener('gestureend', onGestureEnd);
    return () => {
      observer.disconnect();
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', onGestureStart);
      el.removeEventListener('gesturechange', onGestureChange);
      el.removeEventListener('gestureend', onGestureEnd);
    };
  }, [el]);

  return {
    /** The element the view fills: IsoViewport hands it this. */
    setElement: setEl,
    view,
    /** null until the view has a size */
    camera,
    options: o,
    setCamera,
    /** Where tile (col, row)'s middle falls, in CSS pixels of the view. */
    at: (col: number, row: number): ViewPoint => (camera ? viewPoint(col, row, camera, view) : { x: 0, y: 0 }),
    /** Zoom a step in (1) or out (-1), towards `p` (the middle of the view when left out). */
    zoomBy: (step: 1 | -1, p?: ViewPoint) =>
      camera && setCamera(zoomAround(camera, nextZoom(camera.zoom, step, dpr), p ?? { x: view.w / 2, y: view.h / 2 }, view)),
    /** Move the camera by (dx, dy) tiles. */
    panBy: (dx: number, dy: number) => camera && setCamera({ ...camera, x: camera.x + dx, y: camera.y + dy }),
    /** Put tile (x, y) in the middle of the view, at the same zoom. */
    centreOn: (x: number, y: number) => camera && setCamera({ ...camera, x, y }),
  };
}

export type Viewport = ReturnType<typeof useIsoViewport>;
