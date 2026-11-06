import { FlaskConical, Hammer, Swords } from 'lucide-react';
import { i18n } from '@/lib/i18n';

/** `label` is in the current locale. */
/** The queues the dock lists. */
export const DockGroup = {
  BUILDING: 'Building',
  RESEARCH: 'Research',
  TRAINING: 'Training',
} as const;
export type DockGroup = (typeof DockGroup)[keyof typeof DockGroup];

export const GROUPS: { id: DockGroup; icon: typeof Hammer; label: string }[] = [
  {
    id: DockGroup.BUILDING,
    icon: Hammer,
    get label() {
      return i18n.t('activity-dock:groups.building');
    },
  },
  {
    id: DockGroup.RESEARCH,
    icon: FlaskConical,
    get label() {
      return i18n.t('activity-dock:groups.research');
    },
  },
  {
    id: DockGroup.TRAINING,
    icon: Swords,
    get label() {
      return i18n.t('activity-dock:groups.training');
    },
  },
];

/** rows shown per group before "+N more" */
export const PER_GROUP = 3;

export const STORE_KEY = 'marchlands-activity-collapsed';

/** Where the dock stands: floating over the page, or in line in the sidebar. */
export const DockVariant = { FLOATING: 'floating', INLINE: 'inline' } as const;
export type DockVariant = (typeof DockVariant)[keyof typeof DockVariant];
