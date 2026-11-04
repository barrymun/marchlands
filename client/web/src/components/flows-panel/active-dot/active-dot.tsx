import { useTranslation } from 'react-i18next';
import { LIVE_DOT } from '@/lib/tones';
import { cn } from '@/lib/utils';

/** Marks a flow that is active (running, waiting between steps or due to go again): a green dot, pulsing unless motion is reduced. */
export function ActiveDot() {
  const { t } = useTranslation('flows-panel');
  return (
    <span className="relative flex size-2 shrink-0" title={t('list.active')}>
      <span className={cn('absolute inline-flex size-full rounded-full opacity-60 motion-safe:animate-ping', LIVE_DOT)} aria-hidden />
      <span className={cn('relative inline-flex size-2 rounded-full', LIVE_DOT)} aria-hidden />
      <span className="sr-only">{t('list.active')}</span>
    </span>
  );
}
