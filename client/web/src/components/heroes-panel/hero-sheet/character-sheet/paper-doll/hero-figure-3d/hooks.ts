import { type RefObject, useEffect, useRef, useState } from 'react';
import {
  DepthTexture,
  LinearSRGBColorSpace,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';

import type { FigureBody } from '@/components/heroes-panel/hero-sheet/character-sheet/paper-doll/hero-figure/types';
import {
  ACTION_MS,
  CAMERA,
  DEPTH_EDGE,
  FIGURE_ACTIONS,
  KEY_TURN,
  OUTLINE,
  OUTLINE_FRAGMENT,
  OUTLINE_VERTEX,
  RENDER_SIZE,
  REST_ANGLE,
} from '@/components/heroes-panel/hero-sheet/character-sheet/paper-doll/hero-figure-3d/constants';
import type { Acting, FigureModel } from '@/components/heroes-panel/hero-sheet/character-sheet/paper-doll/hero-figure-3d/types';
import { buildFigure, disposeFigure, poseFigure, settle, turnBy } from '@/components/heroes-panel/hero-sheet/character-sheet/paper-doll/hero-figure-3d/utils';
import { ANIMATION_FPS, DRAG_SLOP } from '@/components/iso-viewport/constants';

/**
 * Draw the hero (`body`) at `level` on `canvas` with three.js (docs/features/hero-3d.md), taking the pointer and the
 * keyboard on `surface` round it: rendered at 128×128 in toon shading into a render target, then an outline pass from
 * its depth onto the canvas, which CSS scales up crisp.
 * - It breathes, its cape stirs and level 10's stones glow, redrawn about 12 times a second (ANIMATION_FPS); a press
 *   that hardly moves (or Enter, Space) plays the next action (a swing, a salute, the shield raised), at the screen's
 *   rate, as is a drag.
 * - A drag turns it round the upright axis and, let go, it eases back to rest. Focused, the arrow keys turn it (it eases
 *   back once it loses focus) and Home turns it back. A new `resetKey` (another hero) turns it back to rest.
 * - With `still` (reduced motion) it stands in its rest pose, doesn't act, and stays where it is turned.
 * Returns false where WebGL doesn't work or its context is lost, for the 2D figure instead.
 */
export function useHeroFigure3d(
  canvas: RefObject<HTMLCanvasElement | null>,
  surface: RefObject<HTMLElement | null>,
  body: FigureBody,
  level: number,
  still: boolean,
  resetKey: number,
): boolean {
  // the sheet draws it only where WebGL works (webglWorks); this turns false if it fails after all, or is lost
  const [works, setWorks] = useState(true);
  const setFigure = useRef<(body: FigureBody, level: number) => void>(null);
  const reset = useRef<() => void>(null);
  const wake = useRef<() => void>(null);
  const stillRef = useRef(still);
  useEffect(() => {
    stillRef.current = still;
  });

  useEffect(() => {
    const el = canvas.current;
    // what takes the pointer and the keyboard: the focusable frame round the canvas
    const box = surface.current;
    if (!el || !box || !works) return;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ canvas: el, antialias: false, alpha: true, powerPreference: 'low-power' });
    } catch {
      queueMicrotask(() => setWorks(false));
      return;
    }
    const size = RENDER_SIZE;
    renderer.setPixelRatio(1);
    renderer.setSize(size, size, false);
    renderer.setClearColor(0x000000, 0);
    // the palette's numbers drawn as they are, as the sprites show them
    renderer.outputColorSpace = LinearSRGBColorSpace;
    const target = new WebGLRenderTarget(size, size, { minFilter: NearestFilter, magFilter: NearestFilter, depthTexture: new DepthTexture(size, size) });
    const scene = new Scene();
    const camera = new OrthographicCamera(-size / 2, size / 2, size / 2, -size / 2, CAMERA.near, CAMERA.far);
    camera.position.set(0, CAMERA.target + Math.sin(CAMERA.tilt) * CAMERA.distance, Math.cos(CAMERA.tilt) * CAMERA.distance);
    camera.lookAt(0, CAMERA.target, 0);
    const pass = new ShaderMaterial({
      vertexShader: OUTLINE_VERTEX,
      fragmentShader: OUTLINE_FRAGMENT,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tColour: { value: target.texture },
        tDepth: { value: target.depthTexture },
        texel: { value: new Vector2(1 / size, 1 / size) },
        outline: { value: new Vector3(OUTLINE[0] / 255, OUTLINE[1] / 255, OUTLINE[2] / 255) },
        // the depth buffer of an orthographic camera is linear from near to far
        edge: { value: DEPTH_EDGE / (CAMERA.far - CAMERA.near) },
      },
    });
    const quad = new Mesh(new PlaneGeometry(2, 2), pass);
    quad.frustumCulled = false;
    const screen = new Scene();
    screen.add(quad);
    const flat = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

    let model: FigureModel | null = null;
    let angle = REST_ANGLE;
    let dragging = false;
    // turned with the keys: it stays turned while it has focus
    let held = false;
    let acting: Acting | null = null;
    // the next action, in turn
    let next = 0;
    const draw = (now: number) => {
      if (model) {
        model.root.rotation.y = angle;
        poseFigure(model, stillRef.current ? null : now, acting);
      }
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(screen, flat);
    };
    // frames all the time for the idle (unless still), drawn about 12 a second, or every frame while something moves
    let frame = 0;
    let last = 0;
    let drawn = -Infinity;
    const tick = (now: number) => {
      frame = 0;
      const ms = Math.min(100, now - last);
      last = now;
      const free = !dragging && !held && !stillRef.current;
      if (free) angle = settle(angle, REST_ANGLE, ms);
      if (acting && now - acting.at > ACTION_MS) acting = null;
      const moving = dragging || acting !== null || (free && angle !== REST_ANGLE);
      if (moving || stillRef.current || now - drawn >= 1000 / ANIMATION_FPS) {
        draw(now);
        drawn = now;
      }
      if (moving || !stillRef.current) frame = requestAnimationFrame(tick);
    };
    const run = () => {
      if (frame) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };
    wake.current = run;
    const act = () => {
      if (stillRef.current || acting) return;
      acting = { kind: FIGURE_ACTIONS[next % FIGURE_ACTIONS.length] ?? FIGURE_ACTIONS[0], at: performance.now() };
      next++;
      run();
    };
    setFigure.current = (b: FigureBody, l: number) => {
      if (model) {
        scene.remove(model.root);
        disposeFigure(model.root);
      }
      model = buildFigure(b, l);
      scene.add(model.root);
      draw(performance.now());
      run();
    };

    let downX = 0;
    let lastX = 0;
    let moved = 0;
    const down = (e: PointerEvent) => {
      box.setPointerCapture(e.pointerId);
      dragging = true;
      downX = lastX = e.clientX;
      moved = 0;
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      angle = turnBy(angle, e.clientX - lastX);
      moved = Math.max(moved, Math.abs(e.clientX - downX));
      lastX = e.clientX;
      run();
    };
    const up = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      if (e.type === 'pointerup' && moved < DRAG_SLOP) act();
      run();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        held = true;
        angle += (e.key === 'ArrowRight' ? 1 : -1) * KEY_TURN;
        draw(performance.now());
      } else if (e.key === 'Home') {
        held = false;
        angle = REST_ANGLE;
        draw(performance.now());
      } else if (e.key === 'Enter' || e.key === ' ') act();
      else return;
      e.preventDefault();
    };
    const blur = () => {
      held = false;
      run();
    };
    reset.current = () => {
      held = false;
      acting = null;
      angle = REST_ANGLE;
      draw(performance.now());
    };
    const lost = (e: Event) => {
      e.preventDefault();
      setWorks(false);
    };
    box.addEventListener('pointerdown', down);
    box.addEventListener('pointermove', move);
    box.addEventListener('pointerup', up);
    box.addEventListener('pointercancel', up);
    box.addEventListener('keydown', key);
    box.addEventListener('blur', blur);
    el.addEventListener('webglcontextlost', lost);
    return () => {
      cancelAnimationFrame(frame);
      box.removeEventListener('pointerdown', down);
      box.removeEventListener('pointermove', move);
      box.removeEventListener('pointerup', up);
      box.removeEventListener('pointercancel', up);
      box.removeEventListener('keydown', key);
      box.removeEventListener('blur', blur);
      el.removeEventListener('webglcontextlost', lost);
      reset.current = null;
      wake.current = null;
      setFigure.current = null;
      if (model) disposeFigure(model.root);
      target.depthTexture?.dispose();
      target.dispose();
      pass.dispose();
      quad.geometry.dispose();
      renderer.dispose();
    };
  }, [canvas, surface, works]);

  useEffect(() => setFigure.current?.(body, level), [body, level, works]);
  useEffect(() => reset.current?.(), [resetKey, works]);
  // motion allowed again: the idle starts; reduced: the next frame stands it still and stops
  useEffect(() => wake.current?.(), [still, works]);
  return works;
}
