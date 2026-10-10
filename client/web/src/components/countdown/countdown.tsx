import { useNow } from '@/hooks/use-now';
import { duration } from '@/lib/format';

export function Countdown({ endTime }: { endTime: number }) {
  const now = useNow();
  return <span className="tabular-nums">{duration(endTime - now)}</span>;
}
