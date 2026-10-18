import { useQuery } from '@tanstack/react-query';
import { Eye, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { type CityBean, getMapTilesByTileIdOptions } from '@marchlands/api-client';
import { Mission, TileType, VALLEY_TYPES } from '@marchlands/core';

import { ConfirmButton } from '@/components/confirm-button/confirm-button';
import { AddToFarmButton } from '@/components/flow-attack/add-to-farm-button/add-to-farm-button';
import { MedalOdds } from '@/components/map-panel/medal-odds/medal-odds';
import { placeName } from '@/components/map-panel/utils';
import { ValleyUpgrade } from '@/components/map-panel/valley-upgrade/valley-upgrade';
import type { SendTarget } from '@/components/send-army-dialog/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { fmt } from '@/lib/format';
import { tileName, zoneName } from '@/lib/game-data';
import { cn } from '@/lib/utils';

/**
 * The selected tile, floating over the map: what it is and who holds it, the medal odds of a barbarian camp, and what
 * can be done there (send an army, scout, farm, upgrade, release, move the city).
 */
export function TileCard({
  city,
  tileId,
  here,
  onClose,
  onSend,
  onMoveTo,
  onRelease,
  releasing,
  onUpgrade,
  upgrading,
  className,
}: {
  city: CityBean;
  tileId: number;
  /** whether this city holds the tile (it can be released) */
  here: boolean;
  onClose: () => void;
  onSend: (target: SendTarget) => void;
  onMoveTo: (at: { x: number; y: number }) => void;
  onRelease: (tileId: number) => Promise<unknown>;
  releasing: boolean;
  onUpgrade: (tileId: number) => Promise<unknown>;
  upgrading: boolean;
  className?: string;
}) {
  const { t } = useTranslation(['map-panel', 'common']);
  const info = useQuery(getMapTilesByTileIdOptions({ path: { tileId } }));
  const tile = info.data;
  const scouts = city.troop.scouter ?? 0;
  /** what can be scouted on a tile (empty land has nothing to see) */
  const kindOf = (t: NonNullable<typeof tile>): SendTarget['kind'] =>
    t.type === TileType.CASTLE ? 'city' : t.type === TileType.NPC ? 'npc' : t.type === TileType.FLAT ? undefined : 'valley';
  const missionsFor = (t: NonNullable<typeof tile>): number[] => {
    const m: number[] = [];
    if (t.canLoot || t.canOccupy) m.push(Mission.ATTACK);
    if (t.canScout && kindOf(t)) m.push(Mission.SCOUT);
    if (t.canSend) m.push(Mission.REINFORCE);
    if (t.canTrans) m.push(Mission.TRANSPORT);
    if (t.type === TileType.FLAT && !('owner' in t && t.owner)) m.push(Mission.BUILD_CITY);
    return m;
  };

  return (
    <section
      aria-label={tile ? placeName(tile) : undefined}
      className={cn('grid gap-2 rounded-xl border bg-background/95 p-3 text-sm shadow-lg backdrop-blur', className)}
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-medium">{tile ? placeName(tile) : <Skeleton className="h-5 w-32" />}</h2>
        <Button size="icon-xs" variant="ghost" className="-mt-1 -mr-1" onClick={onClose} aria-label={t('common:actions.close')}>
          <X />
        </Button>
      </div>
      {tile && (
        <>
          <div className="flex flex-wrap gap-1">
            <Badge variant="secondary">{tileName(tile.type)}</Badge>
            <Badge variant="secondary">{t('common:level.short', { level: tile.level })}</Badge>
            <Badge variant="outline">
              ({tile.x}, {tile.y}) · {zoneName(tile.zoneId)}
            </Badge>
          </div>
          {'userName' in tile && tile.userName && (
            <p>
              {tile.allianceName
                ? t('info.playerAlliance', { player: tile.userName, alliance: tile.allianceName, prestige: fmt(tile.prestige ?? 0) })
                : t('info.player', { player: tile.userName, prestige: fmt(tile.prestige ?? 0) })}
            </p>
          )}
          {(tile.type === TileType.NPC || (tile.type === TileType.CASTLE && tile.canLoot)) && <MedalOdds level={tile.level} />}
          {'owner' in tile && tile.owner && <p>{t('info.heldBy', { city: tile.owner.cityName, player: tile.owner.userName })}</p>}
          {here && (
            <div className="flex items-center gap-2">
              <ConfirmButton
                size="xs"
                variant="outline"
                disabled={releasing}
                title={t('release.title')}
                description={t('release.description')}
                confirmLabel={t('release.confirm')}
                onConfirm={() => onRelease(tile.id)}
              >
                {t('release.button')}
              </ConfirmButton>
              <span className="text-xs text-muted-foreground">{t('release.hint')}</span>
            </div>
          )}
          {'upgradeCost' in tile && !tile.owner && (VALLEY_TYPES.includes(tile.type) || tile.type === TileType.NPC) && (
            <ValleyUpgrade city={city} tile={tile} onUpgrade={onUpgrade} pending={upgrading} />
          )}
          {tile.type === TileType.FLAT && 'owner' in tile && !tile.owner && (
            <Button size="sm" variant="outline" className="justify-self-start" onClick={() => onMoveTo({ x: tile.x, y: tile.y })}>
              {t('info.moveCityHere')}
            </Button>
          )}
          {missionsFor(tile).length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => onSend({ tileId: tile.id, name: placeName(tile), missions: missionsFor(tile), kind: kindOf(tile) })}>
                {t('info.sendArmy')}
              </Button>
              {missionsFor(tile).includes(Mission.ATTACK) && <AddToFarmButton city={city} tileId={tile.id} tileName={placeName(tile)} />}
              {missionsFor(tile).includes(Mission.SCOUT) && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={scouts <= 0}
                    onClick={() => {
                      const kind = kindOf(tile);
                      // lords' city scouts fight: send them all; elsewhere one always gets through
                      const n = kind === 'city' ? scouts : 1;
                      onSend({
                        tileId: tile.id,
                        name: placeName(tile),
                        missions: missionsFor(tile),
                        mission: Mission.SCOUT,
                        troops: { scouter: String(n) },
                        kind,
                      });
                    }}
                  >
                    <Eye /> {t('info.scout')}
                  </Button>
                  {scouts <= 0 && <span className="text-xs text-muted-foreground">{t('info.noScouts')}</span>}
                </>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
