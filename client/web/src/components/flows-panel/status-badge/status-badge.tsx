import { Repeat } from 'lucide-react';
import type { Flow } from '@marchlands/api-client';
import { Badge } from '@/components/ui/badge';
import { useNow } from '@/hooks/use-now';
import { duration } from '@/lib/format';

/** The flow's state in the list, with the time left while it waits (or until its next repeat). */
export function StatusBadge({ flow }: { flow: Flow }) {
  const now = useNow();
  const left = (at: number) => (at > now ? duration(at - now) : 'due');
  const repeat = flow.repeat && <Repeat className="size-3.5 text-muted-foreground" aria-label="Repeats" />;
  const badge =
    flow.status === 'running' ? (
      <Badge>Running</Badge>
    ) : flow.status === 'waiting' ? (
      <Badge className="tabular-nums" title={flow.heldSince > 0 ? 'Held until every hero of its cities is home' : undefined}>
        {flow.heldSince > 0 ? 'Heroes out' : 'Waiting'} · {left(flow.waitUntil)}
      </Badge>
    ) : flow.status === 'queued' ? (
      <Badge variant="secondary" className="tabular-nums">
        {flow.notBefore > now ? `Repeats in ${left(flow.notBefore)}` : flow.notBefore > 0 ? 'Repeats' : 'Queued'}
      </Badge>
    ) : flow.stopReason ? (
      <Badge variant="destructive">Stopped</Badge>
    ) : null;
  if (!badge && !repeat) return null;
  return (
    <span className="flex shrink-0 items-center gap-1">
      {repeat}
      {badge}
    </span>
  );
}
