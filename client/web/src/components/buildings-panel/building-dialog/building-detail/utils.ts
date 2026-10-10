import { fmt } from '@/lib/format';
import { REFUND_NAMES } from '@/components/buildings-panel/building-dialog/building-detail/constants';

/** What a demolition returns, e.g. "1.2K food, 800 lumber". */
export function refundText(r: Partial<Record<keyof typeof REFUND_NAMES, number>>): string {
  const parts = (Object.keys(REFUND_NAMES) as (keyof typeof REFUND_NAMES)[])
    .filter((k) => Math.floor(r[k] ?? 0) > 0)
    .map((k) => `${fmt(Math.floor(r[k]!))} ${REFUND_NAMES[k]}`);
  return parts.length ? parts.join(', ') : 'nothing';
}
