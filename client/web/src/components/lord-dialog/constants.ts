import { lazyComponent } from '@/lib/lazy';

/** The player's settings, loaded on first use with their text (lib/i18n.ts): most visits never open them. */
export const LordForm = lazyComponent(() => import('@/components/lord-dialog/lord-form/lord-form').then((m) => m.LordForm));
