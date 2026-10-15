import { Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { maxStars } from '@/components/hero-gear/constants';
import { cn } from '@/lib/utils';

export function Stars({ count, used }: { count: number; used?: number }) {
  const { t } = useTranslation('hero-gear');
  return (
    <div className="flex gap-px" aria-label={t('stars.label', { n: count, count: maxStars })}>
      {Array.from({ length: maxStars }, (_, i) => (
        <Star
          key={i}
          className={cn(
            'size-3',
            i < count
              ? used == null || i < used
                ? 'fill-amber-400 text-amber-500'
                : 'fill-amber-200 text-amber-300 dark:fill-amber-900 dark:text-amber-800'
              : 'text-muted-foreground/40',
          )}
        />
      ))}
    </div>
  );
}
