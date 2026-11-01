import { useTranslation } from 'react-i18next';

import { type CityBean, getCitiesByCityIdQueryKey, getPlayerQueryKey, postCitiesDraftModeMutation, postCitiesDraftMutation } from '@marchlands/api-client';
import { BALANCE, HISTORIC_LEVELS, inSeatArea, TileType } from '@marchlands/core';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useCommand } from '@/hooks/use-game';
import { utcClock } from '@/lib/format';

/**
 * The daily draft of the player's historic cities (docs/features/historical-cities.md), on a tile's card: on a
 * barbarian city nobody holds, a Draft button for each of their seats whose area it lies in; on one of their seats,
 * whether it drafts by itself, how many drafts it has made today, and when it next drafts by itself.
 */
export function SeatDraft({ tile, seats }: { tile: { id: number; type: number; held: boolean }; seats: CityBean[] }) {
  const { t } = useTranslation('map-panel');
  const refresh = (cityId: number) => [getCitiesByCityIdQueryKey({ path: { cityId } }), getPlayerQueryKey()];
  const draft = useCommand(postCitiesDraftMutation(), (v) => refresh(v.path.cityId), t('draft.done'));
  const mode = useCommand(postCitiesDraftModeMutation(), (v) => refresh(v.path.cityId));
  const max = BALANCE.historic.draftsPerDay;
  const levelOf = (c: CityBean) => HISTORIC_LEVELS.find((l) => l === c.historicLevel);
  const own = seats.find((c) => c.fieldId === tile.id);
  if (own) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Switch
          id={`draft-auto-${own.id}`}
          checked={own.draftAuto}
          disabled={mode.isPending}
          onCheckedChange={(auto) => mode.mutate({ path: { cityId: own.id }, body: { auto } })}
        />
        <Label htmlFor={`draft-auto-${own.id}`}>{t('draft.auto')}</Label>
        <span className="text-xs text-muted-foreground tabular-nums">{t('draft.used', { used: own.draftsUsed, max })}</span>
        {own.draftAuto && own.draftNextAt > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">· {t('draft.next', { time: utcClock(own.draftNextAt) })}</span>
        )}
      </div>
    );
  }
  if (tile.type !== TileType.NPC || tile.held) return null;
  const covering = seats.flatMap((c) => {
    const level = levelOf(c);
    return level && inSeatArea(c.fieldId, level, tile.id) ? [c] : [];
  });
  if (!covering.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {covering.map((c) => (
        <Button
          key={c.id}
          size="sm"
          variant="outline"
          disabled={draft.isPending || c.draftsUsed >= max}
          onClick={() => draft.mutate({ path: { cityId: c.id }, body: { tileId: tile.id } })}
        >
          {t('draft.button', { city: c.name, used: c.draftsUsed, max })}
        </Button>
      ))}
    </div>
  );
}
