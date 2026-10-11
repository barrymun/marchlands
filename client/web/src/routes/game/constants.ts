import { i18n } from '@/lib/i18n';

const tab = <const Id extends 'buildings' | 'military' | 'heroes' | 'research' | 'items' | 'market' | 'armies' | 'reports' | 'map' | 'flows' | 'stats'>(
  id: Id,
) => ({
  id,
  /** in the current locale */
  get label() {
    return i18n.t(`game:tabs.${id}`);
  },
});

export const TABS = [
  tab('buildings'),
  tab('military'),
  tab('heroes'),
  tab('research'),
  tab('items'),
  tab('market'),
  tab('armies'),
  tab('reports'),
  tab('map'),
  tab('flows'),
  tab('stats'),
] as const;
