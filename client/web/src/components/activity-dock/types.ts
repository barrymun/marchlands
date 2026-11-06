import type { DockGroup } from '@/components/activity-dock/constants';

export interface Job {
  key: string;
  group: DockGroup;
  label: string;
  /** extra note, e.g. batches waiting behind this one */
  note?: string;
  startTime: number;
  endTime: number;
  open: () => void;
}
