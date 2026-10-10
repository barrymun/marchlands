import type { FlowAction } from '@marchlands/api-client';

/** An action in the editor, with a stable key for drag and drop. */
export type Draft = FlowAction & { key: string };

/** Cities a flow runs on: every city (now and later) or chosen ones. */
export type Targets = 'all' | number[];

export type EditDraft = { id: string | null; name: string; actions: Draft[]; cities: Targets };
