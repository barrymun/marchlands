import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Counters } from '@/components/stats-panel/types';
import { sumPrefix } from '@/components/stats-panel/utils';
import { Tile } from '@/components/stats-panel/tile/tile';

export function Summary({ c, lordWide }: { c: Counters; lordWide: boolean }) {
  const { t } = useTranslation('stats-panel');
  const won = sumPrefix(c, 'attacks.won.');
  const lost = sumPrefix(c, 'attacks.lost.');
  const tiles: [string, number][] = [
    [t('summary.attacksWon'), won],
    [t('summary.attacksLost'), lost],
    [t('summary.defensesWon'), sumPrefix(c, 'defenses.won.')],
    [t('summary.defensesLost'), sumPrefix(c, 'defenses.lost.')],
    [t('summary.barbarianCitiesBeaten'), c['attacks.won.npc'] ?? 0],
    [t('summary.citiesCaptured'), (c['captured.city'] ?? 0) + (c['captured.npc'] ?? 0)],
    [t('summary.valleysOccupied'), c['captured.valley'] ?? 0],
    [t('summary.honorGained'), c.honor ?? 0],
    [t('summary.buildingLevels'), c['levels.building'] ?? 0],
    [t('summary.researchLevels'), c['levels.research'] ?? 0],
    [t('summary.heroLevels'), c['levels.hero'] ?? 0],
    [t('summary.heroesHired'), c['heroes.hired'] ?? 0],
  ];
  if (lordWide) tiles.push([t('summary.itemsUsed'), sumPrefix(c, 'items.used.')]);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{t('summary.title')}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {tiles.map(([label, v]) => (
          <Tile key={label} label={label} value={v} />
        ))}
      </CardContent>
    </Card>
  );
}
