import { useTranslation } from 'react-i18next';
import type { Flow } from '@marchlands/api-client';
import { useNow } from '@/hooks/use-now';
import { duration } from '@/lib/format';
import { translateMessage } from '@/lib/messages';

/** Where the flow is: running, waiting (and until when), its next repeat, or why it stopped. */
export function StatusLine({ flow }: { flow: Flow }) {
  const { t } = useTranslation('flows-panel');
  const now = useNow();
  let text: string | null = null;
  if (flow.status === 'running') text = t('statusLine.running');
  else if (flow.status === 'waiting' && flow.heldSince > 0) text = t('statusLine.held', { time: duration(flow.waitUntil - now) });
  else if (flow.status === 'waiting') text = t('statusLine.waiting', { time: duration(flow.waitUntil - now) });
  else if (flow.status === 'queued') {
    if (flow.notBefore > now) text = t('statusLine.nextRun', { time: duration(flow.notBefore - now) });
    else text = t('statusLine.starting');
  }
  return (
    <div className="mt-2 grid gap-0.5 text-xs">
      {text && <p className="font-medium text-primary">{text}</p>}
      {flow.status === 'idle' && flow.stopReason && (
        <p className="text-destructive">{t('statusLine.stopped', { reason: translateMessage(flow.stopReason) })}</p>
      )}
    </div>
  );
}
