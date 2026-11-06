import { lazyComponent } from '@/lib/lazy';

/** Only a city being abandoned shows it, so it stays off the first page. */
export const MoveOut = lazyComponent(() => import('@/components/move-out/move-out').then((m) => m.MoveOut));
