import { useQuery } from '@tanstack/react-query';
import { Copy, Eye, LocateFixed, Ruler, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { type CityBean, getMapTilesByTileIdOptions } from '@marchlands/api-client';
import {
  BALANCE,
  canUpgradeTile,
  FACTION_IDS,
  factionOfZone,
  isFactionLevel,
  Mission,
  tileDistance,
  TileType,
  valleyBonus,
  valleyResource,
} from '@marchlands/core';

import { ConfirmButton } from '@/components/confirm-button/confirm-button';
import { AddToFarmButton } from '@/components/flow-attack/add-to-farm-button/add-to-farm-button';
import { MedalOdds } from '@/components/map-panel/medal-odds/medal-odds';
import { SeatDraft } from '@/components/map-panel/tile-card/seat-draft/seat-draft';
import { SeatStatus } from '@/components/map-panel/tile-card/seat-status/seat-status';
import { placeName } from '@/components/map-panel/utils';
import { ValleyUpgrade } from '@/components/map-panel/valley-upgrade/valley-upgrade';
import { ResourceIcon } from '@/components/resource-icon/resource-icon';
import type { SendTarget } from '@/components/send-army-dialog/types';
import { tileKind, tileMissions, tileTarget } from '@/components/send-army-dialog/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePlayer } from '@/hooks/use-game';
import { useStateRulers } from '@/hooks/use-state-rulers';
import { copyText } from '@/lib/clipboard';
import { FACTION_STYLE } from '@/lib/factions';
import { fmt, fmtDecimal, percent } from '@/lib/format';
import { factionName, seatTitleName, tileName, zoneName } from '@/lib/game-data';
import { cn } from '@/lib/utils';

/**
 * The selected tile, floating over the map: what it is and who holds it, the medal odds of a barbarian camp, and what
 * can be done there (centre the map on it, send an army, scout, farm, upgrade, release, move the city).
 */
export function TileCard({
  city,
  tileId,
  here,
  onClose,
  onSend,
  onMoveTo,
  onCentre,
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
  /** centre the map on the tile and keep it in the address, as going to its coordinates does */
  onCentre: (x: number, y: number) => void;
  onRelease: (tileId: number) => Promise<unknown>;
  releasing: boolean;
  onUpgrade: (tileId: number) => Promise<unknown>;
  upgrading: boolean;
  className?: string;
}) {
  const { t } = useTranslation(['map-panel', 'common']);
  const info = useQuery(getMapTilesByTileIdOptions({ path: { tileId } }));
  const rulers = useStateRulers();
  const tile = info.data;
  const scouts = city.troop.scouter ?? 0;
  // the player's historic cities, which draft from barbarian cities in their areas
  const player = usePlayer();
  const seats = (player.data?.castles ?? []).filter((c) => c.historicLevel != null);
  // how far it is from the city in view, as a march measures it; nothing for the city itself
  const distance = tileId === city.fieldId ? null : tileDistance(city.fieldId, tileId, player.data?.mapSizeX);
  const ownSeat = seats.find((c) => c.fieldId === tileId);
  const boosted = tile ? valleyResource(tile.type) : null;
  const boost = tile &&
    boosted && { resource: boosted, words: { bonus: percent(valleyBonus(tile.type, tile.level)), resource: t(`common:resourcesInline.${boosted}`) } };
  // a barbarian city's side: the faction holding its zone, or none for a bandit below the faction level
  // (marchlands) or, in a state a player rules, cut off from it
  const ruler = tile?.type === TileType.NPC && isFactionLevel(tile.level) ? rulers.get(tile.zoneId) : undefined;
  const side = tile?.type === TileType.NPC && !ruler ? (isFactionLevel(tile.level) ? factionOfZone(tile.zoneId) : null) : undefined;
  const missions = tile ? tileMissions(tile, city.fieldId) : [];

  // the coordinates in the game's own notation, ready to paste into a chat, a mail or another tool
  const copyCoords = (x: number, y: number) => {
    const coords = `(${x},${y})`;
    copyText(coords).then(
      () => toast.success(t('copy.done', { coords })),
      () => toast.error(t('copy.failed')),
    );
  };

  return (
    <section
      aria-label={tile ? placeName(tile) : undefined}
      className={cn('grid gap-2 rounded-xl border bg-background/95 p-3 text-sm shadow-lg backdrop-blur', className)}
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-medium">{tile ? placeName(tile) : <Skeleton className="h-5 w-32" />}</h2>
        <Button size="icon-xs" variant="ghost" className="-mt-1 -me-1" onClick={onClose} aria-label={t('common:actions.close')}>
          <X />
        </Button>
      </div>
      {tile && (
        <>
          <div className="flex flex-wrap items-center gap-1">
            {/* a player's historic city shows as one, at its own level */}
            <Badge variant="secondary">{tileName('historicLevel' in tile && tile.historicLevel ? TileType.HISTORIC : tile.type)}</Badge>
            <Badge variant="secondary">{t('common:level.short', { level: ('historicLevel' in tile && tile.historicLevel) || tile.level })}</Badge>
            {/* the resource a valley boosts for the city holding it, at its level */}
            {boost && (
              <Badge variant="outline" title={t('valley.boostTitle', boost.words)}>
                <ResourceIcon resource={boost.resource} />
                {t('valley.boost', boost.words)}
              </Badge>
            )}
            {side && (
              <Badge variant="outline" title={t('faction.memberTitle', { faction: factionName(side.id) })}>
                <span aria-hidden className={cn('size-2 rounded-sm', FACTION_STYLE[side.id].swatch)} />
                {factionName(side.id)}
              </Badge>
            )}
            {ruler && (
              <Badge
                variant="outline"
                title={t('faction.ruledTitle', { faction: factionName(factionOfZone(tile.zoneId)?.id ?? FACTION_IDS[0]), player: ruler.player })}
              >
                {t('faction.ruled', { player: ruler.player })}
              </Badge>
            )}
            {side === null && (
              <Badge variant="outline" title={t('faction.banditsTitle', { level: BALANCE.factions.minLevel })}>
                {t('faction.bandits')}
              </Badge>
            )}
          </div>
          {/* where it is: the coordinates (copied in the game's notation), its state and how far from the city in view */}
          <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground tabular-nums">
            <span className="flex items-center">
              ({tile.x}, {tile.y}) · {zoneName(tile.zoneId)}
              <Button
                size="icon-xs"
                variant="ghost"
                className="-my-1"
                onClick={() => copyCoords(tile.x, tile.y)}
                aria-label={t('copy.label')}
                title={t('copy.label')}
              >
                <Copy />
              </Button>
            </span>
            {distance != null && (
              <span className="flex items-center gap-1" title={t('distance.title', { city: city.name })}>
                <Ruler className="size-3" aria-hidden />
                {t('distance.away', { count: distance, n: fmtDecimal(distance, 1) })}
              </span>
            )}
          </div>
          {'seatTitle' in tile && tile.seatTitle && <Badge variant="outline">{seatTitleName(tile.seatTitle)}</Badge>}
          {'userName' in tile && tile.userName && (
            <p>
              {tile.allianceName
                ? t('info.playerAlliance', { player: tile.userName, alliance: tile.allianceName, prestige: fmt(tile.prestige ?? 0) })
                : t('info.player', { player: tile.userName, prestige: fmt(tile.prestige ?? 0) })}
            </p>
          )}
          {(tile.type === TileType.NPC || (tile.type === TileType.CASTLE && tile.canLoot)) && <MedalOdds level={tile.level} />}
          {'owner' in tile && tile.owner && <p>{t('info.heldBy', { city: tile.owner.cityName, player: tile.owner.userName })}</p>}
          <SeatDraft tile={{ id: tile.id, type: tile.type, level: tile.level, held: 'owner' in tile && !!tile.owner }} seats={seats} />
          {ownSeat && <SeatStatus seat={ownSeat} />}
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
          {'upgradeCost' in tile && !tile.owner && canUpgradeTile(tile.type) && (
            <ValleyUpgrade city={city} tile={tile} onUpgrade={onUpgrade} pending={upgrading} />
          )}
          {tile.type === TileType.FLAT && 'owner' in tile && !tile.owner && (
            <Button size="sm" variant="outline" className="justify-self-start" onClick={() => onMoveTo({ x: tile.x, y: tile.y })}>
              {t('info.moveCityHere')}
            </Button>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {missions.length > 0 && (
              <>
                <Button size="sm" onClick={() => onSend(tileTarget(tile, city.fieldId))}>
                  {t('info.sendArmy')}
                </Button>
                {missions.includes(Mission.ATTACK) && <AddToFarmButton city={city} tileId={tile.id} tileName={placeName(tile)} />}
                {missions.includes(Mission.SCOUT) && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={scouts <= 0}
                    onClick={() => {
                      // lords' city scouts fight: send them all; elsewhere one always gets through
                      const n = tileKind(tile) === 'city' ? scouts : 1;
                      onSend({ ...tileTarget(tile, city.fieldId), mission: Mission.SCOUT, troops: { scouter: String(n) } });
                    }}
                  >
                    <Eye /> {t('info.scout')}
                  </Button>
                )}
              </>
            )}
            <Button size="sm" variant="outline" onClick={() => onCentre(tile.x, tile.y)} title={t('centre.title')}>
              <LocateFixed /> {t('centre.button')}
            </Button>
          </div>
          {missions.includes(Mission.SCOUT) && scouts <= 0 && <p className="text-xs text-muted-foreground">{t('info.noScouts')}</p>}
        </>
      )}
    </section>
  );
}
