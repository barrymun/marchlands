import { useSyncExternalStore } from 'react';
import { useMotion } from '@/hooks/use-motion';

/** The animation code: frames made in code, the spots, and what each building shows (components/iso-anim/utils.ts). */
type Animations = typeof import('@/components/iso-anim/utils');

let loaded: Animations | null = null;
let loading = false;
const listeners = new Set<() => void>();

/** Fetch the animation code once, in the background, and tell every scene waiting for it. */
function load() {
  if (loaded || loading) return;
  loading = true;
  import('@/components/iso-anim/utils').then(
    (m) => {
      loaded = m;
      for (const l of listeners) l();
    },
    () => {
      // the scenes stay still; a later visit tries again
      loading = false;
    },
  );
}

/**
 * The animation code, once it has loaded, or null: until then, and whenever the player asks for reduced motion, the
 * scenes are drawn still. It is its own file of the build, fetched after the first page (AGENTS.md, Client rule 7),
 * so the town shows at once on a slow connection and comes alive a moment later.
 */
export function useAnimations(): Animations | null {
  const motion = useMotion();
  const anim = useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      if (motion) load();
      return () => listeners.delete(onChange);
    },
    () => loaded,
    () => null,
  );
  return motion ? anim : null;
}
