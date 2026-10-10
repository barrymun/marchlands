import type { Flow } from '@marchlands/api-client';
import { useNow } from '@/hooks/use-now';
import { duration } from '@/lib/format';

/** Where the flow is: running, waiting (and until when), its next repeat, or why it stopped. */
export function StatusLine({ flow }: { flow: Flow }) {
  const now = useNow();
  let text: string | null = null;
  if (flow.status === 'running') text = 'Running now.';
  else if (flow.status === 'waiting' && flow.heldSince > 0)
    text = `Waiting for every hero of its cities to come home (and for flows held before it), checking again in ${duration(flow.waitUntil - now)}.`;
  else if (flow.status === 'waiting') text = `Waiting: carries on in ${duration(flow.waitUntil - now)}.`;
  else if (flow.status === 'queued') {
    if (flow.notBefore > now) text = `Next run in ${duration(flow.notBefore - now)}.`;
    else text = 'Starting…';
  }
  return (
    <div className="mt-2 grid gap-0.5 text-xs">
      {text && <p className="font-medium text-primary">{text}</p>}
      {flow.status === 'idle' && flow.stopReason && <p className="text-destructive">Stopped: {flow.stopReason}. Repeat was switched off.</p>}
    </div>
  );
}
