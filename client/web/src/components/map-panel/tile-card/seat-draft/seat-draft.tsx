import { useTranslation } from 'react-i18next';

import { type CityBean, getCitiesByCityIdQueryKey, getPlayerQueryKey, postCitiesDraftModeMutation, postCitiesDraftMutation } from '@marchlands/api-client';
import { BALANCE, canDraftFrom, HISTORIC_LEVELS, inSeatArea } from '@marchlands/core';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useCommand } from '@/hooks/use-game';
import { utcClock } from '@/lib/format';

/**
 * The daily draft of the player's historic cities (docs/features/historical-cities.md), on a tile's card: on a city
 * nobody holds that a seat may draft from (a barbarian city, or a lower historic city: canDraftFrom), a Draft button for
 * each of their seats whose area it lies in, greyed out once that seat has drafted from it today; on one of their seats,
 * Draft now (from the barbarian city it would pick by itself), whether it drafts by itself, how many drafts it has made
 * today, and when it next drafts by itself.
 */
export function SeatDraft({ tile, seats }: { tile: { id: number; type: number; level: number; held: boolean }; seats: CityBean[] }) {
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
        <Button
          size="sm"
          variant="outline"
          disabled={draft.isPending || own.draftsUsed >= max}
          title={t('draft.nowTitle')}
          onClick={() => draft.mutate({ path: { cityId: own.id }, body: {} })}
        >
          {t('draft.now')}
        </Button>
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
  if (tile.held) return null;
  const covering = seats.flatMap((c) => {
    const level = levelOf(c);
    return level && canDraftFrom(level, tile) && inSeatArea(c.fieldId, level, tile.id) ? [c] : [];
  });
  if (!covering.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {covering.map((c) => {
        // a seat drafts from each city once a day
        const done = c.draftedToday.includes(tile.id);
        return (
          <Button
            key={c.id}
            size="sm"
            variant="outline"
            disabled={draft.isPending || done || c.draftsUsed >= max}
            title={done ? t('draft.doneToday', { city: c.name }) : undefined}
            onClick={() => draft.mutate({ path: { cityId: c.id }, body: { tileId: tile.id } })}
          >
            {t('draft.button', { city: c.name, used: c.draftsUsed, max })}
          </Button>
        );
      })}
    </div>
  );
}
