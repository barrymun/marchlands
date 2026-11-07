import { lazyComponent } from '@/lib/lazy';

/** The quick mayor swap's content, loaded when it is first opened: it stays out of the first page's code. */
export const MayorPicker = lazyComponent(() => import('@/components/mayor-picker/mayor-picker').then((m) => m.MayorPicker));
