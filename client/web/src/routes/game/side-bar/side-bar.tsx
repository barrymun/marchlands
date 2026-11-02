import { useTranslation } from 'react-i18next';

import type { CityBean } from '@marchlands/api-client';

import { ActivityDock } from '@/components/activity-dock/activity-dock';
import { ResourceBar } from '@/components/resource-bar/resource-bar';
import { Separator } from '@/components/ui/separator';
import { CityList } from '@/routes/game/city-list/city-list';
import { TroopsHome } from '@/routes/game/troops-home/troops-home';
import { mayorOf } from '@/routes/game/utils';

/** The desktop sidebar, the same on every screen: the player's cities, this city's resources, troops at home and queues. */
export function SideBar({ city }: { city: CityBean }) {
  const { t } = useTranslation('game');
  return (
    <aside aria-label={t('sidebar')} className="hidden w-72 shrink-0 overflow-y-auto border-s bg-background/60 p-3 lg:grid lg:content-start lg:gap-4">
      <CityList city={city} />
      <Separator />
      <ResourceBar resource={city.resource} mayor={mayorOf(city)} stacked />
      <Separator />
      <TroopsHome city={city} />
      <Separator />
      <ActivityDock city={city} variant="inline" />
    </aside>
  );
}
