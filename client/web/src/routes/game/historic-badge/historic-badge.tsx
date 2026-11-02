import { Castle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { HISTORIC_LEVELS } from '@marchlands/core';

import { HISTORIC_TONE } from '@/lib/tones';
import { cn } from '@/lib/utils';

/** A held historic city's mark beside its name (the city list, the city switcher): a castle and HC, in its flags' colour, its level in the title. */
export function HistoricBadge({ level, className }: { level: number | null; className?: string }) {
  const { t } = useTranslation('common');
  const seat = HISTORIC_LEVELS.find((l) => l === level);
  if (!seat) return null;
  return (
    <span
      // the text's line as tall as the icon (12px), so both centre on whole pixels and line up at any size
      className={cn(
        'inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-px text-[11px] leading-3 font-medium tabular-nums',
        HISTORIC_TONE[seat],
        className,
      )}
      title={t('historicCity', { level: seat })}
    >
      <Castle className="size-3" aria-hidden />
      <span aria-hidden>{t('historicCityShort')}</span>
      <span className="sr-only">{t('historicCity', { level: seat })}</span>
    </span>
  );
}
