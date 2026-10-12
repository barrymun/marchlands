import { useEffect } from 'react';
import { whenIdle } from '@/lib/lazy';
import { LAZY_PANELS } from '@/routes/game/constants';

/** Fetches the code of every tab in the background once the page has rendered. */
export function usePreloadPanels() {
  useEffect(() => whenIdle(() => LAZY_PANELS.forEach((p) => p.preload())), []);
}
