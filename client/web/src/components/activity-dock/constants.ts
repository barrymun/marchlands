import { FlaskConical, Hammer, Swords } from 'lucide-react';
import type { Group } from '@/components/activity-dock/types';
import { i18n } from '@/lib/i18n';

/** `label` is in the current locale. */
export const GROUPS: { id: Group; icon: typeof Hammer; label: string }[] = [
  {
    id: 'Building',
    icon: Hammer,
    get label() {
      return i18n.t('activity-dock:groups.building');
    },
  },
  {
    id: 'Research',
    icon: FlaskConical,
    get label() {
      return i18n.t('activity-dock:groups.research');
    },
  },
  {
    id: 'Training',
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
