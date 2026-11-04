import { Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { duration, fmtExact } from '@/lib/format';
import { GAIN_TEXT } from '@/lib/tones';
import { cn } from '@/lib/utils';

/** Training that takes no time, marked so it's seen at once. An order behind batches already queued still waits for them, and says how long. */
export function InstantNote({ count, waitMs }: { count: number; waitMs: number }) {
  const { t } = useTranslation('military-panel');
  return (
    <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
      <span className={cn('inline-flex items-center gap-1 text-sm font-semibold', GAIN_TEXT)}>
        <Zap className="size-4 fill-current" aria-hidden />
        {t('trainEstimate.instant')}
      </span>
      {/* a split order's finish comes back a fraction of a millisecond late (splitTraining), which isn't a wait */}
      {Math.round(waitMs) > 0 ? t('trainEstimate.instantQueued', { n: fmtExact(count), time: duration(waitMs) }) : t('trainEstimate.instantWhy')}
    </span>
  );
}
