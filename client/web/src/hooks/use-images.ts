import { useEffect, useState } from 'react';

/** Every sprite image loaded so far, by URL, shared by every canvas on the page (the isometric town, the world map). */
const images = new Map<string, HTMLImageElement>();

/** Each loaded sprite's alpha channel by URL, read on the first hit test that needs it. */
const alphas = new Map<string, { width: number; alpha: Uint8ClampedArray }>();

/** Whether a sprite's pixel (x, y) is drawn; false until the sprite has loaded, so a click falls to the tile below. */
export function opaqueAt(src: string, x: number, y: number): boolean {
  let a = alphas.get(src);
  const img = images.get(src);
  if (!a && img) {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0);
    a = { width: img.naturalWidth, alpha: ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight).data.filter((_, i) => i % 4 === 3) };
    alphas.set(src, a);
  }
  return !!a && a.alpha[y * a.width + x] > 0;
}

/** Load every image in `srcs` and hand back the loaded ones by URL; the grid re-renders, and redraws, as each arrives. */
export function useImages(srcs: readonly string[]): ReadonlyMap<string, HTMLImageElement> {
  const key = [...new Set(srcs)].sort().join('|');
  const [, setLoaded] = useState(images.size);
  useEffect(() => {
    let live = true;
    for (const src of key.split('|')) {
      if (!src || images.has(src)) continue;
      const img = new Image();
      img.onload = () => {
        images.set(src, img);
        if (live) setLoaded(images.size);
      };
      img.src = src;
    }
    return () => {
      live = false;
    };
  }, [key]);
  return images;
}
