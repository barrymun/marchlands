import { useTranslation } from 'react-i18next';
import type { Targets } from '@/components/flows-panel/types';
import { usePlayer } from '@/hooks/use-game';

/** "All cities", or the chosen cities' names. */
export function CitiesSummary({ targets }: { targets: Targets }) {
  const { t } = useTranslation('flows-panel');
  const cities = usePlayer().data?.castles ?? [];
  if (targets === 'all') return <span className="text-foreground">{t('citiesSummary.all')}</span>;
  const names = cities.filter((c) => targets.includes(c.id)).map((c) => c.name);
  return <span className="text-foreground">{names.length ? names.join(', ') : t('citiesSummary.none')}</span>;
}
