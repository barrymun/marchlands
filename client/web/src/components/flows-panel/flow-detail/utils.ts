import type { Flow, FlowRunReport } from '@marchlands/api-client';

/** The cached flow list with a preview's report on flow `flowId` (as the server keeps it), until the next fetch. */
export const withPreview = (list: Flow[] | undefined, flowId: string, r: Pick<FlowRunReport, 'cities' | 'skippedCities'>, at = Date.now()) =>
  list?.map((f) => (f.id === flowId ? { ...f, lastPreview: { at, cities: r.cities, skippedCities: r.skippedCities } } : f));
