export type Group = 'Building' | 'Research' | 'Training';

export interface Job {
  key: string;
  group: Group;
  label: string;
  /** extra note, e.g. batches waiting behind this one */
  note?: string;
  startTime: number;
  endTime: number;
  open: () => void;
}
