import { MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { CityBean, MapFieldInfo } from '@marchlands/api-client';
import { Relation, tileDistance } from '@marchlands/core';

import { placeName } from '@/components/map-panel/utils';
import { tileMissions } from '@/components/send-army-dialog/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePlayer } from '@/hooks/use-game';
import { errorMessage } from '@/lib/api';
import { fmtDecimal } from '@/lib/format';
import { LOSS_TEXT, WARN_TEXT } from '@/lib/tones';
import { cn } from '@/lib/utils';

/** What's at the destination, so a mistyped place shows before the army leaves: what it is, who holds it and how far it is. */
export function TileSummary({
  city,
  tile,
  error,
  onShowOnMap,
}: {
  city: CityBean;
  tile?: MapFieldInfo;
  error: unknown;
  onShowOnMap: (x: number, y: number) => void;
}) {
  const { t } = useTranslation(['send-army-dialog', 'map-panel', 'common']);
  const mapSize = usePlayer().data?.mapSizeX;
  if (error) return <p className={cn('text-xs', LOSS_TEXT)}>{errorMessage(error)}</p>;
  if (!tile) return <Skeleton className="h-4 w-48" />;
  const self = tile.id === city.fieldId;
  const distance = tileDistance(city.fieldId, tile.id, mapSize);
  const holder = 'userName' in tile ? tile.userName : 'owner' in tile ? tile.owner?.userName : undefined;
  const level = ('historicLevel' in tile && tile.historicLevel) || tile.level;
  return (
    <>
      <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground tabular-nums">
        <span className="font-medium text-foreground">{t('common:level.named', { name: placeName(tile), level })}</span>
        {tile.relation === Relation.SELF ? <span>{t('to.yours')}</span> : holder && <span>{t('to.heldBy', { player: holder })}</span>}
        {!self && <span>{t('map-panel:distance.away', { count: distance, n: fmtDecimal(distance, 1) })}</span>}
      </p>
      <Button size="xs" variant="ghost" className="gap-1" onClick={() => onShowOnMap(tile.x, tile.y)}>
        <MapPin />
        {t('to.showOnMap')}
      </Button>
      {tileMissions(tile, city.fieldId).length === 0 && <p className={cn('w-full text-xs', WARN_TEXT)}>{self ? t('to.self') : t('to.none')}</p>}
    </>
  );
}
