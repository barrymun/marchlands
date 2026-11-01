import { useNow } from '@/hooks/use-now';
import { clockOffset } from '@/lib/server-clock';

/** The server's time now (lib/server-clock.ts), re-rendering every `interval` ms. */
export function useServerNow(interval = 1000): number {
  return useNow(interval) + clockOffset();
}
