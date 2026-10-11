import type { Flow, FlowRunReport } from '@marchlands/api-client';
import { duration } from '@/lib/format';
import { i18n } from '@/lib/i18n';

/** How long ago `t` was, for a report title: "just now" under a minute, else the largest unit ("5m ago", "2h ago"). */
export const ago = (now: number, t: number) =>
  now - t < 60_000 ? i18n.t('common:time.justNow') : i18n.t('common:time.ago', { time: duration(now - t).split(' ')[0] });

/** The cached flow list with a preview's report on flow `flowId` (as the server keeps it), until the next fetch. */
export const withPreview = (list: Flow[] | undefined, flowId: string, r: Pick<FlowRunReport, 'cities' | 'skippedCities'>, at = Date.now()) =>
  list?.map((f) => (f.id === flowId ? { ...f, lastPreview: { at, cities: r.cities, skippedCities: r.skippedCities } } : f));
