import { useMediaQuery } from '@/hooks/use-media-query';

/** Whether the game may animate: not when the player's system asks for reduced motion. */
export function useMotion(): boolean {
  return !useMediaQuery('(prefers-reduced-motion: reduce)');
}
