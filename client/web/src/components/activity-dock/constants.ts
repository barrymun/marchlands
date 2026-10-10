import { FlaskConical, Hammer, Swords } from 'lucide-react';
import type { Group } from '@/components/activity-dock/types';

export const GROUPS: { id: Group; icon: typeof Hammer }[] = [
  { id: 'Building', icon: Hammer },
  { id: 'Research', icon: FlaskConical },
  { id: 'Training', icon: Swords },
];

/** rows shown per group before "+N more" */
export const PER_GROUP = 3;

export const STORE_KEY = 'marchlands-activity-collapsed';
