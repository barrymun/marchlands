import { Repeat } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { Flow } from '@marchlands/api-client';

import { Badge } from '@/components/ui/badge';
import { useNow } from '@/hooks/use-now';
import { duration } from '@/lib/format';

/** The flow's state in the list, with the time left while it waits (or until its next repeat). */
export function StatusBadge({ flow }: { flow: Flow }) {
  const { t } = useTranslation('flows-panel');
  const now = useNow();
  const left = (at: number) => (at > now ? duration(at - now) : t('statusBadge.due'));
  const repeat = flow.repeat && <Repeat className="size-3.5 text-muted-foreground" aria-label={t('statusBadge.repeats')} />;
  const badge =
    flow.status === 'running' ? (
      <Badge>{t('statusBadge.running')}</Badge>
    ) : flow.status === 'waiting' ? (
      <Badge className="tabular-nums" title={flow.heldSince > 0 ? t('statusBadge.held') : undefined}>
        {flow.heldSince > 0 ? t('statusBadge.heroesOut') : t('statusBadge.waiting')} · {left(flow.waitUntil)}
      </Badge>
    ) : flow.status === 'queued' ? (
      <Badge variant="secondary" className="tabular-nums">
        {flow.notBefore > now
          ? t('statusBadge.repeatsIn', { time: left(flow.notBefore) })
          : flow.notBefore > 0
            ? t('statusBadge.repeats')
            : t('statusBadge.queued')}
      </Badge>
    ) : flow.stopReason ? (
      <Badge variant="destructive">{t('statusBadge.stopped')}</Badge>
    ) : null;
  if (!badge && !repeat) return null;
  return (
    <span className="flex shrink-0 items-center gap-1">
      {repeat}
      {badge}
    </span>
  );
}
